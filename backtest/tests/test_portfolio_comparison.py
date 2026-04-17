"""Tests for PortfolioComparison: equal-weight vs risk-parity vs mean-variance."""

import numpy as np
import pandas as pd
import pytest

from backtest.metrics.portfolio_comparison import PortfolioComparison


def test_compare_returns_three_methods(multi_strategy_returns, config):
    cmp = PortfolioComparison(config)
    out = cmp.compare(multi_strategy_returns)

    assert set(out["methods"].keys()) == {"equal_weight", "risk_parity", "mean_variance"}


def test_weights_sum_to_one_for_each_method(multi_strategy_returns, config):
    cmp = PortfolioComparison(config)
    out = cmp.compare(multi_strategy_returns)

    for method_name, method in out["methods"].items():
        total = sum(method["weights"].values())
        assert abs(total - 1.0) < 1e-6, f"{method_name} weights sum {total} != 1"


def test_each_method_reports_core_metrics(multi_strategy_returns, config):
    cmp = PortfolioComparison(config)
    out = cmp.compare(multi_strategy_returns)

    required = {"sharpe", "ann_return", "ann_vol", "max_drawdown", "weights"}
    for m in out["methods"].values():
        assert required.issubset(m.keys())
        assert np.isfinite(m["sharpe"])
        assert np.isfinite(m["ann_return"])
        assert m["ann_vol"] >= 0


def test_equal_weight_weights_are_uniform(multi_strategy_returns, config):
    cmp = PortfolioComparison(config)
    out = cmp.compare(multi_strategy_returns)

    weights = out["methods"]["equal_weight"]["weights"]
    n = len(weights)
    for w in weights.values():
        assert abs(w - 1.0 / n) < 1e-9


def test_mean_variance_is_long_only(multi_strategy_returns, config):
    """Default mean-variance tangency should be long-only."""
    cmp = PortfolioComparison(config)
    out = cmp.compare(multi_strategy_returns)

    for w in out["methods"]["mean_variance"]["weights"].values():
        assert w >= -1e-9  # small numerical slack


def test_correlation_matrix_shape_and_diagonal(multi_strategy_returns, config):
    cmp = PortfolioComparison(config)
    out = cmp.compare(multi_strategy_returns)

    cm = out["correlation_matrix"]
    names = list(multi_strategy_returns.keys())
    assert set(cm.keys()) == set(names)
    for s in names:
        assert abs(cm[s][s] - 1.0) < 1e-9  # diagonal = 1


def test_avg_pairwise_correlation_reported(multi_strategy_returns, config):
    cmp = PortfolioComparison(config)
    out = cmp.compare(multi_strategy_returns)

    # Average over off-diagonal entries only.
    assert "avg_pairwise_correlation" in out
    assert -1.0 <= out["avg_pairwise_correlation"] <= 1.0


def test_risk_parity_has_lower_vol_concentration(config, rng):
    """
    Construct a 3-strategy set where one strategy has much higher vol.
    Risk parity should down-weight that strategy relative to equal weight.
    """
    dates = pd.date_range("2024-01-01", periods=252, freq="B")
    returns = {
        "low_vol": pd.Series(rng.normal(0.0005, 0.005, 252), index=dates),
        "mid_vol": pd.Series(rng.normal(0.0005, 0.010, 252), index=dates),
        "high_vol": pd.Series(rng.normal(0.0005, 0.030, 252), index=dates),
    }

    cmp = PortfolioComparison(config)
    out = cmp.compare(returns)

    rp_weights = out["methods"]["risk_parity"]["weights"]
    # high_vol should be < equal weight (1/3 ≈ 0.333).
    assert rp_weights["high_vol"] < 1.0 / 3
    # low_vol should be > equal weight.
    assert rp_weights["low_vol"] > 1.0 / 3


def test_handles_single_strategy(config, rng):
    dates = pd.date_range("2024-01-01", periods=100, freq="B")
    returns = {"only": pd.Series(rng.normal(0.001, 0.01, 100), index=dates)}

    cmp = PortfolioComparison(config)
    out = cmp.compare(returns)

    for method in out["methods"].values():
        assert abs(method["weights"]["only"] - 1.0) < 1e-6
