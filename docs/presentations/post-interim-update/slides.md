---
marp: true
theme: default
paginate: true
size: 16:9
style: |
  section { font-family: 'Inter', system-ui, sans-serif; font-size: 22px; }
  h1 { color: #1e293b; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }
  h2 { color: #334155; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  table { font-size: 0.85em; margin: 0 auto; }
  th { background: #e2e8f0; }
  .pos { color: #16a34a; font-weight: 600; }
  .neg { color: #dc2626; font-weight: 600; }
  .muted { color: #64748b; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 0.8em; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-yellow { background: #fef3c7; color: #92400e; }
  .badge-red { background: #fee2e2; color: #991b1b; }
---

# FITE7001 Capstone — Post-Interim Update
## Prediction Markets as Hedging Tools: Making the Backtest Viva-Defensible

**Ringo Cheung** · HKU MSc Financial Technology · Apr 2026

<br>

- Delivered since interim presentation: **7 commits**, **62 new tests** (all green), **~4,000 lines** of validation infrastructure
- Focus: **don't touch the strategies — harden the evidence**
- Target today: walk you through the six layers of defence and the numbers they produce

<span class="muted">5 minutes · timing callouts in speaker notes</span>

---

# The Problem We Had at Interim

At interim we showed per-strategy Sharpe ratios on an 80/20 train/test split.

**That's the minimum, not the story.** Three threats remain:

| Threat | What it means | What a defender would ask |
|--------|---------------|---------------------------|
| **Statistical luck** | Good Sharpe on *one* sample | "Give me a confidence interval." |
| **Cherry-picked parameters** | Single point in a grid | "Show me the neighbourhood." |
| **Market realism** | Flat-bps slippage | "Model a real order book." |
| **Regime dependence** | One window, calm markets | "What about a crisis?" |

Everything below exists to pre-empt those questions.

---

# Tier 1 — Statistical Honesty (now surfaced in the Rigor tab)

Four modules, ~1,500 lines with TDD coverage:

- **Monte Carlo bootstrap** (10k block-resamples) → 95% CI on every Sharpe
  <br>e.g. <code>cross_platform_arb</code> Sharpe 4.44, CI <span class="pos">[1.41, 6.92]</span> — signal, not noise
- **Deflated Sharpe Ratio** (Bailey & López de Prado 2014) — haircut for running 4 strategies
- **Orderbook slippage model** — walks an L2 book per fill, replaces flat 10 bps
- **Risk-parity + mean-variance portfolio construction** — not just 1/N

<br>

> Take-away: every headline number now ships with a confidence interval and a multiple-testing correction.

---

# Tier 2 — Robustness (the new research pages)

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">

<div>

**Sensitivity heatmaps** (5×5 Sharpe surface per strategy)
- 2D grid over two hyperparameters
- **Stability score** = 1 − σ/|μ|  on the grid
- Shows whether the peak is a plateau or a knife-edge

<br>

**Portfolio comparison page** (`/research/portfolio`)
- Head-to-head EW vs RP vs MVO
- Correlation heatmap, avg ρ = **−0.03**
- Cites DeMiguel 2009, Maillard 2010, Markowitz 1952

</div>

<div>

**Construction results (full portfolio):**

| Method | Sharpe | Vol | MDD |
|--------|-------:|----:|----:|
| Equal-weight | 5.09 | 6.2% | −1.0% |
| Risk-parity (ERC) | 6.22 | 3.8% | −0.5% |
| Mean-variance | **8.71** | 5.7% | −0.8% |

<span class="muted">ERC halves the volatility. MVO wins on Sharpe but is estimation-sensitive — we flag this in the interpretation panel.</span>

</div>

</div>

---

# The Key Slide: Walk-Forward Sharpe Decay

**Anchored walk-forward** (train=180d, test=60d, step=30d, n=6 folds)
Decay = (mean_train_sharpe − mean_test_sharpe) / |mean_train_sharpe|

| Strategy | Train Sharpe | Test Sharpe | Decay | Verdict |
|----------|--------:|--------:|--------:|---------|
| cross_platform_arb | 1.21 | 1.14 | <span class="pos">+5.7%</span> | <span class="badge badge-green">Robust</span> |
| market_making | 1.28 | 1.20 | <span class="pos">+6.6%</span> | <span class="badge badge-green">Robust</span> |
| dynamic_hedge | 0.52 | 0.43 | **+16.8%** | <span class="badge badge-green">Robust</span> |
| lead_lag_vol | 0.98 | 0.79 | **+19.0%** | <span class="badge badge-green">Robust</span> |
| insurance_overlay | 0.71 | 0.54 | **+23.5%** | <span class="badge badge-yellow">Caution</span> |
| mean_reversion | −0.33 | −0.35 | −6.5% | <span class="badge badge-red">Rejected (honest)</span> |

> **Five of six strategies are below the 25% "catastrophic decay" threshold.** We are keeping mean_reversion in the report as an explicit negative result.

---

# Regime-Conditional Position Sizing

Scale exposure by realized-vol regime (2-bucket quantile).
No change to the signal — pure risk management.

| Strategy | Static MDD | Regime MDD | ∆ MDD |
|----------|-----------:|-----------:|-----------:|
| cross_platform_arb | −20.0% | −13.1% | <span class="pos">+6.9 pp</span> |
| dynamic_hedge | −27.5% | −17.8% | <span class="pos">+9.7 pp</span> |
| insurance_overlay | −41.9% | −22.5% | <span class="pos">+19.4 pp</span> |
| lead_lag_vol | −33.5% | −23.2% | <span class="pos">+10.3 pp</span> |
| market_making | −31.0% | −17.0% | <span class="pos">+14.0 pp</span> |
| mean_reversion | −22.6% | −14.7% | <span class="pos">+7.9 pp</span> |

Annualised volatility drops **~20% → ~13%** on every strategy. MDD improves by 7–19 percentage points without sacrificing positive-regime exposure.

---

# What This Buys Us for the Viva

**Before:** "Our best strategy has a Sharpe of 1.32."
**Now:** "Our best strategy has a Sharpe of 1.32, 95% CI [1.05, 1.58], DSR-adjusted PSR 0.99, walk-forward decay +6.6%, Sharpe surface stability 0.87, and with regime sizing its MDD improves by 14 percentage points."

<br>

**What's next (final 4 weeks → final presentation)**

- Live data integration (Polymarket + Kalshi order books) replacing synthetic samples
- Out-of-sample extension to the 2026 H1 election-market window (test under real stress)
- Execution latency model on the L2 slippage engine
- Write-up: honest finding on `mean_reversion` + defence of the other five

<br>

**Thank you.** Questions welcome.

<span class="muted">Code: `backtest/` · UI: `/research/backtest`, `/research/portfolio` · Tests: `pytest backtest/tests` (62 passing)</span>
