"""
Strategy 6: Market-Making Simulation (Avellaneda-Stoikov adapted for binary markets)
Limitation: Top-of-book only — no tick-level order book data.
PnL estimates are lower-bounded approximations.
"""

import pandas as pd
import numpy as np
from .base import Strategy


class MarketMaking(Strategy):
    name = "market_making"
    description = "Market-making simulation (Avellaneda-Stoikov, top-of-book proxy)"
    max_params = 3  # gamma (risk aversion), sigma, k (order arrival intensity)

    def __init__(self, config: dict):
        super().__init__(config)
        # Avellaneda-Stoikov parameters
        self.gamma = 0.1  # Risk aversion
        self.k = 1.5      # Order arrival intensity
        self.params = {
            "gamma": self.gamma,
            "k": self.k,
        }

    def compute_reservation_price(
        self, mid_price: pd.Series, inventory: pd.Series, sigma: pd.Series
    ) -> pd.Series:
        """
        r(t) = s(t) - q(t) * gamma * sigma^2 * T
        where s = mid price, q = inventory, T = time to resolution (normalized)
        """
        T = 1.0  # Simplified: normalize to 1 day
        return mid_price - inventory * self.gamma * sigma ** 2 * T

    def compute_optimal_spread(self, sigma: pd.Series) -> pd.Series:
        """
        δ* = gamma * sigma^2 * T + (2/gamma) * ln(1 + gamma/k)
        """
        T = 1.0
        spread = self.gamma * sigma ** 2 * T + (2 / self.gamma) * np.log(1 + self.gamma / self.k)
        return spread

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        """
        Signal = optimal spread - actual spread.
        Positive = market spread is wider than optimal → profit opportunity.
        """
        if "bid" not in data.columns or "ask" not in data.columns:
            # Simulate from mid price
            if "yes_price" in data.columns:
                mid = data["yes_price"]
                sigma = mid.rolling(20, min_periods=5).std().fillna(0.05)
                optimal_spread = self.compute_optimal_spread(sigma)
                # Assume actual spread = 2% for Polymarket
                actual_spread = 0.02
                return (actual_spread - optimal_spread).clip(lower=0)
            return pd.Series(0.0, index=data.index)

        mid = (data["bid"] + data["ask"]) / 2
        actual_spread = data["ask"] - data["bid"]
        sigma = mid.rolling(20, min_periods=5).std().fillna(0.05)
        optimal_spread = self.compute_optimal_spread(sigma)

        return (actual_spread - optimal_spread).clip(lower=0)

    def generate_positions(self, signals: pd.Series, data: pd.DataFrame) -> pd.Series:
        """
        Simulated market-making: position proportional to spread capture.
        """
        max_pos = self.config.get("risk", {}).get("max_position_pct", 0.10)
        # Scale by signal strength (spread capture opportunity)
        normalized = signals / signals.quantile(0.95).clip(lower=0.001) if len(signals) > 0 else signals
        return normalized.clip(0, 1) * max_pos

    def simulate_pnl(self, data: pd.DataFrame) -> pd.Series:
        """
        Approximate PnL from market making.
        CAVEAT: This is a lower-bound estimate using top-of-book data only.
        """
        signals = self.generate_signals(data)
        positions = self.generate_positions(signals, data)

        # Spread capture minus inventory risk
        mid = data.get("yes_price", pd.Series(0.5, index=data.index))
        mid_returns = mid.pct_change().fillna(0)

        spread_capture = signals * 0.5  # Capture half the spread per side
        inventory_cost = positions.shift(1).fillna(0) * mid_returns.abs() * self.gamma

        return spread_capture - inventory_cost
