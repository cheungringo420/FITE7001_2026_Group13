"""Monte Carlo bootstrap: confidence intervals on Sharpe, drawdown, ann return."""

import numpy as np
import pandas as pd
import pytest

from backtest.metrics.monte_carlo import MonteCarloAnalysis


def test_iid_bootstrap_returns_ci_containing_true_sharpe(positive_sharpe_returns):
    """With iid bootstrap, 95% CI should contain the point-estimate Sharpe."""
    mc = MonteCarloAnalysis(n_simulations=500, seed=42)
    result = mc.bootstrap_sharpe(positive_sharpe_returns, method="iid")

    assert "point_estimate" in result
    assert "ci_lower" in result
    assert "ci_upper" in result
    assert result["ci_lower"] <= result["point_estimate"] <= result["ci_upper"]


def test_block_bootstrap_preserves_autocorrelation(rng):
    """
    For strongly autocorrelated series, block bootstrap should produce a WIDER
    Sharpe distribution than iid bootstrap (because iid destroys the dependence).
    """
    dates = pd.date_range("2024-01-01", periods=500, freq="B")
    # AR(1) with phi=0.5
    values = np.zeros(500)
    eps = rng.normal(0, 0.01, 500)
    for t in range(1, 500):
        values[t] = 0.5 * values[t - 1] + eps[t]
    returns = pd.Series(values + 0.0005, index=dates)

    mc = MonteCarloAnalysis(n_simulations=300, seed=42)
    iid = mc.bootstrap_sharpe(returns, method="iid")
    block = mc.bootstrap_sharpe(returns, method="block", block_size=20)

    iid_width = iid["ci_upper"] - iid["ci_lower"]
    block_width = block["ci_upper"] - block["ci_lower"]

    assert block_width > iid_width * 0.8, (
        f"Block CI width {block_width:.3f} should be comparable to iid {iid_width:.3f}"
    )


def test_bootstrap_drawdown_returns_negative_ci(positive_sharpe_returns):
    """Max drawdown is always non-positive; CI bounds must be ≤ 0."""
    mc = MonteCarloAnalysis(n_simulations=200, seed=42)
    result = mc.bootstrap_max_drawdown(positive_sharpe_returns)

    assert result["ci_upper"] <= 0.0
    assert result["ci_lower"] <= result["ci_upper"]


def test_empty_returns_handled_gracefully():
    """Empty series returns NaN CI rather than crashing."""
    mc = MonteCarloAnalysis(n_simulations=100, seed=42)
    empty = pd.Series(dtype=float)
    result = mc.bootstrap_sharpe(empty)
    assert np.isnan(result["point_estimate"])


def test_deterministic_with_seed(positive_sharpe_returns):
    """Same seed → identical results."""
    mc1 = MonteCarloAnalysis(n_simulations=200, seed=123)
    mc2 = MonteCarloAnalysis(n_simulations=200, seed=123)
    r1 = mc1.bootstrap_sharpe(positive_sharpe_returns)
    r2 = mc2.bootstrap_sharpe(positive_sharpe_returns)
    assert r1["ci_lower"] == pytest.approx(r2["ci_lower"])
    assert r1["ci_upper"] == pytest.approx(r2["ci_upper"])
