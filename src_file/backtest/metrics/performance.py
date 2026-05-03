"""
Performance metrics: Sharpe, Sortino, Calmar, max drawdown, win rate.
Implements Step 1 of the MFIN7037 backtest checklist.
"""

import pandas as pd
import numpy as np


class PerformanceMetrics:
    """Compute standard performance metrics for strategy returns."""

    @staticmethod
    def annualized_return(returns: pd.Series) -> float:
        """Ann. Return = (1 + mean_daily_return)^252 - 1"""
        if returns.empty:
            return 0.0
        return (1 + returns.mean()) ** 252 - 1

    @staticmethod
    def annualized_volatility(returns: pd.Series) -> float:
        """Ann. Volatility = daily_std × sqrt(252)"""
        if returns.empty:
            return 0.0
        return returns.std() * np.sqrt(252)

    @staticmethod
    def sharpe_ratio(returns: pd.Series, rf: float = 0.0) -> float:
        """Sharpe = (ann_return - rf) / ann_vol [no Rf for L/S portfolios]"""
        vol = PerformanceMetrics.annualized_volatility(returns)
        if vol == 0:
            return 0.0
        ret = PerformanceMetrics.annualized_return(returns)
        return (ret - rf) / vol

    @staticmethod
    def sortino_ratio(returns: pd.Series) -> float:
        """Sortino = ann_return / downside_std × sqrt(252)"""
        if returns.empty:
            return 0.0
        downside = returns[returns < 0]
        if downside.empty or downside.std() == 0:
            return 0.0 if returns.mean() <= 0 else np.inf
        downside_std_ann = downside.std() * np.sqrt(252)
        return PerformanceMetrics.annualized_return(returns) / downside_std_ann

    @staticmethod
    def calmar_ratio(returns: pd.Series) -> float:
        """Calmar = ann_return / |max_drawdown|"""
        max_dd = PerformanceMetrics.max_drawdown(returns)
        if max_dd == 0:
            return 0.0
        return PerformanceMetrics.annualized_return(returns) / abs(max_dd)

    @staticmethod
    def max_drawdown(returns: pd.Series) -> float:
        """Maximum drawdown from equity curve."""
        if returns.empty:
            return 0.0
        equity = (1 + returns).cumprod()
        running_max = equity.expanding().max()
        drawdown = (equity - running_max) / running_max
        return drawdown.min()

    @staticmethod
    def win_rate(trade_pnls: list[float]) -> float:
        """Win Rate = count(positive_trades) / count(all_trades)"""
        if not trade_pnls:
            return 0.0
        wins = sum(1 for p in trade_pnls if p > 0)
        return wins / len(trade_pnls)

    @staticmethod
    def avg_win_loss_ratio(trade_pnls: list[float]) -> float:
        """Avg Win / Avg Loss"""
        wins = [p for p in trade_pnls if p > 0]
        losses = [p for p in trade_pnls if p < 0]
        if not wins or not losses:
            return 0.0
        return abs(np.mean(wins) / np.mean(losses))

    @staticmethod
    def total_trades(trade_log: list[dict]) -> int:
        return len(trade_log)

    @classmethod
    def compute_all(cls, returns: pd.Series, trade_log: list[dict] = None) -> dict:
        """Compute all performance metrics (Step 1 of checklist)."""
        trade_pnls = [t["pnl"] for t in (trade_log or [])]
        return {
            "ann_return": round(cls.annualized_return(returns), 6),
            "ann_vol": round(cls.annualized_volatility(returns), 6),
            "sharpe": round(cls.sharpe_ratio(returns), 4),
            "sortino": round(cls.sortino_ratio(returns), 4),
            "calmar": round(cls.calmar_ratio(returns), 4),
            "max_drawdown": round(cls.max_drawdown(returns), 6),
            "win_rate": round(cls.win_rate(trade_pnls), 4),
            "avg_win_loss": round(cls.avg_win_loss_ratio(trade_pnls), 4),
            "total_trades": cls.total_trades(trade_log or []),
        }
