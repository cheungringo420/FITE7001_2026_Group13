"""
Risk metrics: VaR, CVaR, tail risk analysis.
"""

import pandas as pd
import numpy as np
from scipy import stats


class RiskMetrics:
    """Advanced risk metrics for strategy evaluation."""

    @staticmethod
    def value_at_risk(returns: pd.Series, confidence: float = 0.95) -> float:
        """Historical VaR at given confidence level."""
        if returns.empty:
            return 0.0
        return np.percentile(returns, (1 - confidence) * 100)

    @staticmethod
    def conditional_var(returns: pd.Series, confidence: float = 0.95) -> float:
        """CVaR (Expected Shortfall) — mean of returns below VaR."""
        var = RiskMetrics.value_at_risk(returns, confidence)
        tail = returns[returns <= var]
        return tail.mean() if not tail.empty else var

    @staticmethod
    def tail_ratio(returns: pd.Series) -> float:
        """Ratio of 95th percentile to abs(5th percentile). >1 = positive skew."""
        if returns.empty:
            return 0.0
        p95 = np.percentile(returns, 95)
        p5 = abs(np.percentile(returns, 5))
        return p95 / p5 if p5 != 0 else np.inf

    @staticmethod
    def skewness(returns: pd.Series) -> float:
        if returns.empty or len(returns) < 3:
            return 0.0
        return float(stats.skew(returns.dropna()))

    @staticmethod
    def kurtosis(returns: pd.Series) -> float:
        """Excess kurtosis (Fisher). >0 = fat tails."""
        if returns.empty or len(returns) < 4:
            return 0.0
        return float(stats.kurtosis(returns.dropna()))

    @staticmethod
    def max_consecutive_losses(returns: pd.Series) -> int:
        """Maximum number of consecutive negative return days."""
        if returns.empty:
            return 0
        negative = (returns < 0).astype(int)
        groups = negative.diff().ne(0).cumsum()
        streaks = negative.groupby(groups).sum()
        return int(streaks.max()) if not streaks.empty else 0

    @classmethod
    def compute_all(cls, returns: pd.Series) -> dict:
        return {
            "var_95": round(cls.value_at_risk(returns, 0.95), 6),
            "cvar_95": round(cls.conditional_var(returns, 0.95), 6),
            "var_99": round(cls.value_at_risk(returns, 0.99), 6),
            "cvar_99": round(cls.conditional_var(returns, 0.99), 6),
            "tail_ratio": round(cls.tail_ratio(returns), 4),
            "skewness": round(cls.skewness(returns), 4),
            "kurtosis": round(cls.kurtosis(returns), 4),
            "max_consecutive_losses": cls.max_consecutive_losses(returns),
        }
