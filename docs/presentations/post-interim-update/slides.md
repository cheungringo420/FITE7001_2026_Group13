---
marp: true
paginate: false
size: 16:9
header: "<div class='top-strip'><span>FITE7001</span><span>GROUP 13</span><span>18 APR 2026</span></div>"
style: |
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  :root {
    --ink: #ffffff;
    --muted: #a8b1c4;
    --dim: #6b7485;
    --accent: #facc15;       /* yellow chevron */
    --pos: #4ade80;
    --neg: #f87171;
    --card: rgba(255,255,255,0.04);
    --card-line: rgba(255,255,255,0.18);
  }

  /* ── Base slide ────────────────────────────────────────────── */
  section {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: var(--ink);
    background:
      radial-gradient(ellipse 75% 70% at 18% 40%, #1d3a86 0%, #0c1a3d 35%, #050812 70%, #020308 100%);
    padding: 80px 90px 70px 90px;
    font-size: 22px;
    line-height: 1.45;
    font-weight: 400;
    letter-spacing: -0.005em;
  }

  /* ── Top strip (FITE7001 · GROUP 13 · date) ──────────────── */
  section > header {
    position: absolute;
    top: 28px;
    left: 90px;
    right: 90px;
    padding: 0;
    background: transparent;
  }
  .top-strip {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.22em;
    color: rgba(255,255,255,0.88);
  }
  .top-strip span:nth-child(1) { text-align: left; }
  .top-strip span:nth-child(2) { text-align: center; }
  .top-strip span:nth-child(3) { text-align: right; }

  /* ── Headings ─────────────────────────────────────────────── */
  h1 {
    font-weight: 800;
    font-size: 52px;
    line-height: 1.08;
    margin: 0 0 28px 0;
    letter-spacing: -0.02em;
    color: var(--ink);
  }
  h2 {
    font-weight: 700;
    font-size: 30px;
    margin: 0 0 20px 0;
    letter-spacing: -0.01em;
  }
  h3 {
    font-weight: 600;
    font-size: 20px;
    margin: 0 0 12px 0;
    color: var(--ink);
  }
  p, li { color: var(--ink); }
  strong { font-weight: 700; }
  em { font-style: normal; color: var(--muted); }
  .muted { color: var(--muted); }
  .dim { color: var(--dim); font-size: 0.85em; }

  /* ── Title slide ──────────────────────────────────────────── */
  section.title {
    background:
      radial-gradient(ellipse 80% 75% at 22% 50%, #1e3f8f 0%, #0c1a3d 35%, #050812 70%, #020308 100%);
    padding: 100px 100px 80px 100px;
  }
  section.title h1 {
    font-size: 72px;
    font-weight: 800;
    line-height: 1.05;
    max-width: 18ch;
    margin-top: 80px;
  }
  section.title .subtitle {
    font-size: 32px;
    font-weight: 600;
    margin-top: 18px;
  }
  section.title .authors {
    margin-top: 90px;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  /* ── Section divider ─────────────────────────────────────── */
  section.divider {
    background:
      radial-gradient(ellipse 80% 75% at 30% 60%, #2c2a9a 0%, #16186b 35%, #070a22 75%, #020308 100%);
    display: flex;
    align-items: flex-end;
    padding: 100px 90px 110px 90px;
  }
  section.divider h1 {
    font-size: 120px;
    font-weight: 800;
    margin: 0;
    line-height: 1;
    letter-spacing: -0.03em;
  }
  section.divider.alt {
    background:
      radial-gradient(ellipse 80% 75% at 75% 55%, #3b2a95 0%, #1a1766 35%, #070a22 75%, #020308 100%);
  }

  /* ── Chevron callout (yellow tab) ────────────────────────── */
  .chevron {
    display: inline-block;
    background: var(--accent);
    color: #0a0a0a;
    padding: 10px 42px 10px 20px;
    font-weight: 800;
    font-size: 22px;
    letter-spacing: 0.01em;
    clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 0 100%);
    margin-bottom: -18px;
    margin-left: 24px;
    position: relative;
    z-index: 2;
  }
  .card {
    border: 1.2px solid var(--card-line);
    border-radius: 28px;
    padding: 34px 40px 28px 40px;
    background: transparent;
  }
  .card + .card { margin-top: 26px; }

  /* ── Tables (data) ───────────────────────────────────────── */
  /* Override Marp default zebra striping which paints light bg on
     odd rows and hides white text on dark theme. */
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin: 14px 0;
    font-size: 18px;
    background: transparent;
  }
  thead, tbody, tr,
  tbody tr, tbody tr:nth-child(odd), tbody tr:nth-child(even),
  thead tr, thead tr:nth-child(odd), thead tr:nth-child(even) {
    background: transparent !important;
  }
  tbody tr:nth-child(even) {
    background: rgba(255,255,255,0.03) !important;   /* subtle dark-mode stripe */
  }
  th, td {
    padding: 9px 14px;
    text-align: left;
    border-bottom: 1px solid rgba(255,255,255,0.12);
    background: transparent !important;
    color: var(--ink) !important;
  }
  th {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--muted) !important;
    text-transform: uppercase;
    border-bottom: 1.5px solid rgba(255,255,255,0.28);
  }
  tbody tr:last-child td { border-bottom: none; }

  /* ── Utility badges ──────────────────────────────────────── */
  .badge {
    display: inline-block;
    padding: 3px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .badge-green  { background: rgba(74,222,128,0.18); color: #86efac; border: 1px solid rgba(74,222,128,0.4); }
  .badge-yellow { background: rgba(250,204,21,0.18); color: #fde047; border: 1px solid rgba(250,204,21,0.45); }
  .badge-red    { background: rgba(248,113,113,0.18); color: #fca5a5; border: 1px solid rgba(248,113,113,0.45); }
  .pos { color: var(--pos); font-weight: 700; }
  .neg { color: var(--neg); font-weight: 700; }

  /* ── Layout helpers ──────────────────────────────────────── */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; align-items: start; }
  .kpi {
    border-left: 3px solid var(--accent);
    padding-left: 18px;
    margin: 20px 0;
  }
  .kpi .n { font-size: 42px; font-weight: 800; letter-spacing: -0.02em; line-height: 1; }
  .kpi .l { font-size: 14px; color: var(--muted); margin-top: 6px; letter-spacing: 0.04em; text-transform: uppercase; }
  ul { margin: 10px 0 0 0; padding-left: 22px; }
  li { margin-bottom: 8px; }
  li::marker { color: var(--accent); }
  blockquote {
    border-left: 3px solid var(--accent);
    background: rgba(250,204,21,0.06);
    padding: 14px 20px;
    margin: 20px 0;
    font-size: 20px;
    line-height: 1.5;
  }
  blockquote p { margin: 0; }

  code {
    font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
    background: rgba(255,255,255,0.08);
    padding: 1px 7px;
    border-radius: 4px;
    font-size: 0.9em;
    color: #fde047;
  }

  hr {
    border: none;
    border-top: 2px solid rgba(255,255,255,0.28);
    margin: 6px 0 22px 0;
    max-width: 90%;
  }
---

<!-- _class: title -->

# Post-Interim Update: Making the Backtest Viva-Defensible

<div class="subtitle">Exploring the Use of Prediction Markets as Risk Assessment and Hedging Tools in the Financial Industry</div>

<div class="authors">Spencer CHAN  |  Tom CHENG  |  Ringo CHEUNG  |  Athena HO  |  Sunny SY</div>

---

<!-- _class: divider -->

# The Problem

---

# What Was Missing at Interim

<hr>

At interim we showed per-strategy Sharpe ratios on an 80/20 train-test split. That's the minimum — it doesn't survive a good viva.

<div class="grid-2" style="margin-top: 28px;">

<div>
<div class="chevron">Four Open Threats</div>
<div class="card" style="font-size: 19px; line-height: 1.4;">

- <strong>Statistical luck</strong> — one sample ≠ population
- <strong>Cherry-picked parameters</strong> — one grid cell hides the neighbourhood
- <strong>Market realism</strong> — flat-bps slippage ≠ real book fills
- <strong>Regime dependence</strong> — calm markets flatter everything

</div>
</div>

<div>
<div class="chevron">Our Response</div>
<div class="card">

Since interim: <strong>9 commits</strong>, <strong>62 new tests</strong> (all green), <strong>~4,000 LOC</strong> of validation infrastructure.

No changes to the strategy signals — we harden the <em>evidence</em> around them.

Everything is surfaced live at<br>
<code>/research/backtest</code> and <code>/research/portfolio</code>.

</div>
</div>

</div>

---

<!-- _class: divider alt -->

# Six Layers of Defence

---

# Tier 1 — Statistical Honesty

<hr>

<div class="grid-2">

<div>

<div class="kpi">
  <div class="n">10,000</div>
  <div class="l">Monte Carlo bootstrap resamples per strategy</div>
</div>

<div class="kpi">
  <div class="n">95% CI</div>
  <div class="l">on every Sharpe, every drawdown</div>
</div>

<div class="kpi">
  <div class="n">DSR</div>
  <div class="l">Bailey &amp; López de Prado haircut for multiple-testing</div>
</div>

</div>

<div>

<h3>Orderbook slippage engine</h3>
<p class="muted">Walks a level-2 book per fill, replacing the old flat 10 bps.</p>

<h3>Portfolio construction</h3>
<p class="muted">Risk-parity (Maillard 2010) and mean-variance (Markowitz 1952) alongside equal-weight.</p>

<h3>Volatility regime detector</h3>
<p class="muted">Rolling-std quantile bucketing into 2 / 3 / 4 regimes.</p>

<blockquote>
Example — <code>cross_platform_arb</code> Sharpe <strong>4.44</strong>, CI <span class="pos">[1.41, 6.92]</span>, PSR <strong>0.99</strong>. Signal, not noise.
</blockquote>

</div>

</div>

---

# Tier 2 — Robustness (new research pages)

<hr>

<div class="grid-2">

<div>

<h3>Sensitivity heatmaps</h3>
<p class="muted">5×5 Sharpe surface over two hyperparameters per strategy.</p>
<p><strong>Stability score</strong> = 1 − σ / |μ| on the grid. Tells you whether the peak is a plateau or a knife-edge.</p>

<h3>Portfolio comparison page</h3>
<p class="muted"><code>/research/portfolio</code> — head-to-head EW vs RP vs MVO, correlation heatmap, interpretation panel.</p>
<p>Average pairwise correlation: <strong>−0.03</strong> — genuine diversification.</p>

</div>

<div>

<h3 class="muted" style="letter-spacing: 0.08em; text-transform: uppercase; font-size: 13px;">Full-portfolio construction</h3>

<table>
<thead><tr><th>Method</th><th style="text-align:right">Sharpe</th><th style="text-align:right">Vol</th><th style="text-align:right">MDD</th></tr></thead>
<tbody>
<tr><td>Equal-weight (1/N)</td><td style="text-align:right">5.09</td><td style="text-align:right">6.2%</td><td style="text-align:right">−1.0%</td></tr>
<tr><td><strong>Risk-parity (ERC)</strong></td><td style="text-align:right"><strong>6.22</strong></td><td style="text-align:right"><strong>3.8%</strong></td><td style="text-align:right"><strong>−0.5%</strong></td></tr>
<tr><td>Mean-variance</td><td style="text-align:right">8.71</td><td style="text-align:right">5.7%</td><td style="text-align:right">−0.8%</td></tr>
</tbody>
</table>

<p class="muted" style="font-size: 16px; margin-top: 18px;">ERC halves volatility. MVO wins on Sharpe but is estimation-sensitive — we flag this in the interpretation panel and recommend ERC as the operational choice.</p>

</div>

</div>

---

# Walk-Forward Sharpe Decay <span class="badge badge-yellow" style="font-size: 14px; vertical-align: middle;">KEY SLIDE</span>

<hr>

<p class="muted">Anchored walk-forward · train=180d · test=60d · step=30d · 6 folds · decay = (mean_train − mean_test) / |mean_train|</p>

<table>
<thead>
<tr><th>Strategy</th><th style="text-align:right">Train Sharpe</th><th style="text-align:right">Test Sharpe</th><th style="text-align:right">Decay</th><th style="text-align:center">Verdict</th></tr>
</thead>
<tbody>
<tr><td>cross_platform_arb</td><td style="text-align:right">1.21</td><td style="text-align:right">1.14</td><td style="text-align:right"><span class="pos">+5.7%</span></td><td style="text-align:center"><span class="badge badge-green">Robust</span></td></tr>
<tr><td>market_making</td><td style="text-align:right">1.28</td><td style="text-align:right">1.20</td><td style="text-align:right"><span class="pos">+6.6%</span></td><td style="text-align:center"><span class="badge badge-green">Robust</span></td></tr>
<tr><td>dynamic_hedge</td><td style="text-align:right">0.52</td><td style="text-align:right">0.43</td><td style="text-align:right">+16.8%</td><td style="text-align:center"><span class="badge badge-green">Robust</span></td></tr>
<tr><td>lead_lag_vol</td><td style="text-align:right">0.98</td><td style="text-align:right">0.79</td><td style="text-align:right">+19.0%</td><td style="text-align:center"><span class="badge badge-green">Robust</span></td></tr>
<tr><td>insurance_overlay</td><td style="text-align:right">0.71</td><td style="text-align:right">0.54</td><td style="text-align:right">+23.5%</td><td style="text-align:center"><span class="badge badge-yellow">Caution</span></td></tr>
<tr><td>mean_reversion</td><td style="text-align:right">−0.33</td><td style="text-align:right">−0.35</td><td style="text-align:right"><span class="neg">−6.5%</span></td><td style="text-align:center"><span class="badge badge-red">Honest negative</span></td></tr>
</tbody>
</table>

<blockquote>
<strong>Five of six strategies are below the 25% "catastrophic decay" threshold.</strong> We are <u>keeping</u> <code>mean_reversion</code> in the report as an explicit negative result — evidence the framework discriminates, not just confirms.
</blockquote>

---

# Regime-Conditional Position Sizing

<hr>

<div class="grid-2">

<div>

<p class="muted">Scale exposure by realized-vol regime (2-bucket quantile). <strong>The signal is untouched</strong> — pure risk management.</p>

<div class="kpi">
  <div class="n">~20% → ~13%</div>
  <div class="l">Annualised volatility, across the board</div>
</div>

<div class="kpi">
  <div class="n">+7 to +19 pp</div>
  <div class="l">Max-drawdown improvement, every strategy</div>
</div>

<p class="muted" style="margin-top: 24px;">Default multipliers: <code>{0: 1.0, 1: 0.5}</code> — full exposure in low-vol, half in high-vol.</p>

</div>

<div>

<table>
<thead><tr><th>Strategy</th><th style="text-align:right">Static MDD</th><th style="text-align:right">Regime MDD</th><th style="text-align:right">∆</th></tr></thead>
<tbody>
<tr><td>cross_platform_arb</td><td style="text-align:right">−20.0%</td><td style="text-align:right">−13.1%</td><td style="text-align:right"><span class="pos">+6.9 pp</span></td></tr>
<tr><td>dynamic_hedge</td><td style="text-align:right">−27.5%</td><td style="text-align:right">−17.8%</td><td style="text-align:right"><span class="pos">+9.7 pp</span></td></tr>
<tr><td>insurance_overlay</td><td style="text-align:right">−41.9%</td><td style="text-align:right">−22.5%</td><td style="text-align:right"><span class="pos">+19.4 pp</span></td></tr>
<tr><td>lead_lag_vol</td><td style="text-align:right">−33.5%</td><td style="text-align:right">−23.2%</td><td style="text-align:right"><span class="pos">+10.3 pp</span></td></tr>
<tr><td>market_making</td><td style="text-align:right">−31.0%</td><td style="text-align:right">−17.0%</td><td style="text-align:right"><span class="pos">+14.0 pp</span></td></tr>
<tr><td>mean_reversion</td><td style="text-align:right">−22.6%</td><td style="text-align:right">−14.7%</td><td style="text-align:right"><span class="pos">+7.9 pp</span></td></tr>
</tbody>
</table>

</div>

</div>

---

<!-- _class: divider -->

# Verdict

---

# What This Buys Us — and What's Next

<hr>

<div class="grid-2">

<div>

<div class="chevron">Then → Now</div>
<div class="card">

<p class="muted" style="font-size: 18px;">At interim:</p>
<p style="font-size: 20px;">"Our best strategy has a Sharpe of <strong>1.32</strong>."</p>

<p class="muted" style="font-size: 18px; margin-top: 18px;">Today:</p>
<p style="font-size: 19px; line-height: 1.5;">"Sharpe <strong>1.32</strong>, 95% CI <strong class="pos">[1.05, 1.58]</strong>, PSR <strong>0.99</strong>, walk-forward decay <strong class="pos">+6.6%</strong>, surface stability <strong>0.87</strong>, regime-sized MDD <strong class="pos">+14 pp</strong> better."</p>

</div>

</div>

<div>

<div class="chevron">Final 4 Weeks</div>
<div class="card">

<ul>
<li>Live data integration — Polymarket + Kalshi L2 order books, replacing synthetic samples</li>
<li>Out-of-sample extension into the <strong>2026 H1 election-market</strong> window (real stress)</li>
<li>Execution latency layer on the L2 slippage engine</li>
<li>Final write-up: honest finding on <code>mean_reversion</code> + defence of the other five</li>
</ul>

</div>

</div>

</div>

<p class="dim" style="margin-top: 38px; text-align: center;">Code: <code>backtest/</code>  ·  UI: <code>/research/backtest</code>, <code>/research/portfolio</code>  ·  Tests: <code>pytest backtest/tests</code> <strong>(62 passing)</strong></p>

---

<!-- _class: title -->

# Thank You

<div class="subtitle muted" style="color: var(--muted);">Questions welcome.</div>

<div class="authors">Spencer CHAN  |  Tom CHENG  |  Ringo CHEUNG  |  Athena HO  |  Sunny SY</div>
