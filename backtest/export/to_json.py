"""
Export backtest results to JSON format for the Next.js website.
Results are written to /public/backtest-results/*.json.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
import numpy as np

from ..metrics.performance import PerformanceMetrics
from ..metrics.risk_metrics import RiskMetrics
from ..metrics.validation import ValidationSuite


class ResultExporter:
    """Export backtest results as static JSON for the website."""

    def __init__(self, output_dir: Optional[str] = None):
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            self.output_dir = Path(__file__).parent.parent.parent / "public" / "backtest-results"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def export_strategy(
        self,
        strategy_name: str,
        train_result: dict,
        test_result: dict,
        validation_data: Optional[dict] = None,
        factor_regression: Optional[dict] = None,
        event_study: Optional[dict] = None,
        robustness: Optional[dict] = None,
    ) -> str:
        """Export a single strategy's results to JSON."""
        train_returns = train_result["returns"]
        test_returns = test_result["returns"]

        train_metrics = PerformanceMetrics.compute_all(train_returns, train_result.get("trade_log", []))
        test_metrics = PerformanceMetrics.compute_all(test_returns, test_result.get("trade_log", []))

        train_tstat = ValidationSuite.t_test_returns(train_returns)
        test_tstat = ValidationSuite.t_test_returns(test_returns)
        train_metrics["t_stat"] = train_tstat["t_stat"]
        test_metrics["t_stat"] = test_tstat["t_stat"]

        # Equity curve
        equity = test_result["equity_curve"]
        equity_data = [
            {"date": str(dt.date()), "value": round(v, 2)}
            for dt, v in equity.items()
        ]

        # Trade log
        trade_log = test_result.get("trade_log", [])

        # Monotonicity
        mono = ValidationSuite.signal_monotonicity(
            train_result["signals"], train_returns
        )

        output = {
            "strategy": strategy_name,
            "version": "1.0.0",
            "generated_at": datetime.utcnow().isoformat(),
            "splits": {
                "train_end": "2025-09-30",
                "test_start": "2026-02-01",
            },
            "train_metrics": train_metrics,
            "test_metrics": test_metrics,
            "equity_curve": equity_data,
            "trade_log": trade_log[:100],  # Cap at 100 for JSON size
            "monotonicity": mono["buckets"],
            "factor_regression": factor_regression or {},
            "robustness": robustness or {},
            "event_study": (event_study or {}).get("event_study", []),
            "risk_metrics": {
                "train": RiskMetrics.compute_all(train_returns),
                "test": RiskMetrics.compute_all(test_returns),
            },
            "overfit_check": {
                "train_sharpe": train_metrics["sharpe"],
                "test_sharpe": test_metrics["sharpe"],
                "ratio": round(test_metrics["sharpe"] / train_metrics["sharpe"], 4) if train_metrics["sharpe"] != 0 else None,
                "flagged": test_metrics["sharpe"] < 0.5 * train_metrics["sharpe"] if train_metrics["sharpe"] > 0 else False,
            },
        }

        filepath = self.output_dir / f"{strategy_name}.json"
        with open(filepath, "w") as f:
            json.dump(output, f, indent=2, default=str)

        return str(filepath)

    def export_portfolio_summary(
        self,
        strategy_results: dict,
        portfolio_returns: pd.Series,
        correlation_matrix: pd.DataFrame,
    ) -> str:
        """Export portfolio-level summary."""
        portfolio_metrics = PerformanceMetrics.compute_all(portfolio_returns)
        portfolio_risk = RiskMetrics.compute_all(portfolio_returns)

        strategy_summaries = {}
        for name, result in strategy_results.items():
            returns = result.get("returns", pd.Series(dtype=float))
            strategy_summaries[name] = {
                "sharpe": round(PerformanceMetrics.sharpe_ratio(returns), 4),
                "ann_return": round(PerformanceMetrics.annualized_return(returns), 6),
                "max_drawdown": round(PerformanceMetrics.max_drawdown(returns), 6),
            }

        output = {
            "type": "portfolio_summary",
            "version": "1.0.0",
            "generated_at": datetime.utcnow().isoformat(),
            "portfolio_metrics": portfolio_metrics,
            "portfolio_risk": portfolio_risk,
            "strategy_summaries": strategy_summaries,
            "correlation_matrix": correlation_matrix.round(4).to_dict(),
        }

        filepath = self.output_dir / "portfolio_summary.json"
        with open(filepath, "w") as f:
            json.dump(output, f, indent=2, default=str)

        return str(filepath)
