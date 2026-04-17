"""Shared fixtures for backtest tests."""

import numpy as np
import pandas as pd
import pytest


@pytest.fixture
def rng():
    """Deterministic numpy Generator so tests are reproducible."""
    return np.random.default_rng(seed=42)


@pytest.fixture
def config():
    """Minimal config matching backtest/config.yaml schema."""
    return {
        "risk": {
            "max_position_pct": 0.10,
            "max_drawdown_stop": 0.15,
            "kelly_fraction": 0.25,
            "max_notional_usd": 10000,
            "initial_capital": 100000,
        },
        "costs": {
            "polymarket": {"spread_bps": 100, "slippage_pct": 0.001, "gas_per_tx": 0.03},
            "kalshi": {"spread_bps": 150, "slippage_pct": 0.001},
            "vix_options": {"spread_bps": 50, "commission_per_contract": 0.65},
            "equity_etfs": {"spread_bps": 5},
            "short_selling": {"borrow_cost_bps_yr": 80},
        },
        "splits": {
            "train_end": "2024-06-30",
            "validation_end": "2024-09-30",
            "test_start": "2024-10-01",
        },
    }


@pytest.fixture
def daily_returns(rng):
    """252 days of zero-mean normal returns, 1% daily vol."""
    dates = pd.date_range("2024-01-01", periods=252, freq="B")
    values = rng.normal(loc=0.0, scale=0.01, size=252)
    return pd.Series(values, index=dates, name="returns")


@pytest.fixture
def positive_sharpe_returns(rng):
    """252 days of returns with mean > 0 so Sharpe is clearly positive."""
    dates = pd.date_range("2024-01-01", periods=252, freq="B")
    values = rng.normal(loc=0.0008, scale=0.01, size=252)
    return pd.Series(values, index=dates, name="returns")


@pytest.fixture
def multi_strategy_returns(rng):
    """Returns for 4 strategies with known correlation structure."""
    dates = pd.date_range("2024-01-01", periods=252, freq="B")
    base = rng.normal(0.0, 0.01, size=252)
    noise = rng.normal(0.0, 0.005, size=(4, 252))
    mat = np.vstack([
        base + noise[0],
        0.3 * base + noise[1],
        rng.normal(0.0005, 0.01, size=252),
        rng.normal(0.0003, 0.012, size=252),
    ])
    return {f"strat_{i}": pd.Series(mat[i], index=dates) for i in range(4)}
