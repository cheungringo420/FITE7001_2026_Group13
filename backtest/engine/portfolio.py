"""
Multi-strategy portfolio aggregation.
Combines returns from multiple strategies with correlation-aware weighting.
"""

import pandas as pd
import numpy as np
from typing import Optional


class PortfolioAggregator:
    """Aggregate multiple strategy return streams into a portfolio."""

    def __init__(self, config: dict):
        self.config = config
        self.initial_capital = config.get("risk", {}).get("initial_capital", 100000)

    def equal_weight(self, strategy_returns: dict[str, pd.Series]) -> pd.Series:
        """Equal-weight portfolio of all strategies."""
        if not strategy_returns:
            return pd.Series(dtype=float)

        df = pd.DataFrame(strategy_returns)
        return df.mean(axis=1)

    def inverse_vol_weight(self, strategy_returns: dict[str, pd.Series], lookback: int = 60) -> pd.Series:
        """Inverse-volatility weighted portfolio."""
        df = pd.DataFrame(strategy_returns)
        if df.empty:
            return pd.Series(dtype=float)

        rolling_vol = df.rolling(lookback, min_periods=20).std()
        inv_vol = 1.0 / rolling_vol.clip(lower=0.001)
        weights = inv_vol.div(inv_vol.sum(axis=1), axis=0)
        return (df * weights).sum(axis=1)

    def aggregate(
        self,
        strategy_returns: dict[str, pd.Series],
        method: str = "equal_weight",
    ) -> pd.Series:
        """Aggregate strategy returns using specified method."""
        if method == "equal_weight":
            return self.equal_weight(strategy_returns)
        elif method == "inverse_vol":
            return self.inverse_vol_weight(strategy_returns)
        else:
            return self.equal_weight(strategy_returns)

    def compute_portfolio_equity(
        self, portfolio_returns: pd.Series, initial_capital: Optional[float] = None
    ) -> pd.Series:
        """Compute equity curve from portfolio returns."""
        cap = initial_capital or self.initial_capital
        return (1 + portfolio_returns).cumprod() * cap

    def correlation_matrix(self, strategy_returns: dict[str, pd.Series]) -> pd.DataFrame:
        """Compute pairwise correlation between strategies."""
        df = pd.DataFrame(strategy_returns)
        return df.corr()

    def strategy_contribution(
        self, strategy_returns: dict[str, pd.Series], weights: Optional[dict] = None
    ) -> pd.DataFrame:
        """Break down portfolio return into strategy contributions."""
        df = pd.DataFrame(strategy_returns)
        if weights is None:
            n = len(df.columns)
            weights = {col: 1.0 / n for col in df.columns}

        contributions = pd.DataFrame()
        for col in df.columns:
            contributions[col] = df[col] * weights.get(col, 0)

        contributions["total"] = contributions.sum(axis=1)
        return contributions
