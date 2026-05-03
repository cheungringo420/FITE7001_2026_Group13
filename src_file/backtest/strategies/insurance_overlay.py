"""
Strategy 3: Event-Specific Insurance Overlay
Signal: Trust score ≥ 70 AND liquidity ≥ $50K AND event aligns with portfolio risk.
Position sizing: Quarter-Kelly.
Hold: Until market resolution.
Test: Beta of strategy returns vs SPY during event windows — target: negative beta.
"""

import pandas as pd
import numpy as np
from .base import Strategy


class InsuranceOverlay(Strategy):
    name = "insurance_overlay"
    description = "Event-specific insurance using prediction markets as hedges"
    max_params = 2  # min_trust_score, min_liquidity

    def __init__(self, config: dict):
        super().__init__(config)
        strat_cfg = config.get("strategies", {}).get("insurance_overlay", {})
        self.min_trust = strat_cfg.get("min_trust_score", 70)
        self.min_liquidity = strat_cfg.get("min_liquidity_usd", 50000)
        self.params = {
            "min_trust_score": self.min_trust,
            "min_liquidity_usd": self.min_liquidity,
        }

    def identify_hedge_candidates(self, data: pd.DataFrame) -> pd.Series:
        """
        Identify markets suitable as portfolio hedges.
        Requires: trust_score, liquidity, event_category, yes_price columns.
        """
        mask = pd.Series(True, index=data.index)

        if "trust_score" in data.columns:
            mask &= data["trust_score"] >= self.min_trust
        if "liquidity" in data.columns:
            mask &= data["liquidity"] >= self.min_liquidity
        if "event_category" in data.columns:
            # Geopolitical events hedge equity portfolios
            geo_cats = {"geopolitical", "conflict", "sanctions", "war", "trade"}
            mask &= data["event_category"].str.lower().isin(geo_cats)

        return mask

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        """
        Signal = 1 for markets that qualify as insurance, 0 otherwise.
        """
        candidates = self.identify_hedge_candidates(data)
        return candidates.astype(float)

    def generate_positions(self, signals: pd.Series, data: pd.DataFrame) -> pd.Series:
        """
        Quarter-Kelly position sizing for qualifying hedge positions.
        """
        positions = pd.Series(0.0, index=signals.index)
        kelly_frac = self.config.get("risk", {}).get("kelly_fraction", 0.25)

        for i, (dt, sig) in enumerate(signals.items()):
            if sig <= 0:
                continue

            prob = data.get("implied_prob", pd.Series(0.5, index=data.index)).iloc[i]
            price = data.get("yes_price", pd.Series(0.5, index=data.index)).iloc[i]

            size = self.kelly_size(
                prob=prob,
                entry_price=price,
                kelly_fraction=kelly_frac,
            )
            positions.iloc[i] = size

        return positions

    def compute_hedge_effectiveness(
        self, strategy_returns: pd.Series, spy_returns: pd.Series
    ) -> dict:
        """
        Measure hedge effectiveness: beta vs SPY during event windows.
        Target: negative beta (genuine hedge).
        """
        common = strategy_returns.index.intersection(spy_returns.index)
        if len(common) < 20:
            return {"beta": np.nan, "correlation": np.nan}

        sr = strategy_returns.loc[common].values
        mr = spy_returns.loc[common].values

        cov = np.cov(sr, mr)
        beta = cov[0, 1] / cov[1, 1] if cov[1, 1] != 0 else np.nan
        corr = np.corrcoef(sr, mr)[0, 1]

        return {
            "beta_vs_spy": beta,
            "correlation_vs_spy": corr,
            "is_genuine_hedge": beta < 0 if not np.isnan(beta) else False,
        }
