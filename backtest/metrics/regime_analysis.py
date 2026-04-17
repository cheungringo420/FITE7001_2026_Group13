"""Performance metrics conditioned on regime labels."""

from __future__ import annotations

import numpy as np
import pandas as pd

from .performance import PerformanceMetrics


def performance_by_regime(
    returns: pd.Series,
    regime_labels: pd.Series,
    regime_names: dict | None = None,
) -> pd.DataFrame:
    """
    Group returns by regime label and compute Sharpe, ann return, ann vol, max DD.
    Returns a DataFrame indexed by regime name (or label if no map provided).
    """
    common = returns.index.intersection(regime_labels.index)
    r = returns.loc[common]
    g = regime_labels.loc[common].dropna()
    r = r.loc[g.index]

    rows = []
    for label, sub in r.groupby(g):
        sharpe = PerformanceMetrics.sharpe_ratio(sub)
        ann_return = PerformanceMetrics.annualized_return(sub)
        ann_vol = PerformanceMetrics.annualized_volatility(sub)
        max_dd = PerformanceMetrics.max_drawdown(sub)
        name = (regime_names or {}).get(int(label), f"regime_{int(label)}")
        rows.append({
            "regime": name,
            "label": int(label),
            "n_days": int(len(sub)),
            "sharpe": round(float(sharpe), 4),
            "ann_return": round(float(ann_return), 6),
            "ann_vol": round(float(ann_vol), 6),
            "max_drawdown": round(float(max_dd), 6),
        })

    if not rows:
        return pd.DataFrame(
            columns=["regime", "label", "n_days", "sharpe", "ann_return", "ann_vol", "max_drawdown"]
        )

    df = pd.DataFrame(rows).set_index("regime")
    return df
