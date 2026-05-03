"""
Strategy 1: Cross-Platform Arbitrage (Polymarket vs Kalshi)
Signal: profit = max(0, 1 - YES_poly - NO_kalshi, 1 - NO_poly - YES_kalshi)
Entry: profit_net_of_costs > min_threshold
Exit: Market resolution OR price convergence
"""

import pandas as pd
import numpy as np
from .base import Strategy


class CrossPlatformArbitrage(Strategy):
    name = "cross_platform_arb"
    description = "Cross-platform arbitrage between Polymarket and Kalshi"
    max_params = 3  # min_profit_threshold, min_alignment_score, min_trust_score

    def __init__(self, config: dict):
        super().__init__(config)
        strat_cfg = config.get("strategies", {}).get("cross_platform_arb", {})
        self.min_profit_threshold = strat_cfg.get("min_profit_threshold", 0.01)
        self.min_alignment = strat_cfg.get("min_alignment_score", 0.65)
        self.min_trust = strat_cfg.get("min_trust_score", 60)
        self.params = {
            "min_profit_threshold": self.min_profit_threshold,
            "min_alignment_score": self.min_alignment,
            "min_trust_score": self.min_trust,
        }

    def compute_arbitrage_profit(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Compute gross arbitrage profit for matched pairs.
        Expected columns: yes_poly, no_poly, yes_kalshi, no_kalshi
        """
        profit_a = 1 - data["yes_poly"] - data["no_kalshi"]
        profit_b = 1 - data["no_poly"] - data["yes_kalshi"]
        data = data.copy()
        data["gross_profit"] = np.maximum(0, np.maximum(profit_a, profit_b))
        data["direction"] = np.where(profit_a >= profit_b, "poly_yes_kalshi_no", "poly_no_kalshi_yes")
        return data

    def compute_raas(
        self, gross_profit: pd.Series, alignment_score: pd.Series, dispute_risk: pd.Series
    ) -> pd.Series:
        """
        Resolution-Aware Arbitrage Signal (NC1).
        RAAS = profit_pct × resolution_alignment_score × (1 - dispute_risk)
        """
        return gross_profit * alignment_score * (1 - dispute_risk)

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        """
        Signal strength = RAAS score if above threshold, else 0.
        """
        if data.empty:
            return pd.Series(dtype=float)

        arb = self.compute_arbitrage_profit(data)

        alignment = data.get("alignment_score", pd.Series(0.7, index=data.index)).fillna(0.0)
        trust_score = data.get("trust_score", pd.Series(self.min_trust, index=data.index)).fillna(0.0)
        dispute_risk = data.get("dispute_risk", pd.Series(0.02, index=data.index)).fillna(1.0)

        raas = self.compute_raas(arb["gross_profit"], alignment, dispute_risk)

        # Apply cost estimate
        poly_cost = self.config.get("costs", {}).get("polymarket", {}).get("spread_bps", 100) / 10000
        kalshi_cost = self.config.get("costs", {}).get("kalshi", {}).get("spread_bps", 150) / 10000
        total_cost = poly_cost + kalshi_cost

        net_profit = arb["gross_profit"] - total_cost
        eligible = (alignment >= self.min_alignment) & (trust_score >= self.min_trust)
        signals = raas.where((net_profit > self.min_profit_threshold) & eligible, 0.0)
        return signals

    def generate_positions(self, signals: pd.Series, data: pd.DataFrame) -> pd.Series:
        """
        Position size: Kelly-based for profitable signals, 0 otherwise.
        For arb, we use a simplified sizing: fixed fraction when signal > 0.
        """
        max_pos = self.config.get("risk", {}).get("max_position_pct", 0.10)
        positions = signals.clip(0, 1) * max_pos
        return positions
