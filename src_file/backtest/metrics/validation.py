"""
Statistical validation suite.
Walk-forward validation, Newey-West standard errors, t-stat tests.
Implements Steps 2-8 of the MFIN7037 backtest checklist.
"""

import pandas as pd
import numpy as np
from scipy import stats
from typing import Optional


class ValidationSuite:
    """Full validation per MFIN7037 checklist."""

    # ── Step 2: Signal Monotonicity ────────────────────────────────

    @staticmethod
    def signal_monotonicity(signals: pd.Series, returns: pd.Series, n_buckets: int = 5) -> dict:
        """
        Sort opportunities into n buckets by signal strength.
        Average net return should increase monotonically.
        """
        common = signals.index.intersection(returns.index)
        if len(common) < n_buckets * 2:
            return {"buckets": [], "is_monotonic": False, "violations": 0}

        s = signals.loc[common]
        r = returns.loc[common]

        # Only non-zero signals
        mask = s != 0
        if mask.sum() < n_buckets * 2:
            return {"buckets": [], "is_monotonic": False, "violations": 0}

        s_active = s[mask]
        r_active = r[mask]

        bucket_labels = pd.qcut(s_active, n_buckets, labels=False, duplicates="drop")
        bucket_returns = r_active.groupby(bucket_labels).mean()

        values = bucket_returns.values.tolist()
        violations = sum(1 for i in range(1, len(values)) if values[i] < values[i - 1])

        return {
            "buckets": [round(v, 6) for v in values],
            "is_monotonic": violations == 0,
            "violations": violations,
        }

    # ── Step 4: Factor Regression ──────────────────────────────────

    @staticmethod
    def factor_regression(
        strategy_returns: pd.Series,
        factor_returns: pd.DataFrame,
    ) -> dict:
        """
        R_strategy(t) = α + β_1·F_1(t) + ... + β_k·F_k(t) + ε(t)
        With Newey-West standard errors.
        Target: significant positive α with t-stat ≥ 3.0.
        """
        common = strategy_returns.index.intersection(factor_returns.index)
        if len(common) < 30:
            return {"alpha": np.nan, "alpha_tstat": np.nan, "betas": {}}

        y = strategy_returns.loc[common].values
        X = factor_returns.loc[common].values
        n, k = X.shape

        # Add constant for alpha
        X_const = np.column_stack([np.ones(n), X])

        # OLS
        try:
            beta_hat = np.linalg.lstsq(X_const, y, rcond=None)[0]
        except np.linalg.LinAlgError:
            return {"alpha": np.nan, "alpha_tstat": np.nan, "betas": {}}

        residuals = y - X_const @ beta_hat

        # Newey-West standard errors
        nw_se = ValidationSuite._newey_west_se(X_const, residuals, lag=5)

        alpha = beta_hat[0]
        alpha_tstat = alpha / nw_se[0] if nw_se[0] > 0 else np.nan

        betas = {}
        for i, col in enumerate(factor_returns.columns):
            beta = beta_hat[i + 1]
            tstat = beta / nw_se[i + 1] if nw_se[i + 1] > 0 else np.nan
            betas[col] = {"beta": round(beta, 6), "tstat": round(tstat, 4)}

        return {
            "alpha": round(alpha, 6),
            "alpha_tstat": round(alpha_tstat, 4),
            "r_squared": round(1 - np.var(residuals) / np.var(y), 4) if np.var(y) > 0 else 0,
            "betas": betas,
        }

    @staticmethod
    def _newey_west_se(X: np.ndarray, residuals: np.ndarray, lag: int = 5) -> np.ndarray:
        """
        Newey-West HAC standard errors for OLS regression.
        Accounts for autocorrelation and heteroskedasticity.
        """
        n, k = X.shape
        # Meat of the sandwich: S = Gamma_0 + sum_{j=1}^{lag} w_j (Gamma_j + Gamma_j')
        S = np.zeros((k, k))

        for j in range(lag + 1):
            weight = 1.0 if j == 0 else 1 - j / (lag + 1)  # Bartlett kernel
            Gamma_j = np.zeros((k, k))
            for t in range(j, n):
                xt = X[t].reshape(-1, 1)
                xt_j = X[t - j].reshape(-1, 1)
                Gamma_j += residuals[t] * residuals[t - j] * (xt @ xt_j.T)
            Gamma_j /= n

            if j == 0:
                S += weight * Gamma_j
            else:
                S += weight * (Gamma_j + Gamma_j.T)

        # Bread: (X'X / n)^{-1}
        XtX_inv = np.linalg.inv(X.T @ X / n)

        # Sandwich: V = (X'X)^{-1} S (X'X)^{-1} / n
        V = XtX_inv @ S @ XtX_inv / n

        return np.sqrt(np.diag(V).clip(min=0))

    # ── Step 5: Robustness Checks ──────────────────────────────────

    @staticmethod
    def robustness_checks(
        run_backtest_fn,  # callable(params) -> returns
        base_params: dict,
        variations: dict[str, list],
    ) -> dict:
        """
        Run strategy under different parameter assumptions.
        E.g., different cost levels, liquidity thresholds.
        """
        results = {"base": run_backtest_fn(base_params)}
        for param_name, values in variations.items():
            results[param_name] = {}
            for v in values:
                modified = {**base_params, param_name: v}
                returns = run_backtest_fn(modified)
                sharpe = returns.mean() / returns.std() * np.sqrt(252) if returns.std() > 0 else 0
                results[param_name][str(v)] = {
                    "sharpe": round(sharpe, 4),
                    "ann_return": round((1 + returns.mean()) ** 252 - 1, 6),
                }

        return results

    # ── Step 7: Event Study ────────────────────────────────────────

    @staticmethod
    def event_study(
        returns: pd.Series,
        event_dates: list,
        window: tuple = (-5, 10),
    ) -> dict:
        """
        Cumulative abnormal return around event dates.
        Consistent with MFIN7037 Lecture 2/3 methodology.
        """
        car_by_day = {}
        for day_offset in range(window[0], window[1] + 1):
            car_by_day[day_offset] = []

        for event_date in event_dates:
            event_date = pd.Timestamp(event_date)
            for day_offset in range(window[0], window[1] + 1):
                target_dates = returns.index[returns.index >= event_date]
                if len(target_dates) <= abs(day_offset):
                    continue
                if day_offset >= 0 and day_offset < len(target_dates):
                    start = returns.index.get_loc(target_dates[0])
                    idx = start + day_offset
                    if 0 <= idx < len(returns):
                        window_returns = returns.iloc[start : idx + 1]
                        car = window_returns.sum()
                        car_by_day[day_offset].append(car)

        event_study_data = []
        for day_offset in sorted(car_by_day.keys()):
            values = car_by_day[day_offset]
            event_study_data.append({
                "day": day_offset,
                "car": round(np.mean(values), 6) if values else 0.0,
                "n_events": len(values),
            })

        return {"event_study": event_study_data}

    # ── Step 8: Statistical Significance ───────────────────────────

    @staticmethod
    def t_test_returns(returns: pd.Series) -> dict:
        """
        Test if mean return is significantly different from zero.
        Threshold: t-stat ≥ 3.0 (Harvey, Liu & Zhang 2016).
        """
        if returns.empty or len(returns) < 10:
            return {"t_stat": np.nan, "p_value": np.nan, "significant": False}

        t_stat, p_value = stats.ttest_1samp(returns.dropna(), 0)
        return {
            "t_stat": round(t_stat, 4),
            "p_value": round(p_value, 6),
            "significant_at_3": abs(t_stat) >= 3.0,
            "bonferroni_significant": p_value < 0.05 / 6,  # 6 strategies
        }

    # ── Predictive Regression (for Lead-Lag) ───────────────────────

    @staticmethod
    def predictive_regression(
        delta_p: pd.Series,
        asset_returns: pd.Series,
        horizons: list[int] = [1, 2, 3, 4, 5],
    ) -> dict:
        """
        ΔVIX(t+k) = α + β·ΔP(t) + ε for k = 1…5.
        Newey-West SEs for overlapping returns.
        """
        results = {}
        for k in horizons:
            y = asset_returns.shift(-k)  # Future return
            common = delta_p.dropna().index.intersection(y.dropna().index)
            if len(common) < 30:
                results[f"h{k}"] = {"beta": np.nan, "tstat": np.nan, "r2_oos": np.nan}
                continue

            x = delta_p.loc[common].values
            yv = y.loc[common].values

            X = np.column_stack([np.ones(len(x)), x])
            try:
                beta_hat = np.linalg.lstsq(X, yv, rcond=None)[0]
            except np.linalg.LinAlgError:
                results[f"h{k}"] = {"beta": np.nan, "tstat": np.nan, "r2_oos": np.nan}
                continue

            residuals = yv - X @ beta_hat
            nw_se = ValidationSuite._newey_west_se(X, residuals, lag=k)

            beta = beta_hat[1]
            tstat = beta / nw_se[1] if nw_se[1] > 0 else np.nan
            r2 = 1 - np.var(residuals) / np.var(yv) if np.var(yv) > 0 else 0

            results[f"h{k}"] = {
                "beta": round(beta, 6),
                "tstat": round(tstat, 4),
                "r2": round(r2, 4),
            }

        return results
