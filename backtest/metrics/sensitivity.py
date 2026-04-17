"""
Parameter sensitivity analyzer.

Runs a strategy callable across a 2D parameter grid and returns a Sharpe
surface. Used to defend strategy parameters against the "cherry-picked
threshold" critique: if the Sharpe is stable across nearby parameter values,
the result is robust.
"""

from __future__ import annotations

from typing import Callable

import numpy as np
import pandas as pd


class SensitivityAnalyzer:
    """2D parameter sweep over a strategy callable."""

    @staticmethod
    def _sharpe(returns: pd.Series) -> float:
        r = returns.dropna()
        if r.empty or r.std(ddof=1) == 0:
            return 0.0
        return float(r.mean() / r.std(ddof=1) * np.sqrt(252))

    def sweep_2d(
        self,
        base_returns: pd.Series,
        strategy_fn: Callable[..., pd.Series],
        param_x: dict,
        param_y: dict,
    ) -> dict:
        """
        Sweep strategy_fn across a 2D parameter grid.

        Parameters
        ----------
        base_returns : input return series passed as first arg to strategy_fn.
        strategy_fn : callable (returns, **kwargs) -> pd.Series of adjusted returns.
        param_x, param_y : {"name": str, "values": list[number]}.

        Returns
        -------
        dict with keys:
            - sharpe_grid : list[list[float]] shape (len(y), len(x))
            - param_x, param_y : input dicts echoed back
            - max_cell : {"row": int, "col": int} of max Sharpe
            - stability_score : 1 - std(grid) / mean(|grid|), clipped to [0, 1]
        """
        x_name = param_x["name"]
        x_vals = list(param_x["values"])
        y_name = param_y["name"]
        y_vals = list(param_y["values"])

        grid = np.zeros((len(y_vals), len(x_vals)), dtype=float)
        for i, yv in enumerate(y_vals):
            for j, xv in enumerate(x_vals):
                adj = strategy_fn(base_returns, **{x_name: xv, y_name: yv})
                grid[i, j] = self._sharpe(adj)

        max_row, max_col = np.unravel_index(np.argmax(grid), grid.shape)

        mean_abs = float(np.mean(np.abs(grid)))
        if mean_abs > 0:
            stability = 1.0 - float(np.std(grid)) / mean_abs
        else:
            stability = 0.0
        stability = max(0.0, min(1.0, stability))

        return {
            "sharpe_grid": grid.round(4).tolist(),
            "param_x": {"name": x_name, "values": x_vals},
            "param_y": {"name": y_name, "values": y_vals},
            "max_cell": {"row": int(max_row), "col": int(max_col)},
            "stability_score": round(stability, 4),
        }
