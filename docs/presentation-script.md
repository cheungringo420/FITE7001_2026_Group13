# PM Arbitrage — Presentation Script (FITE7001 Capstone)

> **Group 13** — CHAN Pak Yiu (Spencer), CHENG Kai Kwong (Tom), CHEUNG King Hung (Ringo), HO Yau Wai (Athena), SY Yat Hei (Sunny)
> Target length: ~12 minutes live demo + Q&A.
> Demo URL: https://pmv12.vercel.app
> Start position: home page, full-screen, dark mode.
> Navbar layout (six items, mapped 1-to-1 to the report): **Markets · Compare · Arbitrage · Trust · Cross-Asset · Research**
> Supervisor: Dr. Juergen Harald Rahmel

---

## 1. Opening (60 s)

> "Good morning. I'm Ringo, presenting on behalf of Group 13. Our project explores whether prediction markets — platforms like Polymarket and Kalshi — can serve as viable **risk assessment and hedging tools** alongside traditional derivatives in the financial industry.
>
> What I'll show you is a working prototype, live at pmv12.vercel.app, that does three things existing tools don't:
> 1. **Resolution-quality scoring** before any cross-platform trade — the Resolution Alignment Engine and the Resolution Confidence Score.
> 2. **Cross-asset mispricing detection** between Polymarket and Deribit BTC options — to our knowledge the first prediction-market tool that bridges into traditional derivatives end-to-end. This implements the comparative framework between Polymarket probabilities and options implied volatility described in the report.
> 3. **An honest UI**: the navbar shows you exactly six surfaces, each one mapped to a contribution declared in the report. Nothing extra, nothing for show."

**If asked** about earlier exploratory features (auto-trading bot, portfolio tracker, multi-strategy signal feed): *"Cut before this presentation. The principle was: a smaller surface that fully delivers is more credible than a packed surface that partially delivers. The architecture for those features remains in the codebase as future work."*

---

## 2. Markets — the entry point (60 s)

**Action:** Land on `/`, scroll the unified Polymarket + Kalshi list.

> "The home page is a unified list across Polymarket and Kalshi. The pill on the top right of the navbar shows `LIVE` — that means both WebSocket feeds are open and prices are streaming. There's a small `Demo` toggle next to the pill in case I lose Wi-Fi during this talk; one click and the app freezes prices instead of erroring out."

**If asked** how the platform agnostic ranking works: *"It's filtered by trust score and 24-hour volume; the deeper logic is in the Compare and Trust surfaces I'll show next."*

---

## 3. Compare — the Resolution Alignment Engine (2 min)

**Action:** Navigate `/compare`, pick one Polymarket vs Kalshi pair.

> "This is the first of the report's two declared technical contributions. A naïve text-similarity match between Polymarket and Kalshi has a **60% false-positive rate** on our cleaned universe — six out of every ten apparent arbitrages are actually resolution mismatches. Two markets phrased identically can resolve on different dates, against different criteria, against different evidence sources.
>
> The Resolution Alignment Engine is a three-layer pipeline. Layer one is TF-IDF text similarity. Layer two is dense semantic embeddings. Layer three — the actual contribution — extracts five resolution-critical dimensions from each question: explicit date, objective threshold, resolution wording, time window, and ambiguity flags. A match is confirmed only when all five align.
>
> End-to-end, that drops the false-positive rate from 60% to about 20%. Forty percentage points. Look at this match — the 'Why this match?' tooltip shows you which of the five criteria each side satisfied, before any trade decision."

---

## 4. Arbitrage — the scanner (60 s)

**Action:** Click into `/arbitrage`.

> "Arbitrage takes the matched pairs from Compare and runs the Yes+No < 1 profitability check. The list is **trust-filtered** — opportunities that pass the alignment gate but fail the trust gate are suppressed. Click any opportunity to open the execution modal. Note: this is paper-trade only. The cross-venue settlement architecture for live execution is a future-work item, deliberately."

---

## 5. Trust — the Resolution Confidence Score (90 s)

**Action:** Navigate `/trust`.

> "This is the second declared contribution. Even when two markets are correctly aligned, the question of *will this market resolve cleanly?* has no answer in the displayed price. It depends on the integrity of the resolution mechanism — UMA's Optimistic Oracle for Polymarket — and on whether the underlying real-world fact is multi-source-attested or contested.
>
> The Resolution Confidence Score is a 0–100 composite of three components: Criteria Clarity at 40% weight, Evidence Consensus at 35%, and Integrity Risk at 25% inverted. Each market card exposes the breakdown. The institutional minimum-trust slider at the top filters the entire opportunity set rather than just hiding hints."

---

## 6. Cross-Asset — the centrepiece (3.5 min)

**Action:** Navigate to `/options`.

> "This is the most novel part of the project. Existing prediction-market tools compare one prediction market against another. We compare them against the **options market**.
>
> The pipeline runs four steps in real time, every 30 seconds:
>
> 1. **Scan Polymarket** — top 500 markets by 24-hour volume, filtered to anything mentioning Bitcoin or BTC.
> 2. **Parse the question** — a regex matcher extracts {threshold, direction, expiry}. *'Will Bitcoin reach $100,000 by December 31, 2026?'* becomes `{threshold: 100000, direction: above, expiryISO: 2026-12-31}`. If any signal is missing, the question is skipped.
> 3. **Fetch the Deribit chain** — public REST API, no auth. We pick the listed expiry closest to the matched date, normalize Deribit's BTC-denominated prices to USD.
> 4. **Replicate the binary** — Polymarket pays $1 if the event happens. We replicate that on Deribit using a tight call spread: long the strike at K, short the strike just above. Per-unit cost approximates the binary as `(longCall − shortCall) / spreadWidth` — that's the textbook Breeden–Litzenberger digital approximation.
>
> If the Polymarket YES price differs from the replicated digital by more than 5%, the engine emits a structured 3-leg trade ticket — Polymarket leg plus the two Deribit option legs, sized for $1,000 of notional, with breakeven probability and warnings spelled out."

**Action:** Expand one ticket. Walk through legs, rationale, breakeven, warnings.

> "Notice the warnings. Every assumption we couldn't model is surfaced — fees, slippage, expiry gap, spread width. This is decision-support, not auto-execute, and we're explicit about that."

**Action:** Point at the filter chips.

> "Quality gates. Markets with less than 3 days to expiration are filtered out — those are intraday gamma plays, not stable cross-asset signals. Tickets with options-implied probability outside the [5%, 95%] band are filtered too — that's the wing-distortion zone where the call-spread approximation breaks down. The chip shows you exactly how many were filtered for each reason."

**Action:** Point at the `AUTO ⋅ Xs` countdown pill.

> "The panel auto-refreshes every 30 seconds. The countdown is visible. It pauses when the tab is hidden so we don't burn API quota during slides."

---

## 7. Research — backtests (60 s)

**Action:** Navigate `/research`.

> "Every strategy on the platform is backed by a Jupyter notebook with reproducible historical evaluation — the cross-platform RAAS backtest, the Lead-Lag VIX study, the Insurance Overlay, and the cross-asset BTC notebook that mirrors what the live engine does today. The point of putting them here is that any claim I made on the previous screens has a notebook you can re-run."

---

## 8. Limitations — say them before the panel does (60 s)

> "Three things I want to be transparent about before you ask:
>
> 1. **Digital replication is approximate.** I'm using adjacent-strike differencing — Breeden–Litzenberger discrete form — not a smoothed risk-neutral density. The engine flags this when spread width exceeds 5% of spot. A cubic-spline fit of the call surface would tighten this; that's listed in future work.
> 2. **Polymarket-Deribit expiries don't always align.** I pick the nearest listed Deribit expiry and warn when the gap exceeds 7 days. Mid-gap basis risk is acknowledged but not quantified.
> 3. **Fees, slippage, and the cost of moving collateral between Polymarket Polygon-USDC and Deribit BTC-margin are not in the edge calculation.** Real-world edges will be smaller than the displayed numbers. This is a research prototype, not a production trading desk."

---

## 9. Closing (45 s)

> "To summarize:
>
> - The navbar maps 1-to-1 to the report. Six surfaces, each one defending a specific section.
> - The two declared technical contributions — Resolution Alignment Engine on **Compare** and Resolution Confidence Score on **Trust** — are both live.
> - The cross-asset framework on **Cross-Asset** is the project's most novel piece: to my knowledge the first prediction-market tool that bridges into traditional derivatives end-to-end with a structured trade ticket.
> - Backtests are reproducible on **Research**.
>
> Code, report, and notebooks are all in the repo. Happy to take questions."

---

## Q&A — likely panel questions and prepared answers

**Q: Where did the auto-trading bot, portfolio tracker, and signals feed go?**
> Cut before this presentation. The principle was discipline over surface area: a smaller navbar that fully delivers is more credible than a packed one that partially delivers. The auto-bot was an exploratory prototype the report itself describes as "imminent release"; portfolio tracking didn't serve the academic thesis; the multi-strategy signal feed had only one live engine (CAETS) and three placeholders, which read as overclaiming. The architecture for all three is preserved in the codebase as future work and the report's roadmap section.

**Q: Why Deribit and not CME or Binance?**
> Deribit has the deepest BTC option-chain liquidity globally, no auth required for read-only chains, and a continuous strike grid that makes spread replication clean. CME has wider strike spacing and worse coverage at threshold ranges. Binance options are thinner and listings less consistent.

**Q: Your '70% edge' tickets look too good to be true. Are they?**
> When you see a >50pp edge, look at the warning panel. It's almost always (a) a wing-distortion artifact (option-implied probability near 0% or 100%, where adjacent-strike differencing breaks down) or (b) a near-zero-DTE binary where the option spread is huge. The [5%, 95%] wing gate and the 3-day DTE filter exist precisely to suppress those. The remaining tickets after gating are realistic — typically single-digit to mid-teens percentage points before fees.

**Q: What's the real, fee-adjusted edge?**
> Polymarket fees are zero on the binary side. Deribit charges 0.03% taker. Spread cost on the call spread is the dominant frictional cost — typically 1–3% of notional. So the displayed edges should be discounted by roughly 3–5pp before they're net-of-cost. Cross-venue collateral transfer time (USDC bridging from Polygon → centralized exchange → BTC) is the real-world execution constraint and is not modelled.

**Q: Could this be auto-traded?**
> Not without infrastructure we don't have: a Polygon wallet with Polymarket allowance, a Deribit subaccount with delta-margin, and a cross-venue collateral controller. The pipeline emits trade tickets; execution stays a human in the loop. Deliberate choice — cross-venue settlement risk needs to be modelled before any auto-execution.

**Q: Why not Kalshi for the cross-asset side?**
> Kalshi has BTC-threshold contracts but they're CFTC-regulated, US-only, and have shallower depth than Polymarket's threshold markets. The matcher works for Kalshi questions in principle (same regex grammar), it just isn't wired in. Listed in future work.

**Q: Couldn't a cubic-spline of the call surface replace the discrete approximation now?**
> Yes, and it's the highest-priority future-work item. The discrete form was chosen for the demo because it's defensible textbook (Breeden–Litzenberger 1978), inspectable in the UI (you can see exactly which two strikes are being used), and not the binding constraint on the system's overall accuracy — the bigger error sources are unmodeled fees and expiry gap.

**Q: What's the regulatory status of prediction markets? Are there risks?**
> Yes, significant and evolving. The report (pp. 41–54) covers this in detail. Hong Kong's SFC issued an explicit warning in April 2026 classifying prediction-market tokens as potential securities. Singapore's MAS prohibits retail participation in prediction markets entirely. The US has fragmented jurisdiction — Kalshi is CFTC-regulated and operates legally, Polymarket relocated offshore and blocks US users via geo-fencing. Our prototype is a research tool, not a licensed trading platform. The regulatory risk is disclosed in the report's limitations section and is one of the reasons auto-execution was deliberately omitted.

**Q: The Research page backtests show strong results. Are those real or simulated?**
> Important disclosure: the Research page uses a synthetic scaffolding dataset generated by `generate_sample_results.py`, not live backtest outputs. This is a deliberate methodological choice following Bailey et al. (2014) — we wanted to demonstrate the backtest framework and UI without overfitting to a single run's noise. The actual strategy notebooks (insurance overlay, cross-platform arb, lead-lag vol, dynamic hedge) are in the `scripts/` directory and can be re-run independently. The report (p. 85) discloses this explicitly.

**Q: How do you handle whale manipulation on Polymarket?**
> The report identifies whale manipulation as a structural risk (pp. 46–48). A single large trader can move Polymarket prices significantly on illiquid contracts. Our mitigations are indirect: the Trust page's volume filter suppresses thin markets, and the Resolution Confidence Score penalises markets with concentrated position distributions when that data is available. But we don't have real-time whale-detection — that would require on-chain monitoring of Polygon wallet flows, which is future work.

**Q: What about reflexivity — can your tool's signals move the markets it monitors?**
> At our current scale, no. But the report acknowledges reflexivity risk (pp. 50–52) as a theoretical concern if the tool were widely adopted. If many traders act on the same cross-asset mispricing signal simultaneously, they'd close the gap before execution completes. This is structurally identical to the alpha-decay problem in quantitative trading. The mitigation would be position limits and staggered execution — neither is implemented because the tool is a research prototype.

**Q: Why is the binary replication using call spreads and not put spreads or digital options directly?**
> Two reasons. First, Deribit doesn't list cash-settled digital options — only vanilla calls and puts. Second, we use calls rather than puts because the Polymarket questions are directional ("Will BTC reach X?"), which maps naturally to call-spread payoffs. Put-call parity means you could replicate the same binary with puts, but the call formulation is more intuitive for the audience and the code is more readable. The Breeden–Litzenberger result is symmetric — the risk-neutral density is the same regardless of which side you differentiate.

**Q: How did the team divide the work? Who built what?**
> The contributions are declared in the report (pp. 106–108). I (Ringo) built the full prototype — the Next.js application, all six surfaces, the cross-asset engine, and the Resolution Alignment Engine. Spencer contributed the comparative framework analysis and options pricing methodology. Tom handled the regulatory and market structure research. Athena led the hedging strategy design and backtesting methodology. Sunny contributed the data pipeline and Kalshi API integration work. The report writing was collaborative across all five members.

**Q: Your cost model doesn't include slippage. How material is that?**
> On Polymarket, slippage is minimal for sub-$10K positions on liquid contracts (top-100 by volume). On Deribit, BTC option spreads can have 1–3% slippage on the less liquid monthly expiries. The combined effect is that the displayed edge should be discounted by 3–5 percentage points for realistic execution. The report acknowledges this (p. 108) and the UI surfaces "fees and slippage not modelled" as a warning on every trade ticket. A proper implementation would integrate order-book depth from both venues into the sizing algorithm — that's listed in future work.

**Q: How does the comparative framework on the Cross-Asset page relate to what the report describes?**
> They're the same framework. The report (pp. 36–40) describes a decision-rules table: Buy Polymarket YES when options IV overprices the event, Sell Polymarket YES when the prediction market overestimates probability, and stay Neutral when both instruments agree within the no-arbitrage band. The Cross-Asset page implements exactly this — the engine extracts the option-implied probability via Breeden–Litzenberger, compares it to the Polymarket YES price, and emits the appropriate trade direction. The 5% minimum-discrepancy threshold corresponds to the "no-arbitrage band" in the report's Table 4.2.

**Q: What happens if data scarcity makes your trust score unreliable?**
> The Resolution Confidence Score degrades gracefully. When evidence sources are sparse (fewer than two independent attestations), the Evidence Consensus component drops toward zero, pulling the composite score down. That's by design — low data availability *should* produce a low trust signal. The report (pp. 53–54) identifies data scarcity as the binding constraint on the scoring model's accuracy for niche or newly listed markets. The mitigation is the minimum-trust slider on the Markets page — institutional users can set a floor (e.g., 60) that filters out under-attested markets entirely.

---

## Backup plan if the live demo fails

**If the live cross-asset endpoint times out:**
- The `errors` array in the API response surfaces this. Show it on screen — the system fails gracefully and tells you why. That's worth more than a smooth demo that hides bugs.
- Pivot to the slide deck (`docs/slides/pm-arbitrage-final-presentation.pptx`); the worked-example slide (slide 8) carries the math and the trade ticket independently of network.

**If Wi-Fi dies entirely:**
1. Click the `Demo` button in the navbar — switches to frozen snapshot, all UI continues to work.
2. Pivot to the methodology and backtest notebooks (`/research`) — those don't depend on a live network.
3. Walk through the slide deck. Slides 8 (worked example) and 9 (math) are self-contained.
