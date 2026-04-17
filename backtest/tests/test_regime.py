"""Volatility-based regime detection and regime-conditioned metrics."""

import numpy as np
import pandas as pd
import pytest

from backtest.engine.regime import VolatilityRegimeDetector
from backtest.metrics.regime_analysis import performance_by_regime


def _synthetic_regimes(rng):
    """Build a series that is explicitly low-vol for 120 days then high-vol for 120."""
    dates = pd.date_range("2024-01-01", periods=240, freq="B")
    low = rng.normal(0.0, 0.003, 120)
    high = rng.normal(0.0, 0.03, 120)
    return pd.Series(np.concatenate([low, high]), index=dates)


def test_detector_labels_known_low_and_high_vol_periods(rng):
    series = _synthetic_regimes(rng)
    det = VolatilityRegimeDetector(lookback=20, n_regimes=2)
    labels = det.fit_transform(series)

    assert labels.shape == series.shape
    # After a warmup, the first half should be mostly low (label 0), second mostly high (label 1)
    first_half_mode = labels.iloc[30:120].mode().iloc[0]
    second_half_mode = labels.iloc[140:].mode().iloc[0]
    assert first_half_mode != second_half_mode


def test_detector_returns_regime_labels_as_int_series(rng):
    series = _synthetic_regimes(rng)
    det = VolatilityRegimeDetector(lookback=20, n_regimes=3)
    labels = det.fit_transform(series)

    assert labels.dtype.kind in ("i", "u", "f")
    unique = set(labels.dropna().unique())
    assert unique.issubset({0, 1, 2})


def test_regime_names_map_is_available(rng):
    series = _synthetic_regimes(rng)
    det = VolatilityRegimeDetector(lookback=20, n_regimes=2)
    det.fit_transform(series)
    names = det.regime_names()
    assert set(names.values()) == {"low_vol", "high_vol"}


def test_performance_by_regime_produces_row_per_regime(rng):
    series = _synthetic_regimes(rng)
    # Strategy that has higher return in low-vol period
    dates = series.index
    returns = pd.Series(
        np.concatenate([rng.normal(0.001, 0.005, 120), rng.normal(-0.001, 0.02, 120)]),
        index=dates,
    )
    det = VolatilityRegimeDetector(lookback=20, n_regimes=2)
    labels = det.fit_transform(series)
    table = performance_by_regime(returns, labels, regime_names=det.regime_names())

    assert "sharpe" in table.columns
    assert "ann_return" in table.columns
    assert "n_days" in table.columns
    # Both regimes represented
    assert len(table) == 2


def test_performance_by_regime_metrics_are_numeric(rng):
    series = _synthetic_regimes(rng)
    returns = pd.Series(rng.normal(0.0005, 0.01, 240), index=series.index)
    det = VolatilityRegimeDetector(lookback=20, n_regimes=2)
    labels = det.fit_transform(series)
    table = performance_by_regime(returns, labels, regime_names=det.regime_names())

    for col in ["sharpe", "ann_return", "ann_vol", "max_drawdown"]:
        assert table[col].dtype.kind in ("f", "i")
