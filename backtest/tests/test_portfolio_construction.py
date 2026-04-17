"""Risk-parity and mean-variance portfolio construction."""

import numpy as np
import pandas as pd
import pytest

from backtest.engine.portfolio import PortfolioAggregator


def test_risk_parity_weights_sum_to_one(config, multi_strategy_returns):
    agg = PortfolioAggregator(config)
    weights = agg.risk_parity_weights(multi_strategy_returns)
    assert weights.sum() == pytest.approx(1.0, abs=1e-6)


def test_risk_parity_gives_more_weight_to_lower_vol_strat(config):
    """Strategy with lower vol should get higher weight under risk parity."""
    dates = pd.date_range("2024-01-01", periods=252, freq="B")
    rng = np.random.default_rng(5)
    low_vol = pd.Series(rng.normal(0.0005, 0.002, 252), index=dates)  # 0.2% daily
    high_vol = pd.Series(rng.normal(0.0005, 0.02, 252), index=dates)   # 2.0% daily
    returns = {"low": low_vol, "high": high_vol}

    agg = PortfolioAggregator(config)
    weights = agg.risk_parity_weights(returns)
    assert weights["low"] > weights["high"]


def test_risk_parity_returns_equal_weights_for_identical_vol(config):
    """Two strategies with identical vol → weights ≈ 0.5 each."""
    dates = pd.date_range("2024-01-01", periods=252, freq="B")
    rng = np.random.default_rng(3)
    a = pd.Series(rng.normal(0, 0.01, 252), index=dates)
    b = pd.Series(rng.normal(0, 0.01, 252), index=dates)

    agg = PortfolioAggregator(config)
    weights = agg.risk_parity_weights({"a": a, "b": b})
    assert weights["a"] == pytest.approx(weights["b"], abs=0.1)


def test_mean_variance_weights_sum_to_one(config, multi_strategy_returns):
    agg = PortfolioAggregator(config)
    weights = agg.mean_variance_weights(multi_strategy_returns, target_return=None)
    assert weights.sum() == pytest.approx(1.0, abs=1e-4)


def test_mean_variance_weights_long_only_non_negative(config, multi_strategy_returns):
    agg = PortfolioAggregator(config)
    weights = agg.mean_variance_weights(multi_strategy_returns, long_only=True)
    assert (weights >= -1e-6).all(), f"Weights should be non-negative, got {weights.to_dict()}"


def test_apply_weights_produces_portfolio_return_series(config, multi_strategy_returns):
    agg = PortfolioAggregator(config)
    weights = agg.risk_parity_weights(multi_strategy_returns)
    portfolio = agg.apply_weights(multi_strategy_returns, weights)

    assert isinstance(portfolio, pd.Series)
    assert len(portfolio) == 252
    # Sanity: portfolio equals the weighted sum on an arbitrary date
    df = pd.DataFrame(multi_strategy_returns)
    expected = (df * weights).sum(axis=1)
    pd.testing.assert_series_equal(portfolio, expected, check_names=False)
