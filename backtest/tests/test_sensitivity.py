"""Parameter sensitivity analyzer: 2D grid sweep returning Sharpe surface."""

import numpy as np
import pandas as pd
import pytest

from backtest.metrics.sensitivity import SensitivityAnalyzer


def _ar1_returns(rng, n=252, mu=0.0008, sigma=0.01, phi=0.0):
    """Generate AR(1) returns; phi=0 for iid."""
    eps = rng.normal(0, sigma, n)
    r = np.zeros(n)
    for t in range(1, n):
        r[t] = phi * r[t - 1] + eps[t]
    r += mu
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    return pd.Series(r, index=dates)


def test_sweep_returns_grid_with_correct_dimensions(rng):
    """Sweeping a 4x3 grid should return a 4x3 Sharpe matrix."""
    base_returns = _ar1_returns(rng)

    def strategy_fn(returns, threshold, holding):
        # Toy: scale returns by threshold (just to make Sharpe vary)
        return returns * threshold * (1.0 / holding)

    analyzer = SensitivityAnalyzer()
    result = analyzer.sweep_2d(
        base_returns,
        strategy_fn,
        param_x={"name": "threshold", "values": [0.5, 1.0, 1.5, 2.0]},
        param_y={"name": "holding", "values": [1, 3, 5]},
    )

    assert result["param_x"]["name"] == "threshold"
    assert result["param_y"]["name"] == "holding"
    assert len(result["param_x"]["values"]) == 4
    assert len(result["param_y"]["values"]) == 3
    grid = np.array(result["sharpe_grid"])
    assert grid.shape == (3, 4)  # rows = y, cols = x


def test_sharpe_values_are_finite(rng):
    base = _ar1_returns(rng)

    def strat(r, a, b):
        return r * a + r.shift(1).fillna(0) * b * 0.1

    analyzer = SensitivityAnalyzer()
    out = analyzer.sweep_2d(
        base, strat,
        param_x={"name": "a", "values": [0.5, 1.0]},
        param_y={"name": "b", "values": [0.0, 0.5]},
    )
    grid = np.array(out["sharpe_grid"])
    assert np.isfinite(grid).all()


def test_baseline_marker_identifies_max_cell(rng):
    """The result reports which cell has max Sharpe for visual highlighting."""
    base = _ar1_returns(rng)

    def strat(r, a, b):
        return r * a * b

    analyzer = SensitivityAnalyzer()
    out = analyzer.sweep_2d(
        base, strat,
        param_x={"name": "a", "values": [0.5, 1.0, 2.0]},
        param_y={"name": "b", "values": [0.5, 1.0, 2.0]},
    )

    grid = np.array(out["sharpe_grid"])
    max_row, max_col = np.unravel_index(np.argmax(grid), grid.shape)
    assert out["max_cell"] == {"row": int(max_row), "col": int(max_col)}


def test_stability_score_reflects_low_dispersion(rng):
    """Stability = 1 - (std / |mean|) of grid Sharpes — high when grid is flat."""
    base = _ar1_returns(rng, mu=0.001)

    # Flat: same scaler, varying inert param → identical Sharpes → high stability
    def flat_strat(r, a, b):
        return r * 1.0  # neither param matters

    analyzer = SensitivityAnalyzer()
    out_flat = analyzer.sweep_2d(
        base, flat_strat,
        param_x={"name": "a", "values": [0.5, 1.0, 1.5]},
        param_y={"name": "b", "values": [0.5, 1.0, 1.5]},
    )

    # Spiky: outputs vary wildly with params (add param-dependent drift that
    # changes the signal-to-noise ratio so Sharpe actually varies)
    noise_rng = np.random.default_rng(99)
    noise = pd.Series(noise_rng.normal(0, 0.02, len(base)), index=base.index)

    def spiky_strat(r, a, b):
        # Drift scales linearly but noise scales with a*b → Sharpe changes
        return r + noise * (a * b)

    out_spiky = analyzer.sweep_2d(
        base, spiky_strat,
        param_x={"name": "a", "values": [0.5, 1.0, 1.5]},
        param_y={"name": "b", "values": [0.5, 1.0, 1.5]},
    )

    assert out_flat["stability_score"] > out_spiky["stability_score"]


def test_handles_single_value_param_axis(rng):
    """A 1xN sweep is allowed (degenerate but useful for line plots)."""
    base = _ar1_returns(rng)

    def strat(r, a, b):
        return r * a

    analyzer = SensitivityAnalyzer()
    out = analyzer.sweep_2d(
        base, strat,
        param_x={"name": "a", "values": [0.5, 1.0, 2.0]},
        param_y={"name": "b", "values": [1.0]},
    )
    grid = np.array(out["sharpe_grid"])
    assert grid.shape == (1, 3)
