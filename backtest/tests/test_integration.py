"""
End-to-end integration test: the six Tier 1/2 upgrades working together on
one synthetic strategy return stream.
"""

import numpy as np
import pandas as pd
import pytest

from backtest.engine import (
    BacktestEngine,
    OrderbookSlippageModel,
    BookLevel,
    VolatilityRegimeDetector,
    PortfolioAggregator,
)
from backtest.metrics import (
    MonteCarloAnalysis,
    performance_by_regime,
    deflated_sharpe_ratio,
    probabilistic_sharpe_ratio,
)


def test_full_upgrade_pipeline(rng):
    """One strategy goes through MC CIs, DSR, regime analysis, orderbook fill."""
    dates = pd.date_range("2024-01-01", periods=252, freq="B")
    returns = pd.Series(rng.normal(0.0008, 0.01, 252), index=dates)

    # 1. Monte Carlo CIs
    mc = MonteCarloAnalysis(n_simulations=200, seed=42)
    ci = mc.bootstrap_all(returns, method="block", block_size=10)
    assert ci["sharpe"]["ci_lower"] <= ci["sharpe"]["point_estimate"] <= ci["sharpe"]["ci_upper"]

    # 2. Deflated Sharpe with 6 trials (6 strategies)
    trial_sharpes = np.array([0.5, 0.3, 0.8, -0.1, 0.2, 0.6])
    dsr = deflated_sharpe_ratio(
        returns,
        n_trials=len(trial_sharpes),
        trial_sharpe_variance=float(trial_sharpes.var()),
    )
    assert 0.0 <= dsr <= 1.0

    # 3. PSR vs benchmark 0
    psr = probabilistic_sharpe_ratio(returns, sharpe_benchmark=0.0)
    assert 0.0 <= psr <= 1.0

    # 4. Regime detection + conditioned metrics
    det = VolatilityRegimeDetector(lookback=20, n_regimes=2)
    labels = det.fit_transform(returns)
    table = performance_by_regime(returns, labels, regime_names=det.regime_names())
    assert len(table) >= 1

    # 5. Orderbook fill
    book = [BookLevel(0.50, 100), BookLevel(0.51, 200), BookLevel(0.53, 500)]
    fill = OrderbookSlippageModel().fill(size=250, book=book, side="buy")
    assert fill["slippage"] > 0
    assert fill["avg_price"] > 0.50

    # 6. Portfolio construction over four strategies
    four = {
        f"s{i}": pd.Series(rng.normal(0.0005, 0.01, 252), index=dates) for i in range(4)
    }
    agg = PortfolioAggregator({"risk": {"initial_capital": 100000}})
    rp = agg.risk_parity_weights(four)
    mv = agg.mean_variance_weights(four)
    assert rp.sum() == pytest.approx(1.0, abs=1e-4)
    assert mv.sum() == pytest.approx(1.0, abs=1e-4)


def test_engine_results_feed_monte_carlo(config, daily_returns):
    """BacktestEngine returns must be usable as input to MonteCarloAnalysis."""
    from backtest.strategies.base import Strategy

    class ConstantLongStrategy(Strategy):
        name = "const_long"

        def generate_signals(self, data):
            return pd.Series(1.0, index=data.index)

        def generate_positions(self, signals, data):
            return signals * 0.05

    data = pd.DataFrame({"price": 1.0}, index=daily_returns.index)
    engine = BacktestEngine(config)
    result = engine.run_strategy(
        ConstantLongStrategy(config), data, daily_returns, platform="polymarket", split="all"
    )

    mc = MonteCarloAnalysis(n_simulations=100, seed=42)
    ci = mc.bootstrap_sharpe(result["returns"])
    assert ci["ci_lower"] <= ci["ci_upper"]
