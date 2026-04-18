# Presenter Script — Post-Interim Update

**Target duration:** 5:00 (hard ceiling).
**Word budget:** ~680 words at a comfortable 135 wpm.
**Tone:** confident but honest. You want to sound like a quant, not a student — which means volunteering the weaknesses before the panel asks.

Slide-by-slide timing targets are in **[brackets]**.

---

## Slide 1 — Title [0:00 → 0:25]

> "Good morning. Since the interim presentation I've focused on one thing: making the backtest defensible. The strategies haven't changed — what's changed is the evidence around them. I added seven commits, about four thousand lines of validation code, and sixty-two new tests, all green. The goal of the next five minutes is to walk you through the six layers of defence I built, and the numbers they produce."

*[25 words. Pause, click to slide 2.]*

---

## Slide 2 — The threat model [0:25 → 1:10]

> "At interim, I showed per-strategy Sharpe ratios on a train-test split. That's the minimum. It doesn't survive a good viva, because four questions are still open. First — statistical luck: one sample doesn't tell you the population. Second — cherry-picking: a single parameter point hides the neighbourhood. Third — market realism: a flat slippage assumption isn't how an order book actually fills. Fourth — regime dependence: calm markets flatter everything."
>
> "Everything I built since interim exists to pre-empt exactly those four questions."

*[90 words. Keep the four threats visible while you speak.]*

---

## Slide 3 — Tier 1: Statistical honesty [1:10 → 2:05]

> "Tier One is statistical honesty, surfaced in the new Rigor tab. Four pieces."
>
> "First, Monte Carlo bootstrap — ten thousand block-resamples per strategy, giving a ninety-five percent confidence interval on every Sharpe. So for example, cross-platform arbitrage is Sharpe four-point-four, CI from one-point-four-one to six-point-nine-two. Narrow enough that we're looking at signal, not noise."
>
> "Second, the Deflated Sharpe Ratio from Bailey and López de Prado — a haircut for running multiple strategies on the same data. Third, an order-book slippage model — I walk a level-two book per fill instead of assuming flat ten basis points. And fourth, risk-parity and mean-variance portfolio construction, so we're no longer defaulting to one-over-N."
>
> "Takeaway: every headline number now ships with a confidence interval and a multiple-testing correction."

*[155 words. This is content-dense — slow down on the CI numbers.]*

---

## Slide 4 — Tier 2: Robustness [2:05 → 2:50]

> "Tier Two is robustness, which gets two new research pages. On the left: sensitivity heatmaps — a five-by-five Sharpe surface over two hyperparameters, with a stability score that's one minus the coefficient of variation on the grid. That tells you whether the peak Sharpe is a knife-edge or a plateau."
>
> "On the right: a portfolio comparison page at slash-research-slash-portfolio. Equal-weight versus risk-parity versus mean-variance, head-to-head. The numbers on this slide are the full portfolio: equal-weight gets Sharpe five, risk-parity halves the volatility and pushes it to six-point-two, mean-variance hits eight-point-seven. But — and I flag this in the interpretation panel — mean-variance is estimation-sensitive, so I'm not claiming it as the operational choice."

*[120 words.]*

---

## Slide 5 — The key slide: walk-forward decay [2:50 → 3:45]

> "This is the slide I care most about. Walk-forward analysis with a hundred-and-eighty-day train window, sixty-day test window, thirty-day step, six folds per strategy. I measure Sharpe decay from train to test."
>
> "Five of the six strategies come in under twenty-five percent decay, which is my threshold for what I'm calling robust. Cross-platform arbitrage and market-making are basically flat, around six percent. Dynamic hedge and lead-lag vol are around seventeen and nineteen percent. Insurance overlay is at twenty-three — I flag it as caution."
>
> "And then mean-reversion. Test Sharpe negative. I'm keeping it in the report as an honest negative result — it's evidence the framework discriminates, not just confirms."

*[130 words. This is the highest-stakes slide; speak slowly and let the table land.]*

---

## Slide 6 — Regime-conditional sizing [3:45 → 4:25]

> "Last layer: regime-conditional position sizing. I bucket realized volatility into two regimes and scale exposure — fifty percent in the high-vol regime. The signal is untouched."
>
> "Result: max drawdown improves by seven to nineteen percentage points on every single strategy. Insurance overlay goes from minus forty-two percent MDD to minus twenty-three. Annualised vol drops from roughly twenty percent to thirteen across the board. That's a pure risk-management win — free protection."

*[85 words.]*

---

## Slide 7 — Verdict and next steps [4:25 → 5:00]

> "So the headline change: a sentence that was 'our best Sharpe is one-point-three-two' at interim is now 'Sharpe one-point-three-two, CI one-oh-five to one-point-five-eight, walk-forward decay plus six-point-six percent, stability zero-point-eight-seven, and MDD fourteen points better under regime sizing.' Every one of those numbers is defensible."
>
> "Final four weeks: wire in live Polymarket and Kalshi order books, extend out-of-sample into the 2026 H1 election window, layer execution latency on the slippage model, and write up both the positive and the negative findings."
>
> "Thank you — questions welcome."

*[115 words. Land firmly on 'Thank you' — don't tail off.]*

---

## Notes / backup answers

**If asked "why did mean-reversion fail?"**
"Honest answer: the signal doesn't generalize out-of-fold. Walk-forward decay is negative — test Sharpe is actually worse than train, so it's not overfitting in the classic sense; it's just a weak edge that gets eaten by costs and regime shifts. I'm keeping it in the report as a negative result because removing it would be cherry-picking."

**If asked "why not Turbopack / why webpack?"**
"A transitive dependency in the wallet stack ships a non-ES-module bundle that Turbopack refuses but webpack handles. Operational choice, not a technical statement."

**If asked "DSR is near zero for all strategies — isn't that a problem?"**
"DSR collapses when the trial-variance estimate is tiny, which happens on this sample because I only have four independent strategy trials. PSR is the more stable number here — all five keepers are above ninety-nine percent. With live data the trial variance grows and DSR becomes discriminative."

**If asked about the regime detector parameters**
"Rolling-std over twenty trading days, quantile-bucketed into two regimes. I tested three and four buckets as well — the code supports them — but two is the most defensible given sample size."
