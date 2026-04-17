"""Tests for WalkForwardAnalyzer: anchored/rolling folds + re-optimization."""

import numpy as np
import pandas as pd
import pytest

from backtest.metrics.walk_forward import WalkForwardAnalyzer


def _returns(rng, n=400, mu=0.0008, sigma=0.01):
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    return pd.Series(rng.normal(mu, sigma, n), index=dates)


def test_fold_count_matches_formula(rng):
    r = _returns(rng, n=400)
    wf = WalkForwardAnalyzer()
    out = wf.analyze(r, train_window=180, test_window=60, step=60, anchored=False)
    # Rolling: n_folds = floor((N - T - H) / S) + 1 = floor((400-180-60)/60)+1 = floor(2.67)+1 = 3
    assert len(out["folds"]) == 3


def test_each_fold_has_core_fields(rng):
    r = _returns(rng, n=400)
    wf = WalkForwardAnalyzer()
    out = wf.analyze(r, train_window=180, test_window=60, step=60, anchored=False)

    required = {"fold", "train_start", "train_end", "test_start", "test_end",
                "train_sharpe", "test_sharpe", "n_train", "n_test"}
    for f in out["folds"]:
        assert required.issubset(f.keys())
        assert f["n_train"] == 180
        assert f["n_test"] == 60
        assert np.isfinite(f["train_sharpe"])
        assert np.isfinite(f["test_sharpe"])


def test_anchored_expanding_train_window(rng):
    """Anchored: train_start stays fixed at the origin; train window grows."""
    r = _returns(rng, n=400)
    wf = WalkForwardAnalyzer()
    out = wf.analyze(r, train_window=180, test_window=60, step=60, anchored=True)

    first_train_start = out["folds"][0]["train_start"]
    for f in out["folds"]:
        assert f["train_start"] == first_train_start

    # Each subsequent fold should have a longer train window (or equal in degenerate).
    sizes = [f["n_train"] for f in out["folds"]]
    assert all(sizes[i + 1] >= sizes[i] for i in range(len(sizes) - 1))
    assert sizes[-1] > sizes[0]


def test_rolling_fixed_train_window(rng):
    """Rolling (non-anchored): train window size is constant, starts slide."""
    r = _returns(rng, n=400)
    wf = WalkForwardAnalyzer()
    out = wf.analyze(r, train_window=180, test_window=60, step=60, anchored=False)

    sizes = [f["n_train"] for f in out["folds"]]
    assert all(s == 180 for s in sizes)

    starts = [f["train_start"] for f in out["folds"]]
    assert all(starts[i + 1] > starts[i] for i in range(len(starts) - 1))


def test_summary_reports_aggregate_sharpe(rng):
    r = _returns(rng, n=400)
    wf = WalkForwardAnalyzer()
    out = wf.analyze(r, train_window=180, test_window=60, step=60)

    s = out["summary"]
    assert "mean_train_sharpe" in s
    assert "mean_test_sharpe" in s
    assert "sharpe_decay" in s  # (train - test) / |train|
    assert "n_folds" in s
    assert s["n_folds"] == len(out["folds"])

    # Decay should match manual computation.
    train_mean = np.mean([f["train_sharpe"] for f in out["folds"]])
    test_mean = np.mean([f["test_sharpe"] for f in out["folds"]])
    if abs(train_mean) > 1e-9:
        expected_decay = (train_mean - test_mean) / abs(train_mean)
        # Summary stats are rounded to 4dp for JSON output; allow that tolerance.
        assert abs(s["sharpe_decay"] - expected_decay) < 1e-3


def test_insufficient_data_returns_empty(rng):
    r = _returns(rng, n=50)
    wf = WalkForwardAnalyzer()
    out = wf.analyze(r, train_window=180, test_window=60, step=60)
    assert out["folds"] == []
    assert out["summary"]["n_folds"] == 0


def test_anchored_reoptimization_picks_best_train_param(rng):
    """
    Strategy callable + parameter grid: WalkForward should refit at each fold,
    pick the param with best train Sharpe, report test Sharpe for that choice.
    """
    r = _returns(rng, n=400, mu=0.001)

    # Toy strategy: scale returns by alpha. Best alpha is the largest positive
    # (since it scales mean linearly more than std in this toy case — actually
    # Sharpe is invariant to positive scaling, so we pick a strategy that does
    # vary with the param: add a bias proportional to alpha).
    def strategy_fn(returns, alpha):
        return returns + alpha * 0.0005

    wf = WalkForwardAnalyzer()
    out = wf.anchored_reoptimization(
        r, strategy_fn,
        param_grid={"alpha": [-2.0, 0.0, 2.0]},
        train_window=180, test_window=60, step=60,
    )

    # Every fold should have picked alpha=2.0 in training (highest positive bias
    # → highest train Sharpe).
    for f in out["folds"]:
        assert f["best_params"] == {"alpha": 2.0}


def test_reoptimization_records_all_param_sharpes(rng):
    r = _returns(rng, n=400)

    def strategy_fn(returns, alpha):
        return returns * alpha

    wf = WalkForwardAnalyzer()
    out = wf.anchored_reoptimization(
        r, strategy_fn,
        param_grid={"alpha": [0.5, 1.0]},
        train_window=180, test_window=60, step=60,
    )
    # Each fold should record the grid-search result.
    for f in out["folds"]:
        assert "param_search" in f
        assert len(f["param_search"]) == 2
