"""
Time-series alignment utilities.
Merges prediction market and traditional market series onto a common calendar,
with forward-fill for weekends and gap detection.
"""

import pandas as pd
import numpy as np
from typing import Optional


class TimeSeriesAligner:
    """Align heterogeneous time series to NYSE trading calendar."""

    def __init__(self, max_gap_hours: int = 24):
        self.max_gap_hours = max_gap_hours

    def align_to_nyse_calendar(
        self,
        pm_series: pd.DataFrame,
        trad_series: pd.DataFrame,
        start: Optional[str] = None,
        end: Optional[str] = None,
    ) -> pd.DataFrame:
        """
        Align prediction market (UTC, 7-day) and traditional market (NYSE, 5-day)
        series onto NYSE trading days using forward-fill.
        """
        # Build NYSE trading day index
        if start is None:
            start = min(
                pm_series.index.min() if len(pm_series) else pd.Timestamp.max,
                trad_series.index.min() if len(trad_series) else pd.Timestamp.max,
            )
        if end is None:
            end = max(
                pm_series.index.max() if len(pm_series) else pd.Timestamp.min,
                trad_series.index.max() if len(trad_series) else pd.Timestamp.min,
            )

        nyse_days = pd.bdate_range(start=start, end=end, freq="B")

        # Reindex both to NYSE calendar with forward-fill
        pm_aligned = pm_series.reindex(nyse_days, method="ffill")
        trad_aligned = trad_series.reindex(nyse_days, method="ffill")

        combined = pd.concat([pm_aligned, trad_aligned], axis=1)
        combined.index.name = "date"
        return combined

    def detect_gaps(self, series: pd.Series, name: str = "") -> pd.DataFrame:
        """Detect gaps larger than max_gap_hours in a time series."""
        if series.empty or len(series) < 2:
            return pd.DataFrame(columns=["start", "end", "gap_hours", "series"])

        idx = series.dropna().index
        if len(idx) < 2:
            return pd.DataFrame(columns=["start", "end", "gap_hours", "series"])

        diffs = pd.Series(idx[1:]) - pd.Series(idx[:-1])
        gap_hours = diffs.dt.total_seconds() / 3600

        mask = gap_hours > self.max_gap_hours
        if not mask.any():
            return pd.DataFrame(columns=["start", "end", "gap_hours", "series"])

        gaps = pd.DataFrame({
            "start": idx[:-1][mask.values],
            "end": idx[1:][mask.values],
            "gap_hours": gap_hours[mask].values,
            "series": name,
        })
        return gaps

    def forward_fill_with_limit(
        self, df: pd.DataFrame, limit: int = 5
    ) -> pd.DataFrame:
        """Forward-fill with a maximum number of consecutive fills."""
        return df.ffill(limit=limit)

    def compute_returns(self, prices: pd.DataFrame) -> pd.DataFrame:
        """Compute simple daily returns from price levels."""
        return prices.pct_change().iloc[1:]

    def merge_datasets(self, datasets: dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Merge multiple named DataFrames on their date index."""
        if not datasets:
            return pd.DataFrame()

        result = None
        for name, df in datasets.items():
            if df.empty:
                continue
            # Prefix columns with dataset name if needed
            if isinstance(df, pd.Series):
                df = df.to_frame(name)
            if result is None:
                result = df
            else:
                result = result.join(df, how="outer")

        if result is None:
            return pd.DataFrame()

        result.index.name = "date"
        return result
