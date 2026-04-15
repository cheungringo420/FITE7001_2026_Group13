"""
Abstract base class for all backtesting strategies.
Every strategy produces a positions Series aligned to trading dates.
"""

from abc import ABC, abstractmethod
from typing import Optional

import pandas as pd
import numpy as np


class Strategy(ABC):
    """Base strategy interface for vectorized backtesting."""

    name: str = "base"
    description: str = ""
    max_params: int = 3  # Overfitting guard: ≤3 parameters per strategy

    def __init__(self, config: dict):
        self.config = config
        self.params: dict = {}

    @abstractmethod
    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        """
        Generate trading signals from input data.
        Returns a Series of signal strengths (positive = long, negative = short).
        MUST use only data[:t] at each point — no look-ahead.
        """
        ...

    @abstractmethod
    def generate_positions(self, signals: pd.Series, data: pd.DataFrame) -> pd.Series:
        """
        Convert signals to position sizes (fraction of capital).
        Applies risk limits and Kelly sizing.
        """
        ...

    def compute_returns(
        self,
        positions: pd.Series,
        asset_returns: pd.Series,
        costs: Optional[pd.Series] = None,
    ) -> pd.Series:
        """
        Core backtest return computation.
        positions.shift(1) prevents look-ahead bias:
        today's position was sized using yesterday's signal.
        """
        if costs is None:
            costs = pd.Series(0.0, index=positions.index)

        # THE SINGLE MOST IMPORTANT LINE: shift(1) prevents look-ahead bias
        returns = positions.shift(1) * asset_returns - costs
        return returns

    def compute_equity_curve(
        self, returns: pd.Series, initial_capital: float = 100000
    ) -> pd.Series:
        """Compute cumulative equity curve from return series."""
        equity = (1 + returns).cumprod() * initial_capital
        return equity

    def kelly_size(
        self,
        prob: float,
        entry_price: float,
        kelly_fraction: float = 0.25,
        dispute_risk: float = 0.02,
        counterparty_risk: float = 0.01,
    ) -> float:
        """
        Binary-payoff Kelly criterion (NC3 from spec).
        f* = (p*b - q) / b × (1 - P_dispute) × (1 - P_counterparty)
        """
        if entry_price <= 0 or entry_price >= 1:
            return 0.0

        b = (1 / entry_price) - 1  # Binary payout odds
        q = 1 - prob
        f_star = (prob * b - q) / b

        if f_star <= 0:
            return 0.0

        # Apply safety adjustments
        f_adjusted = f_star * kelly_fraction * (1 - dispute_risk) * (1 - counterparty_risk)
        return max(0.0, min(f_adjusted, self.config.get("risk", {}).get("max_position_pct", 0.10)))

    def apply_drawdown_stop(
        self, equity: pd.Series, max_drawdown: float = 0.15
    ) -> pd.Series:
        """Zero out positions after max drawdown is breached."""
        running_max = equity.expanding().max()
        drawdown = (equity - running_max) / running_max
        stopped = drawdown < -max_drawdown

        # Once stopped, stay stopped
        mask = stopped.cummax()
        return mask

    def split_data(self, data: pd.DataFrame, config: dict) -> dict:
        """Split data into train/validation/test per config."""
        train_end = pd.Timestamp(config["splits"]["train_end"])
        val_end = pd.Timestamp(config["splits"]["validation_end"])
        test_start = pd.Timestamp(config["splits"]["test_start"])

        return {
            "train": data[data.index <= train_end],
            "validation": data[(data.index > train_end) & (data.index <= val_end)],
            "test": data[data.index >= test_start],
        }
