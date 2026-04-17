"""
Volatility-based regime detection.

Uses rolling realized volatility and quantile thresholds to classify each day
into a regime. Lightweight alternative to a full HMM when the goal is a regime
overlay for the strategy equity curve and a conditioned performance table.

Lower labels correspond to lower volatility regimes.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


class VolatilityRegimeDetector:
    """Classify time periods into volatility regimes via rolling std + quantiles."""

    def __init__(self, lookback: int = 20, n_regimes: int = 2):
        if n_regimes < 2:
            raise ValueError("n_regimes must be >= 2")
        self.lookback = lookback
        self.n_regimes = n_regimes
        self._thresholds: np.ndarray | None = None

    def fit_transform(self, series: pd.Series) -> pd.Series:
        """
        Compute rolling vol on `series`, bucket into `n_regimes` equally-sized
        quantile bins, and return a 0-indexed integer label Series where
        0 = lowest-vol regime.
        """
        rolling_vol = series.rolling(self.lookback, min_periods=max(5, self.lookback // 4)).std()

        # Quantile cut points at internal boundaries: e.g., n=3 → [1/3, 2/3]
        quantiles = np.linspace(0, 1, self.n_regimes + 1)[1:-1]
        vals = rolling_vol.dropna().values
        if vals.size == 0:
            return pd.Series(np.nan, index=series.index)

        self._thresholds = np.quantile(vals, quantiles)

        def to_label(v):
            if np.isnan(v):
                return np.nan
            return int(np.searchsorted(self._thresholds, v, side="right"))

        labels = rolling_vol.map(to_label)
        # Forward-fill any NaNs at the start of the series to the first valid label
        labels = labels.bfill().astype(float)
        # Convert to nullable integer (still-float works for tests that allow kind='f')
        return labels

    def regime_names(self) -> dict[int, str]:
        """Return human-readable names for regime labels."""
        if self.n_regimes == 2:
            return {0: "low_vol", 1: "high_vol"}
        if self.n_regimes == 3:
            return {0: "low_vol", 1: "mid_vol", 2: "high_vol"}
        return {i: f"regime_{i}" for i in range(self.n_regimes)}
