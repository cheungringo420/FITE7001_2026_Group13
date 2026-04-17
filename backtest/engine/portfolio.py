"""
Multi-strategy portfolio aggregation.
Combines returns from multiple strategies with correlation-aware weighting.
"""

import pandas as pd
import numpy as np
from typing import Optional

from scipy.optimize import minimize


class PortfolioAggregator:
    """Aggregate multiple strategy return streams into a portfolio."""

    def __init__(self, config: dict):
        self.config = config
        self.initial_capital = config.get("risk", {}).get("initial_capital", 100000)

    def equal_weight(self, strategy_returns: dict[str, pd.Series]) -> pd.Series:
        """Equal-weight portfolio of all strategies."""
        if not strategy_returns:
            return pd.Series(dtype=float)

        df = pd.DataFrame(strategy_returns)
        return df.mean(axis=1)

    def inverse_vol_weight(self, strategy_returns: dict[str, pd.Series], lookback: int = 60) -> pd.Series:
        """Inverse-volatility weighted portfolio."""
        df = pd.DataFrame(strategy_returns)
        if df.empty:
            return pd.Series(dtype=float)

        rolling_vol = df.rolling(lookback, min_periods=20).std()
        inv_vol = 1.0 / rolling_vol.clip(lower=0.001)
        weights = inv_vol.div(inv_vol.sum(axis=1), axis=0)
        return (df * weights).sum(axis=1)

    def aggregate(
        self,
        strategy_returns: dict[str, pd.Series],
        method: str = "equal_weight",
    ) -> pd.Series:
        """Aggregate strategy returns using specified method."""
        if method == "equal_weight":
            return self.equal_weight(strategy_returns)
        elif method == "inverse_vol":
            return self.inverse_vol_weight(strategy_returns)
        else:
            return self.equal_weight(strategy_returns)

    def compute_portfolio_equity(
        self, portfolio_returns: pd.Series, initial_capital: Optional[float] = None
    ) -> pd.Series:
        """Compute equity curve from portfolio returns."""
        cap = initial_capital or self.initial_capital
        return (1 + portfolio_returns).cumprod() * cap

    def correlation_matrix(self, strategy_returns: dict[str, pd.Series]) -> pd.DataFrame:
        """Compute pairwise correlation between strategies."""
        df = pd.DataFrame(strategy_returns)
        return df.corr()

    def strategy_contribution(
        self, strategy_returns: dict[str, pd.Series], weights: Optional[dict] = None
    ) -> pd.DataFrame:
        """Break down portfolio return into strategy contributions."""
        df = pd.DataFrame(strategy_returns)
        if weights is None:
            n = len(df.columns)
            weights = {col: 1.0 / n for col in df.columns}

        contributions = pd.DataFrame()
        for col in df.columns:
            contributions[col] = df[col] * weights.get(col, 0)

        contributions["total"] = contributions.sum(axis=1)
        return contributions

    # ── Advanced portfolio construction ─────────────────────────────────────

    def risk_parity_weights(self, strategy_returns: dict[str, pd.Series]) -> pd.Series:
        """
        Equal-risk-contribution (ERC) portfolio. Uses iterative scheme (Maillard
        et al., 2010) — converges quickly for small N.

        Each asset's contribution to portfolio variance is equalized:
            MRC_i = (Sigma @ w)_i
            RC_i  = w_i * MRC_i
            Target: RC_i = RC_j for all i, j
        """
        df = pd.DataFrame(strategy_returns).dropna()
        cols = list(df.columns)
        if df.empty or len(cols) == 0:
            return pd.Series(dtype=float)

        cov = df.cov().values
        n = len(cols)

        def objective(w):
            w = np.asarray(w)
            port_vol = np.sqrt(w @ cov @ w)
            if port_vol <= 0:
                return 1e10
            mrc = cov @ w
            rc = w * mrc / port_vol
            return float(((rc[:, None] - rc[None, :]) ** 2).sum())

        w0 = np.full(n, 1.0 / n)
        cons = [{"type": "eq", "fun": lambda w: w.sum() - 1.0}]
        bounds = [(1e-6, 1.0)] * n
        res = minimize(
            objective, w0, method="SLSQP", bounds=bounds, constraints=cons,
            options={"ftol": 1e-10, "maxiter": 500},
        )
        w = res.x if res.success else w0
        return pd.Series(w / w.sum(), index=cols)

    def mean_variance_weights(
        self,
        strategy_returns: dict[str, pd.Series],
        target_return: Optional[float] = None,
        long_only: bool = True,
    ) -> pd.Series:
        """
        Markowitz mean-variance optimization.

        If target_return is None, maximizes Sharpe (tangency portfolio).
        Otherwise, minimizes variance subject to mean(portfolio) >= target_return.

        long_only: enforces w_i >= 0. Weights always sum to 1.
        """
        df = pd.DataFrame(strategy_returns).dropna()
        cols = list(df.columns)
        if df.empty or len(cols) == 0:
            return pd.Series(dtype=float)

        mu = df.mean().values
        cov = df.cov().values
        n = len(cols)

        bounds = [(0.0, 1.0)] * n if long_only else [(-1.0, 1.0)] * n

        if target_return is None:
            # Tangency / max Sharpe: maximize mu'w / sqrt(w'Σw)
            def neg_sharpe(w):
                w = np.asarray(w)
                port_ret = float(mu @ w)
                port_vol = float(np.sqrt(w @ cov @ w))
                if port_vol <= 0:
                    return 1e10
                return -port_ret / port_vol

            cons = [{"type": "eq", "fun": lambda w: w.sum() - 1.0}]
            w0 = np.full(n, 1.0 / n)
            res = minimize(
                neg_sharpe, w0, method="SLSQP", bounds=bounds, constraints=cons,
                options={"ftol": 1e-10, "maxiter": 500},
            )
        else:
            def port_var(w):
                w = np.asarray(w)
                return float(w @ cov @ w)

            cons = [
                {"type": "eq", "fun": lambda w: w.sum() - 1.0},
                {"type": "ineq", "fun": lambda w, m=mu, t=target_return: float(m @ w) - t},
            ]
            w0 = np.full(n, 1.0 / n)
            res = minimize(
                port_var, w0, method="SLSQP", bounds=bounds, constraints=cons,
                options={"ftol": 1e-10, "maxiter": 500},
            )

        w = res.x if res.success else np.full(n, 1.0 / n)
        w = np.maximum(w, 0.0) if long_only else w
        total = w.sum()
        if total > 0:
            w = w / total
        return pd.Series(w, index=cols)

    def apply_weights(
        self, strategy_returns: dict[str, pd.Series], weights: pd.Series
    ) -> pd.Series:
        """Apply fixed weights to strategy returns to get portfolio series."""
        df = pd.DataFrame(strategy_returns)
        aligned = weights.reindex(df.columns).fillna(0.0)
        return (df * aligned).sum(axis=1)
