# FITE7001 Final Presentation — Q&A Cheat Sheet

**Format**: ~10-minute Q&A. Aim for ~30-second responses; allow follow-ups to deepen.
**Approach**: lead with the headline answer, then one supporting fact, then concede limits honestly. Do not over-claim — the panel will respect calibrated certainty more than confident hand-waving.

---

## Strategy Reminders Before You Walk In

- **Slow down.** A confident panel speaker pauses for 1–2 seconds before answering. It reads as composure, not hesitation.
- **If you don't know, say so once and pivot.** "We have not measured that empirically. The current best estimate is X based on Y. The Phase Two roadmap addresses this through Z." This is the strongest possible recovery.
- **Cite, don't paraphrase.** When invoking the literature, name the paper: "Bailey, López de Prado et al. 2014 on backtest overfitting." When invoking the code, name the file: "`src/lib/trust/scoring.ts`."
- **Use units.** "False-positive rate of approximately twenty percent" is a stronger answer than "much better." "Sharpe target net of one percent transaction costs" beats "good risk-adjusted returns."
- **Defer to the team.** When a question is in your teammates' research wheelhouse, hand off cleanly: "Spencer/Tom/Athena/Sunny led the analysis on that — handing over." Don't muddy.

---

## Section 1 — Technical Contribution (most likely opening questions)

### Q1. "What is the actual academic contribution of your prototype?"

> **30-sec answer.** Three things, none of which exist natively on either platform we benchmark against. First, we formalise *resolution alignment* as a distinct, measurable signal in cross-platform prediction-market analysis, and we quantify its effect on false-positive rate across a three-layer matching pipeline that drops industry-default false positives from approximately sixty percent to approximately twenty percent. Second, we introduce a multi-dimensional Resolution Confidence Score that surfaces oracle and dispute risk *before* capital commitment. Third, we deliver a walk-forward backtesting framework with pre-registered out-of-sample partitioning, which is the empirical apparatus needed to validate any of these signals as tradable. To our knowledge, these have not been formally characterised in the prior literature on prediction-market arbitrage.

**If pressed on novelty.** "Hanson 2007 gives us LMSR market makers; Wolfers and Zitzewitz 2004 establish prediction-market informational content; Peterson and Krug 2015 formalise the oracle dispute mechanism in the Augur whitepaper. The gap is the *pre-trade* signal — none of these works quantify what ambiguous resolution criteria leak into observable market data before resolution."

---

### Q2. "Why those specific weights — 40 / 35 / 25 — for the Confidence Score?"

> **30-sec answer.** The weighting reflects a deliberate ordering of failure modes. Criteria Clarity at forty percent dominates because ambiguous criteria invalidate every downstream calculation — if the question itself does not admit a clean truth value, the displayed price is not a probability, it is a coin flip on the disputants' interpretation. Evidence Consensus at thirty-five percent encodes oracle risk, which is structural and unique to decentralised markets like Polymarket. Integrity Risk at twenty-five percent captures the historical dispute prior, which is material but a less direct present-state signal than the first two components. The weights are implemented verbatim in `src/lib/trust/scoring.ts` and matched to the published report.

**If pressed on whether the weights were tuned empirically.** "The weights were chosen as design priors, not estimated. The Phase Two roadmap fits them empirically against historical UMA dispute rates once we have the labelled dispute log."

---

### Q3. "How did you measure the sixty-percent false-positive rate, and how robust is the twenty-percent residual?"

> **30-sec answer.** The sixty percent baseline is from running TF-IDF cosine similarity at industry-standard thresholds across our cleaned Polymarket–Kalshi universe and manually adjudicating a stratified sample of apparent matches against the actual resolution criteria of each contract. The twenty percent residual is the rate after the full three-layer pipeline — TF-IDF, semantic embeddings, and the Resolution Alignment Engine. We are explicit in the report that this is a project-level estimate, not a published benchmark, because no labelled gold-standard cross-platform pair dataset yet exists in the academic literature. Constructing one is a candidate downstream contribution.

**If pressed on stratification details.** "Stratified by Polymarket category — geopolitical, financial, sports, crypto-prices, election. The geopolitical and conditional-clause categories carried disproportionately high false-positive rates because of resolution-date drift between the two venues."

---

## Section 2 — Backtesting and Empirical Rigor (likely follow-ups from technical Q1–Q3)

### Q4. "Are the Sharpe ratios in your backtest synthetic, or are they out-of-sample empirical?"

> **30-sec answer.** They are synthetic. The JSON files exposed at `/backtest` are produced by `backtest/generate_sample_results.py` with a fixed random seed and hard-coded headline metrics — they validate the website's data plumbing only. We disclose this in Section C of the final report explicitly. The empirical evaluation against live Polymarket Gamma and Kalshi Trade API data is scheduled before the May submission. The deliberate choice not to publish unvetted preliminary numbers is itself a methodological commitment to the standard set out by Bailey, Borwein, López de Prado and Zhu in their 2014 backtest-overfitting paper, which is that headline performance numbers should not be reported until the test-set evaluation has been run end-to-end and pre-registered.

**If pressed on what your real working assumption is.** "The hedging strategies we believe most likely to clear the bar after costs are cross-platform arbitrage and lead-lag-volatility — strategies one and four. The dynamic-hedge and insurance-overlay strategies have higher transaction-cost sensitivity and are likelier to underperform once Polymarket's effective spread is fully imposed."

---

### Q5. "How do you guard against backtest overfitting?"

> **30-sec answer.** Three layers. First, walk-forward partitioning: train ends thirty September twenty twenty-five, validation ends thirty-one January twenty twenty-six, the out-of-sample test set from first February is touched only once, at the final evaluation step, never used to inform model decisions. Second, we compute the Probability of Backtest Overfitting using Combinatorially Symmetric Cross-Validation as proposed by Bailey et al. 2014; strategies whose PBO exceeds fifty percent are deprecated regardless of headline Sharpe. Third, we apply the Harvey and Liu 2014 multiple-testing correction conceptually — we deliberately limit the strategy specification search to the four hedging strategies pre-registered in the interim presentation, plus two comparators including a mean-reversion strategy specifically retained to demonstrate honest exclusion when alpha disappears after costs.

**If pressed on parameter sensitivity.** "Robustness battery: plus and minus twenty-five percent perturbations of every tuned parameter, sub-period stability check, doubled-cost stress test, and a thousand-replication block bootstrap of returns. A strategy's headline Sharpe is dropped from the production candidate set if any of those four checks materially fails."

---

### Q6. "What if your transaction-cost model is too optimistic?"

> **30-sec answer.** That risk is bounded by design. The cost model is calibrated against published exchange documentation and our own quoted-spread observations: one hundred basis points effective spread on Polymarket plus point-one percent slippage scaled by order-to-daily-volume ratio plus three cents Polygon gas; one-fifty basis points on Kalshi; fifty basis points plus zero-point-six-five dollars per contract on VIX options; five basis points on equity ETFs; eighty basis points annualised on short-borrow. We explicitly run a doubled-spread stress test as part of the robustness battery — strategies whose performance collapses under doubled spreads are excluded from the production candidate set. The institutional convention is to report performance net of costs only, and we follow that convention.

**If pressed on Polymarket spread realism.** "Polymarket order book depth is genuinely thin for many mid-tier markets. The hundred-basis-point spread is conservative for top-tier markets and optimistic for the tail. Strategy four — lead-lag — concentrates exposure in top-tier macro markets where this assumption is defensible."

---

## Section 3 — Risk and Feasibility

### Q7. "What is your exposure to oracle and smart-contract risk?"

> **30-sec answer.** Polymarket runs on Polygon and routes resolution through UMA's Optimistic Oracle, escalating to UMA's Data Verification Mechanism in the disputed case. There is no insurance or guarantee layer. This is a material counterparty risk for any institutional participant. We do not eliminate it — that is not a problem the prototype claims to solve — but we surface it through the Integrity Risk dimension of the Confidence Score and through the Phase Two roadmap explicitly flagging it as an unresolved structural exposure. The recent UMIP one-eight-nine governance change introduced a Managed Optimistic Oracle that whitelists experienced proposers, which incrementally reduces frivolous-dispute frequency but does not eliminate the dispute escalation pathway.

**If pressed on Kalshi specifically.** "Kalshi is a CFTC-designated contract market — fully regulated, USD-settled, no smart-contract counterparty risk. Pricing the same event under two regulatory frameworks is precisely the structural inefficiency we exploit."

---

### Q8. "Polymarket has thin liquidity. Is this strategy actually executable in size?"

> **30-sec answer.** At the size we model — institutional but not market-moving — yes for top-tier markets, marginal for mid-tier, no for the long tail. Our risk module enforces a per-trade maximum notional of ten thousand US dollars and a per-position cap at ten percent of capital, both pre-registered in `backtest/config.yaml`. The square-root-of-volume slippage scaling captures the convex transaction-cost penalty as order size grows relative to daily turnover. We are explicit that the prototype operates in paper-trade mode at this stage, and the rationale for that is documented: we want to establish statistical edge before committing live capital, exactly as recommended by López de Prado in his work on financial machine learning.

**If pressed on a number.** "Cross-platform arbitrage strategy with our cost model and risk caps is realistically deployable at one to five million dollars of notional per opportunity. Above that, slippage erodes the spread."

---

### Q9. "Polymarket and Kalshi have different regulatory regimes. Doesn't that create a legal arbitrage that you can't capture?"

> **30-sec answer.** Correct, and that is precisely the structural source of the inefficiency. Polymarket is decentralised, crypto-settled, and currently operates under CFTC no-action relief that excludes US-resident participants from many event categories. Kalshi is a fully regulated CFTC-designated contract market with USD settlement. Pricing the same underlying event under two different legal frameworks creates discrepancies that are not noise — they are exploitable inefficiency. Our prototype's institutional use case explicitly assumes a participant who is legally permitted to access both venues, which today means non-US institutional capital with appropriate legal review. We address jurisdictional compliance specifically in the Legal and Regulatory section of the final report under PDPO, PCICSO and SFC frameworks for Hong Kong deployment.

---

## Section 4 — Comparative and Conceptual

### Q10. "Why prediction markets at all? VIX futures, fed funds futures, FX options already give you implied probabilities."

> **30-sec answer.** Three reasons. First, coverage — prediction markets price events that have no traditional derivative analogue, including specific geopolitical resolutions, election outcomes, and regulatory decisions, where there is genuinely no other listed instrument with comparable specificity. Second, lead-lag — the Phase One correlation analysis demonstrated a three-to-five-day window where prediction-market signals precede traditional volatility instruments, which is the basis of Strategy Four. Third, resolution structure — prediction-market binaries have a fixed-payoff profile that traditional options do not, which makes them particularly suited to event-specific tail-protection overlays where you want a known-cost insurance leg rather than continuous gamma exposure. We are explicit in the report about the binary-to-vanilla translation problem this introduces, and we cite Taleb and Tetlock 2013 on exactly that mismatch.

---

### Q11. "Taleb and Tetlock argue binary forecasts mislead about fat tails. How does that affect your hedging claims?"

> **30-sec answer.** It is a structural caveat we accept and disclose. A binary contract pays out the same dollar regardless of how extreme the realised event is, while a vanilla option's payoff scales with magnitude. This means a prediction-market hedge can perfectly cover the *occurrence* of an event but undercovers the *severity*. Strategy One — event-specific insurance overlay — is the cleanest fit for binary instruments because it is designed to provide known-cost insurance, not magnitude-scaled exposure. Strategy Three — cross-asset delta-neutral overlay — is the most exposed to this critique, and we treat it as a comparative rather than primary strategy. The fundamental answer is: prediction markets complement rather than replace vanilla derivatives in a hedging stack.

---

### Q12. "What's left before this is a production system, and how would an institution deploy it?"

> **30-sec answer.** Five items. First, replace the synthetic backtest scaffolding with the live API-driven walk-forward run — scheduled before May submission. Second, fine-tune the semantic-embedding model on labelled market pairs to reduce the residual false-positive rate below ten percent. Third, productionise the Polymarket CLOB execution path which currently operates only in paper-trade mode. Fourth, complete the Hong Kong regulatory checklist — PDPO, PCICSO, SFC Virtual Asset Service Provider — before any pilot scale-up. Fifth, the Trust Score weights themselves should be re-fit empirically once we have a sufficient UMA dispute history. An institutional deployment would consume our Resolution Alignment and Confidence Score signals as upstream filters for an existing arbitrage-execution stack, not as a standalone trading system.

---

## Bonus — Two Questions Worth Pre-Loading For

### Q13. "Can you walk us through one specific live opportunity right now?"

> **30-sec answer.** *(Have one ready from the live prototype before walking in.)* On the prototype dashboard at pmv12.vercel.app, the highest-confidence opportunity in the current snapshot is *[market name]*, where Polymarket and Kalshi prices imply a *[X]* basis-point spread after fees. The Resolution Alignment Engine confirms a clean three-dimension match — settlement date, threshold, and resolution wording all align. The Resolution Confidence Score is *[Y]*, decomposed as *[A]* clarity, *[B]* consensus, *[C]* integrity. Conditional on the spread persisting, this is a high-conviction candidate; conditional on either Polymarket order-book depth being thin at the touch or evidence consensus deteriorating in the next twenty-four hours, the system would flag it down through the minimum-trust-floor filter.

> **PRE-PRESENTATION TASK.** Open pmv12.vercel.app twenty minutes before walking in. Pick one current high-trust opportunity. Memorise its name, prices, and Confidence Score components. If asked, you have a live, specific, factual example.

---

### Q14. "What would change your conclusions?"

> **30-sec answer.** Three observations would materially change the recommendation. First, if the Probability of Backtest Overfitting on the strategy with the strongest train-set Sharpe exceeded fifty percent, that strategy would be excluded regardless of OOS holdup. Second, if the Polymarket effective spread structurally widens — for instance, due to regulatory fragmentation reducing US flow further — the cross-platform arbitrage strategy degrades materially, and only the lead-lag-volatility strategy would retain the t-statistic threshold for inclusion. Third, if UMA dispute frequency rises after the recent governance change, the Integrity Risk component of the Confidence Score becomes the binding filter, and the actionable opportunity set contracts.

---

## Tone Calibration — What to Sound Like

| Avoid | Prefer |
|---|---|
| "We solved the matching problem." | "We reduced the false-positive rate from approximately sixty percent to approximately twenty percent." |
| "Our backtest shows 1.65 Sharpe." | "The framework is implemented and pre-registered. Live OOS results will replace the scaffolding before submission." |
| "We invented this." | "We formalise this as a measurable signal not previously characterised in the literature." |
| "Polymarket is risky." | "Polymarket's resolution mechanism routes through UMA's Optimistic Oracle, with two-round dispute escalation to the DVM — a material counterparty consideration we surface explicitly." |
| "It just works." | "It is implemented at `src/lib/trust/scoring.ts` and matched to the published report formula." |

---

## Closing Discipline

If asked something genuinely outside scope at the very end, the strongest possible close is: *"That is exactly the kind of question Phase Two is designed to answer empirically, and I would not want to give an unsupported view here. Happy to follow up offline."* Do not improvise on something you cannot defend with code or paper.
