"""
Transaction cost and slippage models.
Implements the cost table from the spec (Section 1.3).
"""

import pandas as pd
import numpy as np


class CostModel:
    """Compute transaction costs for different platforms."""

    def __init__(self, config: dict):
        self.costs = config.get("costs", {})

    def polymarket_cost(
        self,
        trade_value: pd.Series,
        daily_volume: pd.Series = None,
    ) -> pd.Series:
        """
        Polymarket: 100bps spread + slippage + gas.
        Slippage = 0.1% * sqrt(order / daily_vol)
        """
        cfg = self.costs.get("polymarket", {})
        spread = trade_value * cfg.get("spread_bps", 100) / 10000

        slippage = pd.Series(0.0, index=trade_value.index)
        if daily_volume is not None:
            ratio = trade_value / daily_volume.clip(lower=1)
            slippage = trade_value * cfg.get("slippage_pct", 0.001) * np.sqrt(ratio)

        gas = cfg.get("gas_per_tx", 0.03)

        return spread + slippage + gas

    def kalshi_cost(
        self, trade_value: pd.Series, daily_volume: pd.Series = None
    ) -> pd.Series:
        """Kalshi: 150bps spread + slippage."""
        cfg = self.costs.get("kalshi", {})
        spread = trade_value * cfg.get("spread_bps", 150) / 10000

        slippage = pd.Series(0.0, index=trade_value.index)
        if daily_volume is not None:
            ratio = trade_value / daily_volume.clip(lower=1)
            slippage = trade_value * cfg.get("slippage_pct", 0.001) * np.sqrt(ratio)

        return spread + slippage

    def vix_options_cost(self, num_contracts: pd.Series) -> pd.Series:
        """VIX options: 50bps spread + $0.65/contract."""
        cfg = self.costs.get("vix_options", {})
        commission = num_contracts * cfg.get("commission_per_contract", 0.65)
        return commission

    def equity_etf_cost(self, trade_value: pd.Series) -> pd.Series:
        """Equity ETFs: 5bps spread, negligible other costs."""
        cfg = self.costs.get("equity_etfs", {})
        spread = trade_value * cfg.get("spread_bps", 5) / 10000
        return spread

    def short_selling_cost(
        self, position_value: pd.Series, holding_days: int = 1
    ) -> pd.Series:
        """Short-selling borrow cost: ~80bps/year (Dreschler & Dreschler 2013)."""
        cfg = self.costs.get("short_selling", {})
        annual_rate = cfg.get("borrow_cost_bps_yr", 80) / 10000
        daily_rate = annual_rate / 252
        return position_value * daily_rate * holding_days

    def compute_total_cost(
        self,
        platform: str,
        trade_value: pd.Series,
        daily_volume: pd.Series = None,
    ) -> pd.Series:
        """Compute total cost for a given platform."""
        if platform == "polymarket":
            return self.polymarket_cost(trade_value, daily_volume)
        elif platform == "kalshi":
            return self.kalshi_cost(trade_value, daily_volume)
        elif platform == "vix_options":
            return self.vix_options_cost(trade_value)
        elif platform in ("equity_etfs", "spy", "gld", "uso", "tlt", "uup"):
            return self.equity_etf_cost(trade_value)
        else:
            # Default: 50bps
            return trade_value * 0.005

    def position_change_costs(
        self,
        positions: pd.Series,
        platform: str,
        capital: float = 100000,
        daily_volume: pd.Series = None,
    ) -> pd.Series:
        """Compute costs from position changes (entries and exits)."""
        pos_changes = positions.diff().abs().fillna(0)
        trade_values = pos_changes * capital
        return self.compute_total_cost(platform, trade_values, daily_volume) / capital
