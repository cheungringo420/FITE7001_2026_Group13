"""
Walk-forward analysis.

Two modes:

1. `analyze(returns, ...)` — assumes the strategy is already decided. Slices
   the return series into (train, test) folds and reports per-fold Sharpe
   decay. Measures regime stability, not re-optimization quality.

2. `anchored_reoptimization(returns, strategy_fn, param_grid, ...)` — true
   walk-forward: at each fold, grid-search the strategy callable on train,
   evaluate the best parameter choice on the subsequent test window. This is
   the institutional standard for defending against overfitting because the
   test Sharpe is earned *after* the parameter decision is locked on data the
   test window never saw.

Anchored = train window starts at index 0 and expands as folds advance.
Rolling = train window size is fixed; both bounds slide forward.
"""

from __future__ import annotations

import itertools
from typing import Callable, Mapping, Sequence

import numpy as np
import pandas as pd


def _sharpe(r: pd.Series) -> float:
    r = r.dropna()
    if r.empty:
        return 0.0
    sd = float(r.std(ddof=1))
    if sd == 0 or not np.isfinite(sd):
        return 0.0
    return float(r.mean() / sd * np.sqrt(252))


def _to_isoformat(ts) -> str:
    try:
        return pd.Timestamp(ts).date().isoformat()
    except Exception:
        return str(ts)


class WalkForwardAnalyzer:
    """Fold-based walk-forward analysis of a strategy's return series."""

    # ── Fixed-strategy fold analysis ────────────────────────────────────

    def analyze(
        self,
        returns: pd.Series,
        train_window: int,
        test_window: int,
        step: int,
        anchored: bool = True,
    ) -> dict:
        """
        Slice returns into walk-forward folds and report Sharpe for each window.

        Returns
        -------
        {
            "folds": [{fold, train_start, train_end, test_start, test_end,
                       train_sharpe, test_sharpe, n_train, n_test}, ...],
            "summary": {n_folds, mean_train_sharpe, mean_test_sharpe,
                        sharpe_decay, anchored, train_window, test_window, step},
        }
        """
        folds = []
        n = len(returns)
        if n < train_window + test_window:
            return {
                "folds": [],
                "summary": self._empty_summary(anchored, train_window, test_window, step),
            }

        # Fold i covers: train = [i*step, i*step + train_window)
        #                test  = [i*step + train_window, i*step + train_window + test_window)
        # For anchored, train_start is fixed at 0, train_end grows.
        i = 0
        while True:
            train_start_idx = 0 if anchored else i * step
            train_end_idx = i * step + train_window
            test_start_idx = train_end_idx
            test_end_idx = test_start_idx + test_window
            if test_end_idx > n:
                break

            train_slice = returns.iloc[train_start_idx:train_end_idx]
            test_slice = returns.iloc[test_start_idx:test_end_idx]

            folds.append({
                "fold": i,
                "train_start": _to_isoformat(train_slice.index[0]),
                "train_end": _to_isoformat(train_slice.index[-1]),
                "test_start": _to_isoformat(test_slice.index[0]),
                "test_end": _to_isoformat(test_slice.index[-1]),
                "train_sharpe": round(_sharpe(train_slice), 4),
                "test_sharpe": round(_sharpe(test_slice), 4),
                "n_train": len(train_slice),
                "n_test": len(test_slice),
            })
            i += 1

        return {
            "folds": folds,
            "summary": self._summarize(folds, anchored, train_window, test_window, step),
        }

    # ── Re-optimization folds (true walk-forward) ───────────────────────

    def anchored_reoptimization(
        self,
        returns: pd.Series,
        strategy_fn: Callable[..., pd.Series],
        param_grid: Mapping[str, Sequence],
        train_window: int,
        test_window: int,
        step: int,
        anchored: bool = True,
    ) -> dict:
        """
        True walk-forward: grid-search strategy_fn on each train window, pick
        the best parameter combination by train Sharpe, then evaluate that
        choice on the next test window.

        param_grid : e.g. {"alpha": [0.5, 1.0], "beta": [0, 1]} produces the
                     full Cartesian product of combinations.
        """
        folds = []
        n = len(returns)
        if n < train_window + test_window:
            return {
                "folds": [],
                "summary": self._empty_summary(anchored, train_window, test_window, step),
            }

        param_names = list(param_grid.keys())
        combos = list(itertools.product(*[param_grid[k] for k in param_names]))

        i = 0
        while True:
            train_start_idx = 0 if anchored else i * step
            train_end_idx = i * step + train_window
            test_start_idx = train_end_idx
            test_end_idx = test_start_idx + test_window
            if test_end_idx > n:
                break

            train_slice = returns.iloc[train_start_idx:train_end_idx]
            test_slice = returns.iloc[test_start_idx:test_end_idx]

            # Grid search on train.
            search = []
            best_train_sharpe = -np.inf
            best_params = None
            best_combo_idx = 0
            for j, combo in enumerate(combos):
                params = dict(zip(param_names, combo))
                train_out = strategy_fn(train_slice, **params)
                sr = _sharpe(train_out)
                search.append({"params": params, "train_sharpe": round(sr, 4)})
                if sr > best_train_sharpe:
                    best_train_sharpe = sr
                    best_params = params
                    best_combo_idx = j

            # Evaluate best params on test.
            test_out = strategy_fn(test_slice, **best_params)
            test_sharpe = _sharpe(test_out)

            folds.append({
                "fold": i,
                "train_start": _to_isoformat(train_slice.index[0]),
                "train_end": _to_isoformat(train_slice.index[-1]),
                "test_start": _to_isoformat(test_slice.index[0]),
                "test_end": _to_isoformat(test_slice.index[-1]),
                "train_sharpe": round(float(best_train_sharpe), 4),
                "test_sharpe": round(float(test_sharpe), 4),
                "n_train": len(train_slice),
                "n_test": len(test_slice),
                "best_params": best_params,
                "best_combo_idx": best_combo_idx,
                "param_search": search,
            })
            i += 1

        return {
            "folds": folds,
            "summary": self._summarize(folds, anchored, train_window, test_window, step),
        }

    # ── Internals ────────────────────────────────────────────────────────

    @staticmethod
    def _empty_summary(anchored, train_window, test_window, step) -> dict:
        return {
            "n_folds": 0,
            "mean_train_sharpe": 0.0,
            "mean_test_sharpe": 0.0,
            "sharpe_decay": 0.0,
            "anchored": anchored,
            "train_window": train_window,
            "test_window": test_window,
            "step": step,
        }

    @staticmethod
    def _summarize(folds, anchored, train_window, test_window, step) -> dict:
        n = len(folds)
        if n == 0:
            return WalkForwardAnalyzer._empty_summary(anchored, train_window, test_window, step)
        train_mean = float(np.mean([f["train_sharpe"] for f in folds]))
        test_mean = float(np.mean([f["test_sharpe"] for f in folds]))
        decay = (train_mean - test_mean) / abs(train_mean) if abs(train_mean) > 1e-9 else 0.0
        return {
            "n_folds": n,
            "mean_train_sharpe": round(train_mean, 4),
            "mean_test_sharpe": round(test_mean, 4),
            "sharpe_decay": round(decay, 4),
            "anchored": anchored,
            "train_window": train_window,
            "test_window": test_window,
            "step": step,
        }
