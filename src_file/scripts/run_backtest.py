#!/usr/bin/env python3
"""
Step 5: Run the backtest — test whether Trust Score predicts dispute events.
Hypothesis H1: Markets with Trust Score < threshold have >= 2x dispute rate
               compared to markets with Trust Score >= threshold.

Statistical tests: Chi-Square contingency + Logistic Regression + AUC-ROC

Usage:
  python3 src_file/scripts/run_backtest.py
  python3 src_file/scripts/run_backtest.py --threshold 50 --push-supabase
  python3 src_file/scripts/run_backtest.py --sweep  # test multiple thresholds
"""
import argparse
import json
import os
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd
import scipy.stats as stats

REPO_ROOT   = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR    = os.path.join(REPO_ROOT, "data")
RESULTS_DIR = os.path.join(DATA_DIR, "backtest_results")


def load_joined_data() -> pd.DataFrame:
    """Load the joined trust + dispute dataset."""
    path = os.path.join(DATA_DIR, "trust_with_disputes.parquet")
    if not os.path.exists(path):
        # Auto-run join if not done yet
        print("trust_with_disputes.parquet not found — running join step...")
        import subprocess
        subprocess.run(["python3", os.path.join(os.path.dirname(__file__), "join_trust_to_disputes.py")], check=True)
    return pd.read_parquet(path)


def run_chi_square_test(df: pd.DataFrame, threshold: float) -> dict:
    """
    Chi-square contingency test:
    H0: Trust Score is independent of dispute outcome
    H1: Low trust score markets dispute at a higher rate
    """
    low_trust  = df[df["composite_score"] <  threshold]
    high_trust = df[df["composite_score"] >= threshold]

    n_low          = len(low_trust)
    n_high         = len(high_trust)
    disputed_low   = int(low_trust["disputed"].sum())
    disputed_high  = int(high_trust["disputed"].sum())
    resolved_low   = n_low  - disputed_low
    resolved_high  = n_high - disputed_high

    if n_low == 0 or n_high == 0:
        return {"error": "Insufficient data for threshold"}

    contingency = [
        [disputed_low,  resolved_low],
        [disputed_high, resolved_high],
    ]
    chi2, p, dof, _ = stats.chi2_contingency(contingency, correction=False)

    rate_low  = disputed_low  / n_low  if n_low  > 0 else 0
    rate_high = disputed_high / n_high if n_high > 0 else 0
    lift      = rate_low / rate_high   if rate_high > 0 else float("inf")

    return {
        "threshold":              threshold,
        "n_low_trust":            n_low,
        "n_high_trust":           n_high,
        "disputed_low_trust":     disputed_low,
        "disputed_high_trust":    disputed_high,
        "dispute_rate_low":       round(rate_low,  4),
        "dispute_rate_high":      round(rate_high, 4),
        "overall_dispute_rate":   round(df["disputed"].mean(), 4),
        "lift_ratio":             round(lift, 3),
        "chi2_statistic":         round(float(chi2), 4),
        "p_value":                round(float(p), 6),
        "degrees_of_freedom":     int(dof),
        "is_significant":         bool(p < 0.05),
    }


def run_logistic_regression(df: pd.DataFrame) -> dict:
    """
    Logistic regression: P(dispute) ~ trust_score
    Tests if trust score is a significant continuous predictor.
    """
    try:
        from sklearn.linear_model import LogisticRegression
        from sklearn.metrics import roc_auc_score
        from sklearn.preprocessing import StandardScaler

        X = df[["composite_score"]].values
        y = df["disputed"].values.astype(int)

        if y.sum() == 0 or y.sum() == len(y):
            return {"error": "No variation in outcome — cannot fit logistic regression"}

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        model = LogisticRegression(random_state=42)
        model.fit(X_scaled, y)

        coef       = float(model.coef_[0][0])
        y_prob     = model.predict_proba(X_scaled)[:, 1]
        auc        = roc_auc_score(y, y_prob)

        # Wald test p-value approximation
        n          = len(y)
        se         = np.sqrt(model.coef_[0][0]**2 / n)  # simplified
        z          = coef / max(se, 1e-10)
        p_val      = float(2 * (1 - stats.norm.cdf(abs(z))))

        return {
            "log_reg_coef_trust": round(coef, 4),
            "log_reg_p_value":    round(p_val, 6),
            "auc_roc":            round(auc, 4),
        }
    except ImportError:
        print("  Warning: scikit-learn not installed — skipping logistic regression")
        return {}
    except Exception as e:
        return {"log_reg_error": str(e)}


def run_dispute_rate_by_decile(df: pd.DataFrame) -> list[dict]:
    """Compute dispute rate for each trust score decile (for chart)."""
    df = df.copy()
    df["decile"] = pd.cut(df["composite_score"], bins=10, labels=False)
    
    rows = []
    for decile in range(10):
        subset = df[df["decile"] == decile]
        if len(subset) == 0:
            continue
        low_bound  = decile * 10
        high_bound = low_bound + 10
        rows.append({
            "decile":        decile,
            "score_range":   f"{low_bound}–{high_bound}",
            "n_markets":     len(subset),
            "n_disputed":    int(subset["disputed"].sum()),
            "dispute_rate":  round(subset["disputed"].mean(), 4),
        })
    return rows


def push_to_supabase(result: dict, run_name: str) -> None:
    from supabase import create_client
    from dotenv import load_dotenv
    load_dotenv()
    
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    client = create_client(url, key)
    
    row = {
        "run_name":             run_name,
        "methodology_ver":      "v1.0",
        "total_markets":        result.get("n_low_trust", 0) + result.get("n_high_trust", 0),
        "platform_filter":      "polymarket",
        **{k: v for k, v in result.items() if not k.startswith("decile")},
        **result.get("logistic", {}),
    }
    # Remove non-column keys
    for bad in ["error", "log_reg_error"]:
        row.pop(bad, None)

    client.table("backtest_runs").insert(row).execute()
    print("  Result written to Supabase backtest_runs table")


def print_report(result: dict, deciles: list[dict]) -> None:
    print("\n" + "="*60)
    print("BACKTEST RESULTS")
    print("="*60)
    thr = result["threshold"]
    print(f"\nThreshold: Trust Score < {thr}")
    print(f"  Total markets analysed: {result['n_low_trust'] + result['n_high_trust']:,}")
    print(f"  Low trust  (< {thr}):  {result['n_low_trust']:,} markets, "
          f"{result['dispute_rate_low']*100:.2f}% disputed")
    print(f"  High trust (>= {thr}): {result['n_high_trust']:,} markets, "
          f"{result['dispute_rate_high']*100:.2f}% disputed")
    print(f"\n  Lift ratio:       {result['lift_ratio']:.2f}x")
    print(f"  Chi² statistic:   {result['chi2_statistic']:.4f}")
    print(f"  p-value:          {result['p_value']:.6f}")
    
    sig = "✅ SIGNIFICANT (p < 0.05)" if result["is_significant"] else "❌ Not significant (p >= 0.05)"
    print(f"  Result:           {sig}")
    
    if result["is_significant"] and result["lift_ratio"] >= 2.0:
        print("\n  ⭐ H1 SUPPORTED: Low-trust markets dispute at >= 2x the rate of high-trust markets")
    elif result["is_significant"]:
        print("\n  ✓ Directional effect confirmed but lift < 2x")
    else:
        print("\n  H0 not rejected at alpha=0.05")
    
    if "auc_roc" in result.get("logistic", {}):
        print(f"\n  Logistic Regression AUC-ROC: {result['logistic']['auc_roc']:.3f}")
        print(f"  Coefficient (trust score):   {result['logistic']['log_reg_coef_trust']:.4f}")
    
    print("\nDispute Rate by Decile:")
    print(f"  {'Decile':<12} {'N Markets':<12} {'N Disputed':<12} {'Dispute Rate'}")
    for d in deciles:
        print(f"  {d['score_range']:<12} {d['n_markets']:<12} {d['n_disputed']:<12} {d['dispute_rate']*100:.2f}%")


def main():
    parser = argparse.ArgumentParser(description="Run PMv12 Trust Score Backtest")
    parser.add_argument("--threshold",     type=float, default=50.0)
    parser.add_argument("--date-from",     type=str,   default="2022-01-01")
    parser.add_argument("--date-to",       type=str,   default="2025-12-31")
    parser.add_argument("--category",      type=str,   default=None)
    parser.add_argument("--run-name",      type=str,   default=None)
    parser.add_argument("--sweep",         action="store_true",
                        help="Test multiple thresholds (30,40,50,60,70)")
    parser.add_argument("--push-supabase", action="store_true")
    args = parser.parse_args()

    os.makedirs(RESULTS_DIR, exist_ok=True)

    print(f"Loading joined dataset...")
    df = load_joined_data()
    print(f"  {len(df)} markets with trust scores and dispute labels")

    # Date filter
    if "resolved_at" in df.columns:
        df["resolved_at"] = pd.to_datetime(df["resolved_at"], utc=True, errors="coerce")
        df = df[
            (df["resolved_at"] >= args.date_from) &
            (df["resolved_at"] <= args.date_to)
        ]
        print(f"  {len(df)} markets after date filter ({args.date_from} → {args.date_to})")

    # Category filter
    if args.category:
        df = df[df["category"].str.lower() == args.category.lower()]
        print(f"  {len(df)} markets in category '{args.category}'")

    thresholds = [30, 40, 50, 60, 70] if args.sweep else [args.threshold]
    all_results = []

    for thr in thresholds:
        print(f"\nRunning test for threshold = {thr}...")
        result = run_chi_square_test(df, thr)
        logistic = run_logistic_regression(df)
        result["logistic"] = logistic
        deciles  = run_dispute_rate_by_decile(df)
        all_results.append({"threshold": thr, "result": result, "deciles": deciles})

        print_report(result, deciles)
        
        # Save individual result
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        run_name = args.run_name or f"backtest_thr{int(thr)}_{ts}"
        
        out = {
            "run_name": run_name,
            "threshold": thr,
            "date_from": args.date_from,
            "date_to":   args.date_to,
            "category":  args.category,
            "chi_square": result,
            "logistic":   logistic,
            "decile_breakdown": deciles,
        }
        out_path = os.path.join(RESULTS_DIR, f"{run_name}.json")
        with open(out_path, "w") as f:
            json.dump(out, f, indent=2, default=str)
        print(f"\n  Result saved: {out_path}")

        if args.push_supabase:
            push_to_supabase({**result, "logistic": logistic}, run_name)

    # Summary sweep table
    if args.sweep:
        print("\n\nSWEEP SUMMARY:")
        print(f"{'Threshold':<12} {'Lift':<8} {'p-value':<12} {'Significant'}")
        for r in all_results:
            res = r["result"]
            print(f"{r['threshold']:<12.0f} {res.get('lift_ratio', 0):<8.2f} "
                  f"{res.get('p_value', 1):<12.6f} {'Yes' if res.get('is_significant') else 'No'}")


if __name__ == "__main__":
    main()
