"""
Strategy 2: Volatility Timing via Lead-Lag Arbitrage
Hypothesis: Prediction market probability P(t) leads VIX by 3-5 trading days.
Signal: Daily change in event probability ΔP = P(t) - P(t-1)
Entry: |ΔP| > threshold (tuned on train; expected 8-15pp)
Trade: Long VIX calls when ΔP > +threshold
"""

import pandas as pd
import numpy as np
from .base import Strategy


class LeadLagVolatility(Strategy):
    name = "lead_lag_vol"
    description = "Volatility timing via prediction market lead-lag"
    max_params = 3  # delta_p_threshold, holding_period, rolling_window

    def __init__(self, config: dict):
        super().__init__(config)
        strat_cfg = config.get("strategies", {}).get("lead_lag_vol", {})
        self.delta_p_threshold = strat_cfg.get("delta_p_threshold", 0.08)
        self.holding_period = strat_cfg.get("holding_period_range", [1, 5])
        self.rolling_window = strat_cfg.get("rolling_window", 90)
        self.newey_west_lag = strat_cfg.get("newey_west_lag", 5)
        self.params = {
            "delta_p_threshold": self.delta_p_threshold,
            "holding_period": self.holding_period[0],
            "rolling_window": self.rolling_window,
        }

    def compute_caets(
        self, event_prob: pd.Series, asset_returns: pd.Series, window: int = 90, lag: int = 1
    ) -> pd.Series:
        """
        Cross-Asset Event Transmission Score (NC2).
        Rolling beta of asset returns on lagged probability changes.
        CAETS(asset, event, t) = β from rolling OLS: R_asset(t+lag) ~ ΔP_event(t)
        """
        delta_p = event_prob.diff()

        # Align: delta_p at t predicts asset_returns at t+lag
        y = asset_returns.shift(-lag)  # Future returns (only used in fitting, not in signal)
        x = delta_p

        # Rolling OLS
        betas = pd.Series(np.nan, index=event_prob.index)
        for i in range(window, len(x)):
            x_win = x.iloc[i - window : i].dropna()
            y_win = y.iloc[i - window : i].dropna()
            common = x_win.index.intersection(y_win.index)
            if len(common) < 20:
                continue
            xc = x_win.loc[common].values
            yc = y_win.loc[common].values
            xc_dm = xc - xc.mean()
            denom = (xc_dm ** 2).sum()
            if denom == 0:
                continue
            betas.iloc[i] = (xc_dm * (yc - yc.mean())).sum() / denom

        return betas

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        """
        Signal = ΔP when |ΔP| > threshold, else 0.
        Requires column 'event_prob' for prediction market probability.
        """
        if "event_prob" not in data.columns:
            return pd.Series(0.0, index=data.index)

        delta_p = data["event_prob"].diff()

        signals = pd.Series(0.0, index=data.index)
        signals[delta_p > self.delta_p_threshold] = delta_p[delta_p > self.delta_p_threshold]
        signals[delta_p < -self.delta_p_threshold] = delta_p[delta_p < -self.delta_p_threshold]

        return signals

    def generate_positions(self, signals: pd.Series, data: pd.DataFrame) -> pd.Series:
        """
        Long VIX when positive signal, short when negative.
        Position held for holding_period days.
        """
        max_pos = self.config.get("risk", {}).get("max_position_pct", 0.10)
        hold = self.holding_period[0]

        # Raw position direction
        raw = np.sign(signals) * max_pos

        # Hold position for holding_period days
        positions = pd.Series(0.0, index=signals.index)
        active_until = None
        active_pos = 0.0

        for i, (dt, sig) in enumerate(raw.items()):
            if sig != 0:
                active_pos = sig
                active_until = i + hold
            if active_until is not None and i < active_until:
                positions.iloc[i] = active_pos
            elif active_until is not None and i >= active_until:
                active_until = None
                active_pos = 0.0

        return positions
