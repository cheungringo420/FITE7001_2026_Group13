"""Deflated Sharpe Ratio (Bailey & López de Prado, 2014)."""

import numpy as np
import pandas as pd
import pytest

from backtest.metrics.deflated_sharpe import (
    deflated_sharpe_ratio,
    probabilistic_sharpe_ratio,
)


def test_psr_returns_probability_between_0_and_1(positive_sharpe_returns):
    psr = probabilistic_sharpe_ratio(positive_sharpe_returns, sharpe_benchmark=0.0)
    assert 0.0 <= psr <= 1.0


def test_psr_is_higher_when_observed_sharpe_exceeds_benchmark(positive_sharpe_returns):
    """Benchmark below observed → PSR should be > 0.5."""
    psr_vs_zero = probabilistic_sharpe_ratio(positive_sharpe_returns, sharpe_benchmark=0.0)
    psr_vs_high = probabilistic_sharpe_ratio(positive_sharpe_returns, sharpe_benchmark=3.0)
    assert psr_vs_zero > psr_vs_high


def test_dsr_penalizes_multiple_testing():
    """
    With many trials, the expected max Sharpe under H0 grows, so DSR for the SAME
    strategy should drop as n_trials rises.
    """
    dates = pd.date_range("2024-01-01", periods=252, freq="B")
    rng = np.random.default_rng(7)
    r = pd.Series(rng.normal(0.0005, 0.01, 252), index=dates)

    dsr_1 = deflated_sharpe_ratio(r, n_trials=1, trial_sharpe_variance=0.5)
    dsr_100 = deflated_sharpe_ratio(r, n_trials=100, trial_sharpe_variance=0.5)

    assert dsr_100 < dsr_1, f"DSR should shrink with more trials ({dsr_1} vs {dsr_100})"


def test_dsr_handles_empty_returns():
    empty = pd.Series(dtype=float)
    assert np.isnan(deflated_sharpe_ratio(empty, n_trials=5, trial_sharpe_variance=0.5))


def test_psr_uses_skew_and_kurtosis():
    """
    For a returns series with heavy negative skew + excess kurtosis, PSR should
    be LOWER than a same-Sharpe normal series — since tail risk penalizes confidence.
    """
    n = 252
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    rng = np.random.default_rng(11)

    # Mix: mostly small positive + occasional large negative for left skew
    base = rng.normal(0.0010, 0.005, n)
    shocks = np.zeros(n)
    shocks[rng.choice(n, size=5, replace=False)] = -0.04
    skewed = pd.Series(base + shocks, index=dates)

    # Same mean/std target, but symmetric normal
    normal = pd.Series(
        rng.normal(skewed.mean(), skewed.std(), n), index=dates
    )

    psr_skewed = probabilistic_sharpe_ratio(skewed, sharpe_benchmark=0.0)
    psr_normal = probabilistic_sharpe_ratio(normal, sharpe_benchmark=0.0)

    assert psr_skewed < psr_normal, (
        f"Negative-skew series should have lower PSR (got {psr_skewed:.3f} vs {psr_normal:.3f})"
    )
