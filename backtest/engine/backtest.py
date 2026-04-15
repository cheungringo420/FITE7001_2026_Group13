"""
Vectorized backtest engine.
Orchestrates data loading, strategy execution, cost computation, and result collection.
"""

import pandas as pd
import numpy as np
import yaml
from pathlib import Path
from typing import Optional

from ..strategies.base import Strategy
from .costs import CostModel
from .risk import RiskManager
from .portfolio import PortfolioAggregator


class BacktestEngine:
    """Main backtest orchestrator."""

    def __init__(self, config: Optional[dict] = None):
        if config is None:
            config_path = Path(__file__).parent.parent / "config.yaml"
            with open(config_path) as f:
                config = yaml.safe_load(f)
        self.config = config
        self.cost_model = CostModel(config)
        self.risk_manager = RiskManager(config)
        self.portfolio = PortfolioAggregator(config)
        self.initial_capital = config.get("risk", {}).get("initial_capital", 100000)

    def run_strategy(
        self,
        strategy: Strategy,
        data: pd.DataFrame,
        asset_returns: pd.Series,
        platform: str = "polymarket",
        split: str = "all",
    ) -> dict:
        """
        Run a single strategy through the vectorized backtest loop.

        Returns dict with:
          - signals, positions, returns, equity_curve
          - trade_log, metrics
        """
        # Split data if requested
        if split != "all":
            splits = strategy.split_data(data, self.config)
            if split in splits:
                data = splits[split]
                asset_returns = asset_returns.reindex(data.index).fillna(0)

        # 1. Generate signals (no look-ahead)
        signals = strategy.generate_signals(data)

        # 2. Convert to positions
        positions = strategy.generate_positions(signals, data)

        # 3. Apply risk limits
        positions = self.risk_manager.apply_position_limits(positions)

        # 4. Compute transaction costs from position changes
        costs = self.cost_model.position_change_costs(
            positions, platform=platform, capital=self.initial_capital
        )

        # 5. THE CORE: shift(1) prevents look-ahead bias
        returns = positions.shift(1) * asset_returns - costs
        returns = returns.fillna(0)

        # 6. Equity curve
        equity = (1 + returns).cumprod() * self.initial_capital

        # 7. Apply drawdown stop
        stopped = self.risk_manager.apply_drawdown_stop(equity)
        if stopped.any():
            stop_date = stopped.idxmax()
            returns[stopped] = 0.0
            equity = (1 + returns).cumprod() * self.initial_capital

        # 8. Build trade log
        trade_log = self._build_trade_log(positions, returns, equity)

        return {
            "strategy": strategy.name,
            "signals": signals,
            "positions": positions,
            "returns": returns,
            "equity_curve": equity,
            "costs": costs,
            "trade_log": trade_log,
            "split": split,
        }

    def run_all_splits(
        self,
        strategy: Strategy,
        data: pd.DataFrame,
        asset_returns: pd.Series,
        platform: str = "polymarket",
    ) -> dict:
        """Run strategy on train, validation, and test splits."""
        results = {}
        for split_name in ["train", "validation", "test"]:
            results[split_name] = self.run_strategy(
                strategy, data, asset_returns, platform, split=split_name
            )
        return results

    def run_walk_forward(
        self,
        strategy: Strategy,
        data: pd.DataFrame,
        asset_returns: pd.Series,
        platform: str = "polymarket",
        estimation_window: int = 90,
        holdout_window: int = 30,
    ) -> dict:
        """
        Walk-forward validation (MFIN7037 Lecture 4).
        Rolling estimation window with hold-out evaluation.
        """
        dates = data.index
        if len(dates) < estimation_window + holdout_window:
            return {"error": "Insufficient data for walk-forward"}

        all_oos_returns = []
        all_is_sharpes = []
        all_oos_sharpes = []

        i = estimation_window
        while i + holdout_window <= len(dates):
            # In-sample: fit
            is_data = data.iloc[i - estimation_window : i]
            is_returns = asset_returns.iloc[i - estimation_window : i]
            is_result = self.run_strategy(strategy, is_data, is_returns, platform, split="all")

            # Out-of-sample: evaluate
            oos_data = data.iloc[i : i + holdout_window]
            oos_returns = asset_returns.iloc[i : i + holdout_window]
            oos_result = self.run_strategy(strategy, oos_data, oos_returns, platform, split="all")

            is_sharpe = self._quick_sharpe(is_result["returns"])
            oos_sharpe = self._quick_sharpe(oos_result["returns"])

            all_oos_returns.append(oos_result["returns"])
            all_is_sharpes.append(is_sharpe)
            all_oos_sharpes.append(oos_sharpe)

            i += holdout_window

        oos_combined = pd.concat(all_oos_returns) if all_oos_returns else pd.Series(dtype=float)

        return {
            "oos_returns": oos_combined,
            "rolling_is_sharpe": all_is_sharpes,
            "rolling_oos_sharpe": all_oos_sharpes,
            "is_sharpe_mean": np.mean(all_is_sharpes) if all_is_sharpes else np.nan,
            "oos_sharpe_mean": np.mean(all_oos_sharpes) if all_oos_sharpes else np.nan,
            "overfit_flag": (
                np.mean(all_oos_sharpes) < 0.5 * np.mean(all_is_sharpes)
                if all_is_sharpes and all_oos_sharpes
                else None
            ),
        }

    def _quick_sharpe(self, returns: pd.Series) -> float:
        """Annualized Sharpe ratio."""
        if returns.empty or returns.std() == 0:
            return 0.0
        return returns.mean() / returns.std() * np.sqrt(252)

    def _build_trade_log(
        self, positions: pd.Series, returns: pd.Series, equity: pd.Series
    ) -> list:
        """Build a log of individual trades from position changes."""
        trades = []
        pos_changes = positions.diff().fillna(positions)
        entries = pos_changes[pos_changes != 0]

        in_trade = False
        entry_date = None
        entry_equity = None

        for dt, change in entries.items():
            if not in_trade and change != 0:
                in_trade = True
                entry_date = dt
                entry_equity = equity.get(dt, self.initial_capital)
            elif in_trade and change != 0:
                exit_equity = equity.get(dt, entry_equity)
                pnl = (exit_equity - entry_equity) / entry_equity if entry_equity else 0
                trades.append({
                    "entry": str(entry_date),
                    "exit": str(dt),
                    "pnl": round(pnl, 6),
                    "entry_equity": round(entry_equity, 2),
                    "exit_equity": round(exit_equity, 2),
                })
                entry_date = dt
                entry_equity = exit_equity
                if change == 0:
                    in_trade = False

        return trades
