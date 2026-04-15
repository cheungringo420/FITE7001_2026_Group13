"""
Risk management: Kelly sizing, drawdown stops, position limits.
"""

import pandas as pd
import numpy as np


class RiskManager:
    """Portfolio-level risk management."""

    def __init__(self, config: dict):
        risk_cfg = config.get("risk", {})
        self.max_position_pct = risk_cfg.get("max_position_pct", 0.10)
        self.max_drawdown_stop = risk_cfg.get("max_drawdown_stop", 0.15)
        self.kelly_fraction = risk_cfg.get("kelly_fraction", 0.25)
        self.max_notional = risk_cfg.get("max_notional_usd", 10000)
        self.initial_capital = risk_cfg.get("initial_capital", 100000)

    def apply_position_limits(self, positions: pd.Series) -> pd.Series:
        """Clip positions to max_position_pct."""
        return positions.clip(-self.max_position_pct, self.max_position_pct)

    def apply_notional_limits(
        self, positions: pd.Series, capital: float = None
    ) -> pd.Series:
        """Ensure notional value doesn't exceed max_notional_usd."""
        capital = capital or self.initial_capital
        max_frac = self.max_notional / capital
        return positions.clip(-max_frac, max_frac)

    def apply_drawdown_stop(self, equity_curve: pd.Series) -> pd.Series:
        """
        Return a boolean mask: True = strategy is stopped.
        Once stopped at 15% drawdown, stays stopped.
        """
        running_max = equity_curve.expanding().max()
        drawdown = (equity_curve - running_max) / running_max
        stopped = (drawdown < -self.max_drawdown_stop).cummax()
        return stopped

    def kelly_size_binary(
        self,
        prob: float,
        entry_price: float,
        dispute_risk: float = 0.02,
        counterparty_risk: float = 0.01,
    ) -> float:
        """
        Binary-payoff Kelly criterion (NC3).
        f* = (p*b - q) / b × kelly_fraction × (1 - dispute) × (1 - counterparty)
        """
        if entry_price <= 0 or entry_price >= 1:
            return 0.0

        b = (1 / entry_price) - 1
        q = 1 - prob
        f_star = (prob * b - q) / b

        if f_star <= 0:
            return 0.0

        f_adj = f_star * self.kelly_fraction * (1 - dispute_risk) * (1 - counterparty_risk)
        return max(0.0, min(f_adj, self.max_position_pct))

    def compute_drawdown_series(self, equity_curve: pd.Series) -> pd.Series:
        """Compute running drawdown from equity curve."""
        running_max = equity_curve.expanding().max()
        return (equity_curve - running_max) / running_max

    def risk_adjusted_positions(
        self,
        positions: pd.Series,
        equity_curve: pd.Series,
    ) -> pd.Series:
        """Apply all risk limits to positions."""
        pos = self.apply_position_limits(positions)
        pos = self.apply_notional_limits(pos)

        # Zero out after drawdown stop
        stopped = self.apply_drawdown_stop(equity_curve)
        pos[stopped] = 0.0

        return pos
