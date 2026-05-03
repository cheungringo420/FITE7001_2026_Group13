"""
Strategy 5: Mean Reversion on Single-Platform Mispricing
Signal: YES + NO > 1.02 (sum > 102¢) — overpriced combined position
Trade: Short the higher-priced outcome; long the lower
Hold: Until convergence (< 24h timeout)
Expected: Likely NO alpha after costs — validates Polymarket pricing efficiency.
"""

import pandas as pd
import numpy as np
from .base import Strategy


class MeanReversion(Strategy):
    name = "mean_reversion"
    description = "Mean reversion on single-platform mispricing (efficiency test)"
    max_params = 2  # overpriced_threshold, timeout

    def __init__(self, config: dict):
        super().__init__(config)
        strat_cfg = config.get("strategies", {}).get("mean_reversion", {})
        self.overpriced_threshold = strat_cfg.get("overpriced_threshold", 1.02)
        self.timeout_hours = strat_cfg.get("timeout_hours", 24)
        self.params = {
            "overpriced_threshold": self.overpriced_threshold,
            "timeout_hours": self.timeout_hours,
        }

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        """
        Signal = (YES + NO - 1) when sum > threshold, else 0.
        Positive signal means overpriced — trade the convergence.
        """
        if "yes_price" not in data.columns or "no_price" not in data.columns:
            return pd.Series(0.0, index=data.index)

        total = data["yes_price"] + data["no_price"]
        mispricing = total - 1.0

        signals = pd.Series(0.0, index=data.index)
        overpriced = total > self.overpriced_threshold
        signals[overpriced] = mispricing[overpriced]

        return signals

    def generate_positions(self, signals: pd.Series, data: pd.DataFrame) -> pd.Series:
        """
        When overpriced: short the higher outcome, long the lower.
        Net position size proportional to mispricing magnitude.
        """
        max_pos = self.config.get("risk", {}).get("max_position_pct", 0.10)

        # Position is a fraction of max, scaled by signal strength
        positions = signals.clip(0, 0.10) / 0.10 * max_pos
        return positions

    def estimate_net_pnl(self, signals: pd.Series, data: pd.DataFrame) -> pd.Series:
        """
        Estimate PnL after transaction costs.
        Expected: costs eat most/all of the gross profit.
        """
        poly_cost = self.config.get("costs", {}).get("polymarket", {}).get("spread_bps", 100) / 10000
        # Two trades: short one outcome, long the other
        round_trip_cost = 2 * poly_cost

        gross_pnl = signals  # Convergence profit = mispricing amount
        net_pnl = gross_pnl - round_trip_cost

        return net_pnl
