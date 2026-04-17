"""
Monte Carlo bootstrap for Sharpe ratio, max drawdown, and annualized return
confidence intervals. Supports iid and block bootstrap.

References:
    Politis & Romano (1994) stationary block bootstrap.
    Lo (2002) Statistics of Sharpe ratios.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


class MonteCarloAnalysis:
    """Bootstrap confidence intervals for strategy performance metrics."""

    def __init__(self, n_simulations: int = 1000, seed: int | None = None, ci: float = 0.95):
        self.n_simulations = n_simulations
        self.ci = ci
        self._rng = np.random.default_rng(seed)

    # ── Resampling primitives ───────────────────────────────────────────────

    def _iid_resample(self, values: np.ndarray) -> np.ndarray:
        idx = self._rng.integers(0, len(values), size=len(values))
        return values[idx]

    def _block_resample(self, values: np.ndarray, block_size: int) -> np.ndarray:
        n = len(values)
        if block_size >= n:
            return self._iid_resample(values)
        n_blocks = int(np.ceil(n / block_size))
        starts = self._rng.integers(0, n - block_size + 1, size=n_blocks)
        blocks = [values[s : s + block_size] for s in starts]
        return np.concatenate(blocks)[:n]

    # ── Metric calculators (no pandas, fast) ────────────────────────────────

    @staticmethod
    def _sharpe(r: np.ndarray) -> float:
        if r.size == 0 or r.std(ddof=1) == 0:
            return 0.0
        return float(r.mean() / r.std(ddof=1) * np.sqrt(252))

    @staticmethod
    def _max_drawdown(r: np.ndarray) -> float:
        if r.size == 0:
            return 0.0
        equity = np.cumprod(1.0 + r)
        running_max = np.maximum.accumulate(equity)
        dd = (equity - running_max) / running_max
        return float(dd.min())

    @staticmethod
    def _ann_return(r: np.ndarray) -> float:
        if r.size == 0:
            return 0.0
        return float((1 + r.mean()) ** 252 - 1)

    # ── Public API ──────────────────────────────────────────────────────────

    def bootstrap_sharpe(
        self, returns: pd.Series, method: str = "iid", block_size: int = 20
    ) -> dict:
        return self._bootstrap(returns, self._sharpe, method, block_size)

    def bootstrap_max_drawdown(
        self, returns: pd.Series, method: str = "iid", block_size: int = 20
    ) -> dict:
        return self._bootstrap(returns, self._max_drawdown, method, block_size)

    def bootstrap_ann_return(
        self, returns: pd.Series, method: str = "iid", block_size: int = 20
    ) -> dict:
        return self._bootstrap(returns, self._ann_return, method, block_size)

    def bootstrap_all(
        self, returns: pd.Series, method: str = "block", block_size: int = 20
    ) -> dict:
        """Convenience: return CIs for Sharpe, drawdown, and ann_return together."""
        return {
            "sharpe": self.bootstrap_sharpe(returns, method, block_size),
            "max_drawdown": self.bootstrap_max_drawdown(returns, method, block_size),
            "ann_return": self.bootstrap_ann_return(returns, method, block_size),
            "n_simulations": self.n_simulations,
            "method": method,
            "block_size": block_size if method == "block" else None,
        }

    # ── Core loop ───────────────────────────────────────────────────────────

    def _bootstrap(
        self,
        returns: pd.Series,
        metric_fn,
        method: str,
        block_size: int,
    ) -> dict:
        r = np.asarray(returns.dropna(), dtype=float)
        if r.size == 0:
            return {
                "point_estimate": float("nan"),
                "ci_lower": float("nan"),
                "ci_upper": float("nan"),
                "std_error": float("nan"),
            }

        point = metric_fn(r)
        sims = np.empty(self.n_simulations, dtype=float)
        for i in range(self.n_simulations):
            sample = (
                self._block_resample(r, block_size)
                if method == "block"
                else self._iid_resample(r)
            )
            sims[i] = metric_fn(sample)

        alpha = (1.0 - self.ci) / 2.0
        lower = float(np.quantile(sims, alpha))
        upper = float(np.quantile(sims, 1.0 - alpha))
        return {
            "point_estimate": round(point, 6),
            "ci_lower": round(lower, 6),
            "ci_upper": round(upper, 6),
            "std_error": round(float(sims.std(ddof=1)), 6),
        }
