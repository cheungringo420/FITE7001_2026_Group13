#!/usr/bin/env python3
"""
Enhanced backtest pipeline with ML signal generation.
Combines trust scoring, resolution analysis, and gradient boosting
to identify which Polymarket markets are "resolution-risky".

This script:
1. Loads historical markets + trust scores
2. Engineers ML features from market metadata
3. Constructs resolution-risk proxy labels:
   - Markets where final price was between 0.30-0.70 (ambiguous resolution)
   - Markets with very low volume but claimed high clarity
   - Markets that resolved very close to deadline (panic resolution)
4. Trains LightGBM / XGBoost classifier with walk-forward validation
5. Evaluates calibration and outputs feature importance
6. Runs P&L simulation: filter by ML risk signal vs unfiltered

Usage:
  python3 scripts/ml_enhanced_backtest.py
  python3 scripts/ml_enhanced_backtest.py --model xgboost
"""
import argparse
import json
import os
import warnings
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import (
    roc_auc_score, brier_score_loss, log_loss,
    classification_report, confusion_matrix
)
from sklearn.calibration import CalibratedClassifierCV
from sklearn.preprocessing import StandardScaler
import scipy.stats as stats

warnings.filterwarnings("ignore", category=FutureWarning)

DATA_DIR    = os.path.join(os.path.dirname(__file__), "..", "data")
RESULTS_DIR = os.path.join(DATA_DIR, "backtest_results")


# ═══════════════════════════════════════════════════════════════
# STEP 1: Feature Engineering
# ═══════════════════════════════════════════════════════════════

def engineer_features(markets: pd.DataFrame, trust: pd.DataFrame) -> pd.DataFrame:
    """Build the feature matrix from raw market + trust data."""

    df = trust.merge(markets, left_on="market_id", right_on="id", how="left", suffixes=("_trust", "_mkt"))

    # ── Existing trust features (already computed) ────────
    feature_cols = [
        "criteria_clarity", "evidence_consensus",
        "integrity_risk", "composite_score",
    ]

    # ── NEW: Text-based features ──────────────────────────
    df["question_length"]     = df["question"].fillna("").str.len()
    df["description_length"]  = df["description"].fillna("").str.len()
    df["question_word_count"] = df["question"].fillna("").str.split().apply(len)
    df["has_question_mark"]   = df["question"].fillna("").str.contains(r"\?").astype(int)
    df["description_ratio"]   = df["description_length"] / (df["question_length"] + 1)

    feature_cols += ["question_length", "description_length",
                     "question_word_count", "has_question_mark", "description_ratio"]

    # ── NEW: Volume & liquidity features ──────────────────
    df["log_volume"]    = np.log1p(df["volume_usd"].fillna(0).astype(float))
    df["log_liquidity"] = np.log1p(df["liquidity_usd"].fillna(0).astype(float))
    df["vol_liq_ratio"] = df["volume_usd"].fillna(0).astype(float) / (
        df["liquidity_usd"].fillna(0).astype(float) + 1
    )

    feature_cols += ["log_volume", "log_liquidity", "vol_liq_ratio"]

    # ── NEW: Resolution source features ───────────────────
    res_src = df["resolution_src"].fillna("").str.lower()
    df["has_resolution_url"]     = res_src.str.contains("http").astype(int)
    df["resolution_src_is_gov"]  = res_src.str.contains(r"\.gov|\.org|reuters|apnews|bbc").astype(int)
    df["resolution_src_social"]  = res_src.str.contains(r"twitter|x\.com|reddit|youtube").astype(int)
    df["resolution_src_length"]  = res_src.str.len()

    feature_cols += ["has_resolution_url", "resolution_src_is_gov",
                     "resolution_src_social", "resolution_src_length"]

    # ── NEW: Time features ────────────────────────────────
    df["resolved_at_dt"] = pd.to_datetime(df["resolved_at"], utc=True, errors="coerce")
    df["resolve_month"]  = df["resolved_at_dt"].dt.month.fillna(0).astype(int)
    df["resolve_dow"]    = df["resolved_at_dt"].dt.dayofweek.fillna(0).astype(int)

    feature_cols += ["resolve_month", "resolve_dow"]

    # ── NEW: Category encoding ────────────────────────────
    cat_dummies = pd.get_dummies(
        df["category"].fillna("unknown").str.lower(),
        prefix="cat", drop_first=True
    )
    df = pd.concat([df, cat_dummies], axis=1)
    feature_cols += list(cat_dummies.columns)

    # ── NEW: Final price features (used for label, NOT features in live prediction) ──
    # These are only used for constructing the target label.

    # ── NEW: Ambiguity flags as feature ───────────────────
    if "ambiguity_flags" in df.columns:
        df["n_ambiguity_flags"] = df["ambiguity_flags"].apply(
            lambda x: len(x) if isinstance(x, list) else 0
        )
        feature_cols.append("n_ambiguity_flags")

    if "has_explicit_date" in df.columns:
        df["has_explicit_date_int"] = df["has_explicit_date"].fillna(False).astype(int)
        feature_cols.append("has_explicit_date_int")

    if "has_objective_threshold" in df.columns:
        df["has_objective_threshold_int"] = df["has_objective_threshold"].fillna(False).astype(int)
        feature_cols.append("has_objective_threshold_int")

    return df, [c for c in feature_cols if c in df.columns]


# ═══════════════════════════════════════════════════════════════
# STEP 2: Resolution-Risk Label Construction
# ═══════════════════════════════════════════════════════════════

def construct_labels(df: pd.DataFrame) -> pd.Series:
    """
    Construct a binary 'resolution_risk' label.

    Proxy for resolution risk = markets where:
    - Final price was between 0.30 and 0.70 (ambiguous outcome — market didn't converge)
    - OR volume < $5000 (thin market, more vulnerable to manipulation)
    - OR resolution_state is DISPUTED or CANCELLED

    This is a PROXY — it captures markets that would be flagged as risky
    by an institutional risk desk. It's not perfect, but it IS backtestable.
    """
    final_price = df["final_price"].astype(float).fillna(0.5)
    volume      = df["volume_usd"].astype(float).fillna(0)
    state       = df["resolution_state"].fillna("")

    # Ambiguous final price (market didn't converge)
    ambiguous = (final_price >= 0.30) & (final_price <= 0.70)

    # Thin market
    thin = volume < 5000

    # Known bad states
    bad_state = state.isin(["DISPUTED", "CANCELLED", "INVALID"])

    # Combined label: any of these triggers → risk
    label = (ambiguous | thin | bad_state).astype(int)

    return label


# ═══════════════════════════════════════════════════════════════
# STEP 3: Model Training with Walk-Forward Validation
# ═══════════════════════════════════════════════════════════════

def train_and_evaluate(
    df: pd.DataFrame,
    feature_cols: list[str],
    model_type: str = "lgbm",
    n_splits: int = 5,
) -> dict:
    """Train ML model with time-series-aware walk-forward validation."""

    X = df[feature_cols].fillna(0).values
    y = construct_labels(df).values

    print(f"\n  Label distribution: {y.sum()} risky / {len(y)} total ({y.mean()*100:.1f}%)")

    # Sort by resolution date for time-series split
    sort_idx = df["resolved_at_dt"].fillna(pd.Timestamp("2000-01-01", tz="UTC")).argsort()
    X = X[sort_idx]
    y = y[sort_idx]

    tscv = TimeSeriesSplit(n_splits=n_splits)

    all_y_true       = []
    all_y_prob        = []
    all_y_prob_cal    = []
    feature_importances = np.zeros(len(feature_cols))

    for fold, (train_idx, test_idx) in enumerate(tscv.split(X)):
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        # -- Build model --
        if model_type == "xgboost":
            try:
                from xgboost import XGBClassifier
                model = XGBClassifier(
                    n_estimators=200, max_depth=5, learning_rate=0.05,
                    subsample=0.8, colsample_bytree=0.8,
                    eval_metric="logloss", verbosity=0, random_state=42,
                    use_label_encoder=False,
                )
            except ImportError:
                print("  XGBoost not installed, falling back to sklearn GBM")
                from sklearn.ensemble import GradientBoostingClassifier
                model = GradientBoostingClassifier(
                    n_estimators=200, max_depth=5, learning_rate=0.05,
                    subsample=0.8, random_state=42,
                )
        elif model_type == "lgbm":
            try:
                from lightgbm import LGBMClassifier
                model = LGBMClassifier(
                    n_estimators=200, max_depth=5, learning_rate=0.05,
                    subsample=0.8, colsample_bytree=0.8,
                    verbose=-1, random_state=42,
                )
            except ImportError:
                print("  LightGBM not installed, falling back to sklearn GBM")
                from sklearn.ensemble import GradientBoostingClassifier
                model = GradientBoostingClassifier(
                    n_estimators=200, max_depth=5, learning_rate=0.05,
                    subsample=0.8, random_state=42,
                )
        else:
            from sklearn.ensemble import GradientBoostingClassifier
            model = GradientBoostingClassifier(
                n_estimators=200, max_depth=5, learning_rate=0.05,
                subsample=0.8, random_state=42,
            )

        model.fit(X_train, y_train)

        # Uncalibrated predictions
        y_prob = model.predict_proba(X_test)[:, 1]

        # Calibrate with isotonic regression
        try:
            cal_model = CalibratedClassifierCV(model, method="isotonic", cv=3)
            cal_model.fit(X_train, y_train)
            y_prob_cal = cal_model.predict_proba(X_test)[:, 1]
        except Exception:
            y_prob_cal = y_prob  # Fallback

        all_y_true.extend(y_test)
        all_y_prob.extend(y_prob)
        all_y_prob_cal.extend(y_prob_cal)

        # Feature importances
        if hasattr(model, "feature_importances_"):
            feature_importances += model.feature_importances_

        auc = roc_auc_score(y_test, y_prob) if y_test.sum() > 0 else 0
        print(f"  Fold {fold+1}/{n_splits}: AUC={auc:.4f}, "
              f"n_train={len(train_idx)}, n_test={len(test_idx)}, "
              f"risk_rate={y_test.mean()*100:.1f}%")

    # Aggregate results
    all_y_true    = np.array(all_y_true)
    all_y_prob    = np.array(all_y_prob)
    all_y_prob_cal = np.array(all_y_prob_cal)

    feature_importances /= n_splits

    overall_auc       = roc_auc_score(all_y_true, all_y_prob)
    overall_auc_cal   = roc_auc_score(all_y_true, all_y_prob_cal)
    brier_uncal       = brier_score_loss(all_y_true, all_y_prob)
    brier_cal         = brier_score_loss(all_y_true, all_y_prob_cal)
    logloss_uncal     = log_loss(all_y_true, all_y_prob)
    logloss_cal       = log_loss(all_y_true, all_y_prob_cal)

    # Feature importance ranking
    importance_df = pd.DataFrame({
        "feature": feature_cols,
        "importance": feature_importances,
    }).sort_values("importance", ascending=False)

    results = {
        "model_type":   model_type,
        "n_samples":    len(all_y_true),
        "n_risky":      int(all_y_true.sum()),
        "risk_rate":    float(all_y_true.mean()),
        "auc_roc":      round(overall_auc, 4),
        "auc_roc_cal":  round(overall_auc_cal, 4),
        "brier_uncal":  round(brier_uncal, 6),
        "brier_cal":    round(brier_cal, 6),
        "logloss_uncal": round(logloss_uncal, 6),
        "logloss_cal":   round(logloss_cal, 6),
        "top_features": importance_df.head(15).to_dict(orient="records"),
        "all_y_true":   all_y_true,
        "all_y_prob":   all_y_prob,
        "all_y_prob_cal": all_y_prob_cal,
    }

    return results


# ═══════════════════════════════════════════════════════════════
# STEP 4: P&L Simulation — Filter by Trust Score vs ML Signal
# ═══════════════════════════════════════════════════════════════

def simulate_pnl(
    df: pd.DataFrame,
    trust_threshold: float = 50.0,
    ml_threshold: float = 0.4,
    ml_probs: np.ndarray = None,
    stake: float = 100.0,
) -> dict:
    """
    Simulate hypothetical P&L under three strategies:
    1. No filter (trade all markets)
    2. Trust score filter (trade only if trust >= threshold)
    3. ML filter (trade only if ML risk < ml_threshold)
    4. Combined (trust >= threshold AND ML risk < ml_threshold)
    """
    risk_label = construct_labels(df)
    n = len(df)

    def calc_pnl(mask: pd.Series, name: str) -> dict:
        """For each accepted trade: win if NOT risky, lose if risky."""
        accepted    = mask.sum()
        risky_in    = (mask & (risk_label == 1)).sum()
        safe_in     = accepted - risky_in
        pnl         = (safe_in - risky_in) * stake
        risk_rate   = risky_in / max(accepted, 1)
        return {
            "strategy": name,
            "n_accepted": int(accepted),
            "n_risky":    int(risky_in),
            "n_safe":     int(safe_in),
            "risk_rate":  round(risk_rate, 4),
            "pnl":        round(pnl, 2),
            "pnl_per_trade": round(pnl / max(accepted, 1), 2),
        }

    results = []

    # 1. No filter
    results.append(calc_pnl(pd.Series([True] * n), "No Filter"))

    # 2. Trust score filter
    if "composite_score" in df.columns:
        trust_mask = df["composite_score"].fillna(0) >= trust_threshold
        results.append(calc_pnl(trust_mask, f"Trust ≥ {trust_threshold}"))

    # 3. ML filter
    if ml_probs is not None:
        ml_mask = pd.Series(ml_probs < ml_threshold, index=df.index[-len(ml_probs):])
        ml_mask = ml_mask.reindex(df.index, fill_value=False)
        results.append(calc_pnl(ml_mask, f"ML Risk < {ml_threshold}"))

        # 4. Combined
        if "composite_score" in df.columns:
            combined = trust_mask & ml_mask
            results.append(calc_pnl(combined, f"Trust ≥ {trust_threshold} + ML < {ml_threshold}"))

    return results


# ═══════════════════════════════════════════════════════════════
# STEP 5: Trust Score vs Outcome Analysis (Chi-Square)
# ═══════════════════════════════════════════════════════════════

def chi_square_analysis(df: pd.DataFrame, threshold: float = 50.0) -> dict:
    """Run the chi-square test: Trust Score < threshold → higher risk rate?"""
    risk_label = construct_labels(df)

    low  = df[df["composite_score"] < threshold]
    high = df[df["composite_score"] >= threshold]

    risk_low  = risk_label[low.index]
    risk_high = risk_label[high.index]

    n_low, n_high = len(low), len(high)
    d_low, d_high = int(risk_low.sum()), int(risk_high.sum())

    rate_low  = d_low / max(n_low, 1)
    rate_high = d_high / max(n_high, 1)
    lift      = rate_low / max(rate_high, 0.001)

    table = [[d_low, n_low - d_low], [d_high, n_high - d_high]]
    if n_low > 0 and n_high > 0:
        chi2, p, dof, _ = stats.chi2_contingency(table, correction=False)
    else:
        chi2, p, dof = 0, 1, 1

    return {
        "threshold":         threshold,
        "n_low_trust":       n_low,
        "n_high_trust":      n_high,
        "risk_rate_low":     round(rate_low, 4),
        "risk_rate_high":    round(rate_high, 4),
        "lift_ratio":        round(lift, 3),
        "chi2":              round(chi2, 4),
        "p_value":           round(p, 6),
        "is_significant":    p < 0.05,
    }


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="ML-enhanced backtest")
    parser.add_argument("--model", choices=["lgbm", "xgboost", "gbm"], default="gbm",
                        help="Boosted model type (gbm=sklearn fallback)")
    parser.add_argument("--trust-threshold", type=float, default=50.0)
    parser.add_argument("--ml-threshold",    type=float, default=0.4)
    parser.add_argument("--n-splits",        type=int,   default=5)
    args = parser.parse_args()

    os.makedirs(RESULTS_DIR, exist_ok=True)

    # ── Load data ──────────────────────────────────────────────
    print("Loading data...")
    markets = pd.read_parquet(os.path.join(DATA_DIR, "markets_history.parquet"))
    trust   = pd.read_parquet(os.path.join(DATA_DIR, "trust_scores_historical.parquet"))
    print(f"  {len(markets)} markets, {len(trust)} trust scores")

    # ── Feature engineering ────────────────────────────────────
    print("\nEngineering features...")
    df, feature_cols = engineer_features(markets, trust)
    print(f"  {len(feature_cols)} features: {feature_cols[:10]}...")

    # ── Chi-square: traditional trust score analysis ───────────
    print("\n" + "="*60)
    print("CHI-SQUARE: TRUST SCORE vs RESOLUTION RISK")
    print("="*60)
    for thr in [30, 40, 50, 60, 70]:
        result = chi_square_analysis(df, thr)
        sig = "✅" if result["is_significant"] else "❌"
        print(f"  Threshold={thr:2d}: Low={result['risk_rate_low']*100:5.1f}% "
              f"High={result['risk_rate_high']*100:5.1f}% "
              f"Lift={result['lift_ratio']:.2f}x p={result['p_value']:.4f} {sig}")

    # ── ML model training ─────────────────────────────────────
    print("\n" + "="*60)
    print(f"ML MODEL: {args.model.upper()} — Walk-Forward Validation")
    print("="*60)
    ml_results = train_and_evaluate(
        df, feature_cols, model_type=args.model, n_splits=args.n_splits
    )

    print(f"\n  Overall AUC-ROC (uncal): {ml_results['auc_roc']:.4f}")
    print(f"  Overall AUC-ROC (cal):   {ml_results['auc_roc_cal']:.4f}")
    print(f"  Brier Score (uncal):     {ml_results['brier_uncal']:.6f}")
    print(f"  Brier Score (cal):       {ml_results['brier_cal']:.6f}")
    print(f"  Log-loss (uncal):        {ml_results['logloss_uncal']:.6f}")
    print(f"  Log-loss (cal):          {ml_results['logloss_cal']:.6f}")

    print("\n  Top 10 Features:")
    for feat in ml_results["top_features"][:10]:
        print(f"    {feat['feature']:30s}  {feat['importance']:.4f}")

    # ── P&L simulation ────────────────────────────────────────
    print("\n" + "="*60)
    print("P&L SIMULATION (hypothetical $100/trade)")
    print("="*60)
    pnl_results = simulate_pnl(
        df,
        trust_threshold=args.trust_threshold,
        ml_threshold=args.ml_threshold,
        ml_probs=ml_results["all_y_prob_cal"],
        stake=100,
    )
    print(f"\n  {'Strategy':<45} {'Accepted':<10} {'Risk%':<10} {'P&L':<12} {'Per Trade'}")
    for r in pnl_results:
        print(f"  {r['strategy']:<45} {r['n_accepted']:<10} "
              f"{r['risk_rate']*100:6.1f}%   ${r['pnl']:>10,.2f}   ${r['pnl_per_trade']:>7.2f}")

    # ── Save results ──────────────────────────────────────────
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    output = {
        "timestamp":      ts,
        "model":          args.model,
        "n_markets":      len(df),
        "chi_square":     {str(t): chi_square_analysis(df, t) for t in [30,40,50,60,70]},
        "ml_metrics": {
            k: v for k, v in ml_results.items()
            if k not in ("all_y_true", "all_y_prob", "all_y_prob_cal")
        },
        "pnl_simulation": pnl_results,
    }
    out_path = os.path.join(RESULTS_DIR, f"ml_backtest_{ts}.json")
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\n  Results saved: {out_path}")


if __name__ == "__main__":
    main()
