"""Tests for RegimeSizer: regime-conditional position sizing vs static."""

import numpy as np
import pandas as pd
import pytest

from backtest.engine.regime_sizing import RegimeSizer
from backtest.engine.regime import VolatilityRegimeDetector


def _make_returns(rng, n=504, sigma_low=0.005, sigma_high=0.025, mu=-0.0002):
    """
    Two-regime synthetic returns: alternating low/high vol blocks, with a
    slight negative drift everywhere so high-vol periods are the primary
    source of drawdown (regime sizing should reduce that).
    """
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    block_size = n // 6
    r = np.empty(n)
    for i in range(6):
        lo, hi = i * block_size, (i + 1) * block_size if i < 5 else n
        sigma = sigma_high if i % 2 == 1 else sigma_low
        r[lo:hi] = rng.normal(mu, sigma, hi - lo)
    return pd.Series(r, index=dates)


def test_equal_multipliers_yield_identical_returns(rng):
    r = _make_returns(rng)
    sizer = RegimeSizer(multipliers={0: 1.0, 1: 1.0}, n_regimes=2)
    out = sizer.scale(r)
    # 1x in every regime ⇒ identical returns.
    np.testing.assert_allclose(out.values, r.values)


def test_default_multipliers_shape_two_regimes():
    sizer = RegimeSizer(n_regimes=2)
    m = sizer.multipliers
    assert set(m.keys()) == {0, 1}
    assert m[0] >= m[1]  # low-vol >= high-vol exposure


def test_default_multipliers_shape_three_regimes():
    sizer = RegimeSizer(n_regimes=3)
    m = sizer.multipliers
    assert set(m.keys()) == {0, 1, 2}
    # Monotonically decreasing exposure with rising vol.
    assert m[0] >= m[1] >= m[2]


def test_scale_reduces_exposure_in_high_vol(rng):
    r = _make_returns(rng)
    detector = VolatilityRegimeDetector(lookback=20, n_regimes=2)
    labels = detector.fit_transform(r)
    sizer = RegimeSizer(multipliers={0: 1.0, 1: 0.25}, n_regimes=2)
    scaled = sizer.scale(r, regime_labels=labels)

    high_mask = labels == 1
    # Where high-vol, scaled == r * 0.25 (within floating tolerance).
    np.testing.assert_allclose(
        scaled[high_mask].values, r[high_mask].values * 0.25, atol=1e-12
    )


def test_compare_reports_both_series(rng):
    r = _make_returns(rng)
    sizer = RegimeSizer(n_regimes=2)
    out = sizer.compare(r)

    assert {"static", "regime"} <= set(out.keys())
    for k in ("static", "regime"):
        assert {"sharpe", "ann_return", "ann_vol", "max_drawdown"} <= set(out[k].keys())
    assert "multipliers" in out
    assert "regime_labels" in out  # aligned to returns index


def test_compare_regime_reduces_drawdown_when_losses_are_high_vol(rng):
    """
    On a return stream where the losses are concentrated in high-vol periods,
    regime-conditional sizing should improve max drawdown (make it less negative).
    """
    r = _make_returns(rng, mu=-0.0005, sigma_low=0.003, sigma_high=0.030)
    sizer = RegimeSizer(multipliers={0: 1.0, 1: 0.2}, n_regimes=2)
    out = sizer.compare(r)

    # Regime max drawdown should be strictly less deep (closer to zero).
    assert out["regime"]["max_drawdown"] > out["static"]["max_drawdown"]


def test_missing_regime_label_defaults_to_one(rng):
    r = _make_returns(rng)
    labels = pd.Series(7, index=r.index)  # unknown regime → default 1.0
    sizer = RegimeSizer(multipliers={0: 0.5, 1: 0.5}, n_regimes=2)
    scaled = sizer.scale(r, regime_labels=labels)
    np.testing.assert_allclose(scaled.values, r.values)  # 1.0 default


def test_compare_includes_equity_curves(rng):
    r = _make_returns(rng)
    sizer = RegimeSizer(n_regimes=2)
    out = sizer.compare(r)
    # Equity curves suitable for UI charting.
    assert "equity" in out
    assert "static" in out["equity"] and "regime" in out["equity"]
    assert len(out["equity"]["static"]) == len(r)
    assert len(out["equity"]["regime"]) == len(r)
    assert out["equity"]["static"][0]["value"] > 0
