"""
Portfolio construction comparison: equal-weight vs risk-parity vs mean-variance.

Wraps the primitives already in backtest.engine.portfolio and returns a single
payload suitable for UI rendering (weights, metrics, correlation matrix).
"""

from __future__ import annotations

from typing import Mapping

import numpy as np
import pandas as pd

from backtest.engine.portfolio import PortfolioAggregator


class PortfolioComparison:
    """Compare portfolio construction methods on the same strategy panel."""

    def __init__(self, config: dict | None = None):
        self.config = config or {}
        self._agg = PortfolioAggregator(self.config)

    # ── Private helpers ─────────────────────────────────────────────────

    @staticmethod
    def _annualize_sharpe(r: pd.Series) -> float:
        r = r.dropna()
        if r.empty:
            return 0.0
        sd = float(r.std(ddof=1))
        if sd == 0:
            return 0.0
        return float(r.mean() / sd * np.sqrt(252))

    @staticmethod
    def _ann_return(r: pd.Series) -> float:
        r = r.dropna()
        if r.empty:
            return 0.0
        return float(r.mean() * 252)

    @staticmethod
    def _ann_vol(r: pd.Series) -> float:
        r = r.dropna()
        if r.empty:
            return 0.0
        return float(r.std(ddof=1) * np.sqrt(252))

    @staticmethod
    def _max_drawdown(r: pd.Series) -> float:
        r = r.dropna()
        if r.empty:
            return 0.0
        eq = (1.0 + r).cumprod()
        peak = eq.cummax()
        dd = eq / peak - 1.0
        return float(dd.min())

    def _metrics_for(self, weights: pd.Series, returns: Mapping[str, pd.Series]) -> dict:
        port = self._agg.apply_weights(dict(returns), weights)
        return {
            "weights": {k: float(v) for k, v in weights.items()},
            "sharpe": round(self._annualize_sharpe(port), 4),
            "ann_return": round(self._ann_return(port), 6),
            "ann_vol": round(self._ann_vol(port), 6),
            "max_drawdown": round(self._max_drawdown(port), 6),
        }

    # ── Public API ──────────────────────────────────────────────────────

    def compare(self, strategy_returns: Mapping[str, pd.Series]) -> dict:
        """
        Run equal-weight, risk-parity, and mean-variance (tangency, long-only)
        portfolio construction on the same strategy panel.

        Returns
        -------
        dict with keys:
            - strategy_names : list of input column names in order
            - methods : {method_name: {weights, sharpe, ann_return, ann_vol, max_drawdown}}
            - correlation_matrix : nested dict corr[i][j]
            - avg_pairwise_correlation : float, off-diagonal mean
        """
        names = list(strategy_returns.keys())
        if not names:
            return {
                "strategy_names": [],
                "methods": {},
                "correlation_matrix": {},
                "avg_pairwise_correlation": 0.0,
            }

        df = pd.DataFrame(strategy_returns).dropna()

        # 1) Equal weight — uniform.
        n = len(names)
        eq_w = pd.Series(np.full(n, 1.0 / n), index=names)

        # 2) Risk parity (ERC).
        rp_w = self._agg.risk_parity_weights(dict(strategy_returns))
        if rp_w.empty:
            rp_w = eq_w.copy()
        rp_w = rp_w.reindex(names).fillna(0.0)
        rp_w = rp_w / rp_w.sum() if rp_w.sum() > 0 else eq_w

        # 3) Mean-variance (tangency, long-only by default).
        mv_w = self._agg.mean_variance_weights(dict(strategy_returns))
        if mv_w.empty:
            mv_w = eq_w.copy()
        mv_w = mv_w.reindex(names).fillna(0.0)
        mv_w = mv_w / mv_w.sum() if mv_w.sum() > 0 else eq_w

        methods = {
            "equal_weight": self._metrics_for(eq_w, strategy_returns),
            "risk_parity": self._metrics_for(rp_w, strategy_returns),
            "mean_variance": self._metrics_for(mv_w, strategy_returns),
        }

        # Correlation matrix.
        corr_df = df.corr()
        corr_dict = {
            i: {j: float(round(corr_df.loc[i, j], 4)) for j in corr_df.columns}
            for i in corr_df.index
        }

        # Average off-diagonal correlation.
        if n >= 2:
            mat = corr_df.values
            off = mat[~np.eye(n, dtype=bool)]
            avg_corr = float(round(np.mean(off), 4))
        else:
            avg_corr = 0.0

        return {
            "strategy_names": names,
            "methods": methods,
            "correlation_matrix": corr_dict,
            "avg_pairwise_correlation": avg_corr,
        }
