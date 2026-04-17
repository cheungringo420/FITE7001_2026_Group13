"""
Regime-conditional position sizing.

Scales daily exposure by a per-regime multiplier so the strategy takes less
risk when realized volatility is high. The `compare()` helper runs the
strategy's returns through both static (always-on) sizing and regime-scaled
sizing, and returns a single payload suitable for UI rendering (metrics +
aligned equity curves).

Rationale: many capstone strategies look fine in-sample but blow up during
a single high-vol window. Regime-conditional sizing is a principled way to
reduce tail exposure without touching the strategy signal itself.
"""

from __future__ import annotations

from typing import Mapping

import numpy as np
import pandas as pd

from backtest.engine.regime import VolatilityRegimeDetector


# Sensible defaults: full exposure in the lowest-vol regime, scaled down as
# realized vol rises. Tuned to be conservative rather than aggressive.
DEFAULT_MULTIPLIERS: dict[int, dict[int, float]] = {
    2: {0: 1.0, 1: 0.5},
    3: {0: 1.0, 1: 0.75, 2: 0.4},
    4: {0: 1.0, 1: 0.8, 2: 0.5, 3: 0.25},
}


class RegimeSizer:
    """Scale strategy returns by per-regime multipliers."""

    def __init__(
        self,
        multipliers: Mapping[int, float] | None = None,
        n_regimes: int = 2,
        lookback: int = 20,
    ):
        self.n_regimes = n_regimes
        self.lookback = lookback
        if multipliers is None:
            multipliers = DEFAULT_MULTIPLIERS.get(
                n_regimes,
                {i: max(0.2, 1.0 - 0.2 * i) for i in range(n_regimes)},
            )
        self.multipliers: dict[int, float] = {int(k): float(v) for k, v in multipliers.items()}

    # ── Core ────────────────────────────────────────────────────────────

    def scale(
        self,
        returns: pd.Series,
        regime_labels: pd.Series | None = None,
    ) -> pd.Series:
        """
        Apply per-regime multipliers to `returns`.

        If `regime_labels` is None, run VolatilityRegimeDetector on `returns`
        itself to derive labels.
        """
        if regime_labels is None:
            detector = VolatilityRegimeDetector(lookback=self.lookback, n_regimes=self.n_regimes)
            regime_labels = detector.fit_transform(returns)

        aligned = regime_labels.reindex(returns.index)
        factors = aligned.map(lambda lab: self._factor_for(lab)).astype(float)
        factors = factors.fillna(1.0)
        return returns * factors

    def _factor_for(self, label) -> float:
        if pd.isna(label):
            return 1.0
        try:
            return self.multipliers.get(int(label), 1.0)
        except (ValueError, TypeError):
            return 1.0

    # ── Metrics & comparison ────────────────────────────────────────────

    @staticmethod
    def _sharpe(r: pd.Series) -> float:
        r = r.dropna()
        if r.empty:
            return 0.0
        sd = float(r.std(ddof=1))
        if sd == 0 or not np.isfinite(sd):
            return 0.0
        return float(r.mean() / sd * np.sqrt(252))

    @staticmethod
    def _ann_return(r: pd.Series) -> float:
        r = r.dropna()
        return float(r.mean() * 252) if not r.empty else 0.0

    @staticmethod
    def _ann_vol(r: pd.Series) -> float:
        r = r.dropna()
        return float(r.std(ddof=1) * np.sqrt(252)) if not r.empty else 0.0

    @staticmethod
    def _max_drawdown(r: pd.Series) -> float:
        r = r.dropna()
        if r.empty:
            return 0.0
        eq = (1.0 + r).cumprod()
        peak = eq.cummax()
        dd = eq / peak - 1.0
        return float(dd.min())

    def _metrics(self, r: pd.Series) -> dict:
        return {
            "sharpe": round(self._sharpe(r), 4),
            "ann_return": round(self._ann_return(r), 6),
            "ann_vol": round(self._ann_vol(r), 6),
            "max_drawdown": round(self._max_drawdown(r), 6),
        }

    @staticmethod
    def _equity_points(r: pd.Series, initial: float = 100000.0) -> list[dict]:
        eq = (1.0 + r.fillna(0.0)).cumprod() * initial
        return [
            {"date": pd.Timestamp(idx).date().isoformat(), "value": round(float(v), 2)}
            for idx, v in eq.items()
        ]

    def compare(self, returns: pd.Series, initial_capital: float = 100000.0) -> dict:
        """
        Run static vs regime-conditional sizing on the same return series.

        Returns
        -------
        {
            "static":  {sharpe, ann_return, ann_vol, max_drawdown},
            "regime":  {sharpe, ann_return, ann_vol, max_drawdown},
            "multipliers": {regime_label: factor},
            "regime_labels": [{date, label}, ...],
            "regime_pct": {regime_label: fraction_of_days},
            "equity": {
                "static": [{date, value}, ...],
                "regime": [{date, value}, ...],
            },
            "improvement": {max_drawdown_delta, sharpe_delta},
        }
        """
        detector = VolatilityRegimeDetector(lookback=self.lookback, n_regimes=self.n_regimes)
        labels = detector.fit_transform(returns)
        scaled = self.scale(returns, regime_labels=labels)

        static_metrics = self._metrics(returns)
        regime_metrics = self._metrics(scaled)

        # Regime label distribution (for UI badge).
        clean_labels = labels.dropna().astype(int)
        total = len(clean_labels)
        regime_pct = (
            {int(k): round(float(v) / total, 4) for k, v in clean_labels.value_counts().items()}
            if total > 0 else {}
        )

        return {
            "static": static_metrics,
            "regime": regime_metrics,
            "multipliers": dict(self.multipliers),
            "regime_labels": [
                {"date": pd.Timestamp(idx).date().isoformat(),
                 "label": int(lab) if not pd.isna(lab) else None}
                for idx, lab in labels.items()
            ],
            "regime_pct": regime_pct,
            "equity": {
                "static": self._equity_points(returns, initial_capital),
                "regime": self._equity_points(scaled, initial_capital),
            },
            "improvement": {
                "sharpe_delta": round(regime_metrics["sharpe"] - static_metrics["sharpe"], 4),
                "max_drawdown_delta": round(
                    regime_metrics["max_drawdown"] - static_metrics["max_drawdown"], 6
                ),
            },
        }
