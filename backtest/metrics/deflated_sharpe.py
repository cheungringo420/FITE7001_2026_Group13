"""
Deflated Sharpe Ratio (Bailey & López de Prado, 2014).

PSR — Probabilistic Sharpe Ratio: P(true Sharpe > benchmark | sample) using
higher moments (skew, kurtosis) of the returns to correct the normal-theory CLT.

DSR — Deflated Sharpe Ratio: PSR with the benchmark set to the expected maximum
Sharpe under the null, given `n_trials` strategies were evaluated. This corrects
for selection bias / multiple-testing inflation.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats


def _sharpe_raw(returns: pd.Series) -> float:
    r = returns.dropna()
    if r.empty or r.std(ddof=1) == 0:
        return 0.0
    return float(r.mean() / r.std(ddof=1))


def probabilistic_sharpe_ratio(returns: pd.Series, sharpe_benchmark: float = 0.0) -> float:
    """
    PSR = Phi( (SR_hat - SR*) · sqrt(n-1) / sqrt(1 - gamma_3·SR_hat + (gamma_4-1)/4·SR_hat^2) )

    sharpe_benchmark is in *per-period* (daily) Sharpe units — pass SR*/sqrt(252)
    if you have an annualized target. Defaults to 0.
    """
    r = returns.dropna()
    n = len(r)
    if n < 3 or r.std(ddof=1) == 0:
        return float("nan")

    sr_hat = _sharpe_raw(r)
    gamma3 = float(stats.skew(r, bias=False))
    gamma4 = float(stats.kurtosis(r, bias=False, fisher=False))  # non-excess

    denom_var = 1.0 - gamma3 * sr_hat + (gamma4 - 1.0) / 4.0 * sr_hat**2
    if denom_var <= 0:
        return float("nan")

    z = (sr_hat - sharpe_benchmark) * np.sqrt(n - 1) / np.sqrt(denom_var)
    return float(stats.norm.cdf(z))


def expected_max_sharpe(n_trials: int, trial_sharpe_variance: float) -> float:
    """
    E[max_i SR_i] under H0 of zero-mean Sharpes (per-period units).
    Uses the extreme-value approximation from López de Prado (2018):

        E[max SR] ≈ sqrt(V[SR]) · ((1 - γ) · Φ⁻¹(1 - 1/N) + γ · Φ⁻¹(1 - 1/(N·e)))

    γ is the Euler-Mascheroni constant.
    """
    if n_trials <= 1:
        return 0.0
    gamma = 0.5772156649
    inv = stats.norm.ppf
    term = (1 - gamma) * inv(1 - 1.0 / n_trials) + gamma * inv(
        1 - 1.0 / (n_trials * np.e)
    )
    return float(np.sqrt(trial_sharpe_variance) * term)


def deflated_sharpe_ratio(
    returns: pd.Series,
    n_trials: int,
    trial_sharpe_variance: float,
) -> float:
    """
    DSR = PSR against the expected MAX Sharpe across n_trials null strategies.

    Parameters
    ----------
    returns : daily (per-period) strategy returns.
    n_trials : number of strategy/parameter combinations that were evaluated.
    trial_sharpe_variance : variance of Sharpe across the trial set (per-period).
        Typical proxy: variance of the set of in-sample Sharpes you computed.

    Returns a probability in [0, 1]; values near 1 indicate genuine skill after
    accounting for selection bias.
    """
    r = returns.dropna()
    if r.empty:
        return float("nan")

    sr_star = expected_max_sharpe(n_trials, trial_sharpe_variance)
    return probabilistic_sharpe_ratio(r, sharpe_benchmark=sr_star)
