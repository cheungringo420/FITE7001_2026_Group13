"""
Market universe selection and quality filters.
Applies volume, price inversion, and dispute filters.
"""

import pandas as pd
import numpy as np
import yaml
from pathlib import Path


def _load_config() -> dict:
    config_path = Path(__file__).parent.parent / "config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


class UniverseFilter:
    """Filter prediction markets for quality and tradability."""

    def __init__(self, config: dict = None):
        self.config = config or _load_config()
        data_cfg = self.config["data"]
        self.min_volume = data_cfg["min_volume_usd"]
        self.inversion_upper = data_cfg["price_inversion_upper"]
        self.inversion_lower = data_cfg["price_inversion_lower"]

    def filter_by_volume(self, markets: pd.DataFrame, volume_col: str = "volume") -> pd.DataFrame:
        """Remove markets with total volume < threshold."""
        if volume_col not in markets.columns:
            return markets
        return markets[markets[volume_col] >= self.min_volume].copy()

    def filter_price_inversions(
        self,
        markets: pd.DataFrame,
        yes_col: str = "yes_price",
        no_col: str = "no_price",
    ) -> pd.DataFrame:
        """Remove markets where YES+NO is outside [lower, upper] bounds."""
        if yes_col not in markets.columns or no_col not in markets.columns:
            return markets
        total = markets[yes_col] + markets[no_col]
        mask = (total >= self.inversion_lower) & (total <= self.inversion_upper)
        return markets[mask].copy()

    def filter_disputes(self, markets: pd.DataFrame, dispute_col: str = "disputed") -> pd.DataFrame:
        """Exclude disputed or re-opened markets."""
        if dispute_col not in markets.columns:
            return markets
        return markets[~markets[dispute_col].fillna(False).astype(bool)].copy()

    def trailing_volume_filter(
        self,
        price_history: pd.DataFrame,
        window_days: int = 30,
        min_avg_daily_volume: float = 1000,
        volume_col: str = "volume",
    ) -> pd.DataFrame:
        """Use trailing N-day average volume (no forward look)."""
        if volume_col not in price_history.columns:
            return price_history
        rolling_vol = price_history[volume_col].rolling(window_days, min_periods=1).mean()
        return price_history[rolling_vol >= min_avg_daily_volume].copy()

    def apply_all_filters(self, markets: pd.DataFrame) -> pd.DataFrame:
        """Apply all quality filters in sequence."""
        df = markets.copy()
        initial_count = len(df)

        df = self.filter_by_volume(df)
        after_vol = len(df)

        df = self.filter_price_inversions(df)
        after_inv = len(df)

        df = self.filter_disputes(df)
        after_disp = len(df)

        print(
            f"[Universe] {initial_count} → vol:{after_vol} → inv:{after_inv} → disp:{after_disp}"
        )
        return df

    def select_cross_platform_pairs(
        self,
        poly_markets: pd.DataFrame,
        kalshi_markets: pd.DataFrame,
        min_alignment: float = 0.65,
        min_trust: float = 60,
    ) -> pd.DataFrame:
        """
        Select matched Polymarket-Kalshi pairs for cross-platform arbitrage.
        Uses alignment_score and trust_score columns if available.
        """
        # This is a placeholder — actual matching uses the platform's trust engine
        pairs = []
        for _, pm in poly_markets.iterrows():
            pm_q = pm.get("question", "").lower()
            for _, km in kalshi_markets.iterrows():
                km_q = km.get("title", "").lower()
                # Simple Jaccard similarity as fallback
                pm_tokens = set(pm_q.split())
                km_tokens = set(km_q.split())
                if not pm_tokens or not km_tokens:
                    continue
                jaccard = len(pm_tokens & km_tokens) / len(pm_tokens | km_tokens)
                if jaccard >= min_alignment:
                    pairs.append({
                        "poly_id": pm.get("id", ""),
                        "kalshi_id": km.get("ticker", ""),
                        "poly_question": pm.get("question", ""),
                        "kalshi_title": km.get("title", ""),
                        "alignment_score": jaccard,
                    })

        if not pairs:
            return pd.DataFrame()

        df = pd.DataFrame(pairs)
        return df.sort_values("alignment_score", ascending=False)
