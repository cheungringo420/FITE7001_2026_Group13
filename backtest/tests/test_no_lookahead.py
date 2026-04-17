"""Critical correctness test: engine must never use today's signal for today's return."""

import numpy as np
import pandas as pd
import pytest

from backtest.engine import BacktestEngine
from backtest.strategies.base import Strategy


class PerfectOracleStrategy(Strategy):
    """
    Look-ahead-bias trap strategy.

    Sets signal[t] = sign(asset_return[t]). If the engine shifts positions by 1,
    the strategy will only capture returns when consecutive days have the same sign
    — a lossy, near-zero performance. If the engine leaks the future (no shift),
    it will capture every single daily move and achieve an enormous Sharpe.
    """

    name = "oracle"
    description = "leaks future returns if engine fails to shift"

    def __init__(self, config, asset_returns: pd.Series):
        super().__init__(config)
        self._asset_returns = asset_returns

    def generate_signals(self, data: pd.DataFrame) -> pd.Series:
        aligned = self._asset_returns.reindex(data.index).fillna(0)
        return np.sign(aligned)

    def generate_positions(self, signals: pd.Series, data: pd.DataFrame) -> pd.Series:
        return signals * 0.1


def test_engine_shifts_positions_to_prevent_lookahead(config, daily_returns):
    """An oracle that sees today's return must NOT earn unrealistic Sharpe."""
    data = pd.DataFrame({"price": (1 + daily_returns).cumprod()}, index=daily_returns.index)
    strategy = PerfectOracleStrategy(config, daily_returns)

    # Disable cost model so we isolate the shift behavior
    config_no_costs = {**config, "costs": {"polymarket": {"spread_bps": 0, "slippage_pct": 0, "gas_per_tx": 0}}}
    engine = BacktestEngine(config_no_costs)
    result = engine.run_strategy(strategy, data, daily_returns, platform="polymarket", split="all")

    returns = result["returns"]
    if returns.std() == 0:
        sharpe = 0.0
    else:
        sharpe = returns.mean() / returns.std() * np.sqrt(252)

    # If the engine leaked the future, Sharpe would be ~15+ (magnitude of |sign|*vol).
    # With shift(1), Sharpe depends on autocorrelation of sign — for iid normal returns
    # this should be near zero.
    assert abs(sharpe) < 3.0, f"Sharpe={sharpe:.2f} is suspiciously high; shift(1) may be missing"


def test_first_return_is_zero_due_to_shift(config, daily_returns):
    """Position at t=0 shifts to NaN → return[0] must be 0 after fillna."""
    data = pd.DataFrame({"price": 1.0}, index=daily_returns.index)
    strategy = PerfectOracleStrategy(config, daily_returns)

    config_no_costs = {**config, "costs": {"polymarket": {"spread_bps": 0, "slippage_pct": 0, "gas_per_tx": 0}}}
    engine = BacktestEngine(config_no_costs)
    result = engine.run_strategy(strategy, data, daily_returns, platform="polymarket", split="all")

    assert result["returns"].iloc[0] == 0.0
