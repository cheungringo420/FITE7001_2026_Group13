"""
Strategy 4: Dynamic Hedge Ratio Calibration
Rule: hedge_ratio(t) = base_ratio × f(P(t))
  f(P) = P if P > 0.5; f(P) = 0 if P < 0.2; linear interpolation between
Test: Compare dynamic vs static hedge effectiveness and carry cost.
"""

import pandas as pd
import numpy as np
from .base import Strategy


class DynamicHedge(Strategy):
    name = "dynamic_hedge"
    description = "Dynamic hedge ratio calibration using prediction market probabilities"
    max_params = 3  # base_ratio, p_high, p_low

    def __init__(self, config: dict):
        super().__init__(config)
        strat_cfg = config.get("strategies", {}).get("dynamic_hedge", {})
        self.base_ratio = strat_cfg.get("base_ratio", 0.10)
        self.p_high = strat_cfg.get("p_high", 0.5)
        self.p_low = strat_cfg.get("p_low", 0.2)
        self.params = {
            "base_ratio": self.base_ratio,
            "p_high": self.p_high,
            "p_low": self.p_low,
        }

    def _scaling_function(self, prob: pd.Series) -> pd.Series:
        """
        f(P) = P if P > p_high
        f(P) = 0 if P < p_low
        Linear interpolation between p_low and p_high.
        """
        f = pd.Series(0.0, index=prob.index)
        # Above p_high: full scaling by probability
        high_mask = prob > self.p_high
        f[high_mask] = prob[high_mask]
        # Between p_low and p_high: linear interpolation
        mid_mask = (prob >= self.p_low) & (prob <= self.p_high)
        f[mid_mask] = (prob[mid_mask] - self.p_low) / (self.p_high - self.p_low) * self.p_high
        return f

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        """
        Signal = dynamic hedge ratio = base_ratio × f(P(t)).
        Requires 'event_prob' column.
        """
        if "event_prob" not in data.columns:
            return pd.Series(0.0, index=data.index)

        f = self._scaling_function(data["event_prob"])
        return self.base_ratio * f

    def generate_positions(self, signals: pd.Series, data: pd.DataFrame) -> pd.Series:
        """
        Position in hedge asset (GLD, USO) = signal value.
        Already bounded by base_ratio * 1.0 = 10%.
        """
        max_pos = self.config.get("risk", {}).get("max_position_pct", 0.10)
        return signals.clip(0, max_pos)

    def compute_static_baseline(self, data: pd.DataFrame) -> pd.Series:
        """Static hedge for comparison: constant base_ratio."""
        return pd.Series(self.base_ratio, index=data.index)

    def compare_hedge_effectiveness(
        self,
        dynamic_returns: pd.Series,
        static_returns: pd.Series,
        equity_returns: pd.Series,
    ) -> dict:
        """Compare dynamic vs static hedge during drawdowns."""
        common = dynamic_returns.index.intersection(static_returns.index).intersection(
            equity_returns.index
        )
        eq = equity_returns.loc[common]
        dyn = dynamic_returns.loc[common]
        sta = static_returns.loc[common]

        # Drawdown periods: when equity return < -1%
        drawdown_mask = eq < -0.01
        if drawdown_mask.sum() < 5:
            return {"insufficient_drawdown_data": True}

        dyn_drawdown = dyn[drawdown_mask]
        sta_drawdown = sta[drawdown_mask]

        return {
            "dynamic_mean_during_drawdown": dyn_drawdown.mean(),
            "static_mean_during_drawdown": sta_drawdown.mean(),
            "dynamic_better": dyn_drawdown.mean() > sta_drawdown.mean(),
            "carry_cost_saved": (sta.mean() - dyn.mean()) * 252,  # Annualized
        }
