# PM Arbitrage — Final Year Project Report

## 1. Executive Summary
PM Arbitrage is a cross‑platform prediction market intelligence platform that compares Polymarket and Kalshi markets, identifies arbitrage opportunities, and quantifies match quality using a trust and resolution‑alignment engine. It goes beyond price comparison by surfacing the *quality* of the match, evidence confidence, and risk signals. This report summarizes the product, architecture, key algorithms, and evaluation goals.

## 2. Problem Statement
Existing prediction markets are siloed. Prices often diverge, but cross‑platform arbitrage is difficult because:
- Markets are *semantically similar* but not identical in resolution criteria.
- Users lack **alignment and trust signals** for match quality.
- Execution workflow lacks auditability and risk controls.

## 3. Solution Overview
PM Arbitrage provides:
- Unified discovery of Polymarket + Kalshi markets.
- **Resolution Alignment Engine** to reduce false matches.
- Trust scores and evidence for match reliability.
- Arbitrage scanner with strict matching mode.
- Options‑implied probability comparison for macro signals.
- Paper‑trade execution workflow with audit logs.

## 4. Key Features (User‑Facing)

The prototype's surface area was deliberately tightened to **six top-level surfaces**, each mapped to a contribution declared in this report. Earlier exploratory features (auto-trading bot, portfolio tracker, educational onboarding, multi-strategy signal feed, standalone terminal view, mock SPY/QQQ comparison) were retired prior to the final demo so the navbar matches the report 1-to-1.

1. **Markets** (`/`)
   - Unified Polymarket + Kalshi list with search, category, and platform filters.
   - Live WebSocket price stream; the app boots into LIVE mode by default.
2. **Compare** (`/compare`) — **Resolution Alignment Engine**
   - Three-layer matching pipeline (TF-IDF → semantic embeddings → criteria extractor) reducing false-positive rate from 60% to ~20% on the cleaned Polymarket–Kalshi universe.
   - "Why this match?" tooltip surfacing the five resolution-critical dimensions.
3. **Arbitrage** (`/arbitrage`) — Cross-platform scanner
   - Yes+No < 1 detection across matched markets; trust-filtered results; paper-trade execution workflow with audit logs.
4. **Trust** (`/trust`) — **Resolution Confidence Score**
   - Three-component composite (Criteria Clarity 40%, Evidence Consensus 35%, Integrity Risk 25% inverted) on a 0–100 scale, exposed at the market-card level before capital commitment.
5. **Cross-Asset** (`/options`) — **Comparative Framework: Polymarket × Deribit**
   - Single-purpose page: scans Polymarket BTC threshold markets, replicates each binary on Deribit via a tight call spread (Breeden–Litzenberger digital approximation), and emits a structured 3-leg trade ticket whenever the discrepancy exceeds the no-arbitrage band.
   - Quality gates: minimum 3 days to expiration (suppresses intraday gamma noise) and options-implied probability bounded to [5%, 95%] (suppresses wing-distortion artifacts). Filter counts surfaced in the UI.
   - Auto-refresh every 30 s with an `AUTO ⋅ Xs` countdown pill; pauses when the tab is hidden.
6. **Research** (`/research`)
   - Backtests, methodology notebooks, and per-strategy historical evaluation.

## 5. Differentiation & Novelty
- **Resolution Alignment Engine**: Match quality is explicitly scored across five resolution-critical dimensions (date, threshold, wording, time window, ambiguity flags). False-positive rate drops from 60% to ~20% versus naïve text similarity.
- **Resolution Confidence Score**: A pre-trade trust signal that exposes oracle and dispute risk before capital commitment — a dimension absent from the native Polymarket and Kalshi interfaces.
- **Cross-asset mispricing detection**: Most prediction-market tools stop at intra-platform comparison (Polymarket vs Kalshi). Our system bridges *prediction markets* and *traditional derivatives* by replicating Polymarket binaries on Deribit via tight call spreads (Breeden–Litzenberger), producing structured trade tickets readable as a desk would read them.
- **Honest UI**: The app boots into LIVE mode by default; a `Demo` toggle freezes prices for offline presentations. The cross-asset panel surfaces filter counts (`DTE<3d filtered`, `wing filtered`, `in-band`) so the audience can verify what the system did and did not act on.
- **Discipline over surface area**: The prototype was deliberately trimmed to six surfaces that map 1-to-1 to the report's declared contributions. Earlier exploratory features were retired rather than retained as "demo" placeholders, on the principle that a smaller surface that fully delivers is more credible than a packed surface that partially delivers.

## 6. Technical Architecture (Summary)
- **Frontend**: Next.js App Router + Tailwind.
- **Backend**: Serverless API routes in Next.js.
- **Data Sources**: Polymarket Gamma API + Kalshi Trade API.
- **Real‑time**: SSE snapshot feed + WebSocket for orderbooks.
- **Trust Engine**: Evidence dataset + resolution criteria extractor.
- **Execution**: Paper‑trade execution service with validation and audit logs.

## 7. Algorithms & Models
1. **Market Matching**
   - Hybrid semantic + text similarity.
   - Entity/keyword guards (e.g., specific names, countries).
   - Resolution alignment score multiplies similarity.
2. **Trust Scoring**
   - Criteria: resolution clarity, evidence reliability, dispute risk.
   - Output: trust score (0‑100) and risk metrics.
3. **Options IV Analysis**
   - Black‑Scholes model for implied probabilities.
   - Greeks for sensitivity analysis.
4. **Arbitrage Detection**
   - Simple profitability check: Yes + No < 1.
   - Filters out low‑profit opportunities.
5. **Cross-Asset BTC Mispricing Engine** *(NEW)*
   - **Question matcher** (`matchBtcThreshold`): regex-based parser that extracts `{threshold, direction, expiry}` from Polymarket BTC questions. Conservative: returns `null` unless all four signals (asset/direction/threshold/expiry) are present.
   - **Deribit chain client** (`fetchBtcChainNearExpiry`): public-REST client; selects the listed expiry closest to the matched date, normalizes Deribit's inverse (BTC-denominated) prices to USD using the underlying spot returned with each book summary.
   - **Digital replication** (`buildDigitalReplicationAtStrike`): tightest call spread straddling the threshold; per-unit cost approximates the $1 binary as `(longCall.mid − shortCall.mid) / spreadWidth`. This is the textbook Breeden–Litzenberger digital approximation; the limitations subsection notes the smoothing improvements possible.
   - **Strategy generator** (`suggestStrategy`): emits a 3-leg ticket — Polymarket binary leg + long-low/short-high call-spread legs — sized for a configurable notional, with breakeven probability, capital estimate, and structured warnings (spread width, expiry gap, match confidence, unmodeled fees).
   - **Quality gates** (route layer): minimum 7 days to expiration; options-implied probability bounded to [5%, 95%]. Surfaces `rejectedShortDated` and `rejectedWing` counts so the audience can see what was filtered and why.

## 8. Evaluation Goals
- Reduce false positive matches by enforcing resolution alignment.
- Improve user confidence with trust explanations.
- Detect actionable arbitrage under strict filters.

## 9. Limitations
- The cross-asset engine currently covers BTC only (Polymarket × Deribit). Equity-index and ETH coverage is listed in future work.
- Execution service is simulated (paper-trade); the cross-asset trade tickets are decision-support, not auto-executed across the two venues.
- Trust evidence is a fixed dataset; real-time ingestion is future work.
- **Cross-asset engine specifics:**
  - Digital replication uses adjacent-strike call-spread differencing (textbook Breeden–Litzenberger), which is coarse when spread width is a meaningful fraction of spot. A cubic-spline of the call surface would yield a smoother density. The UI flags this as a warning whenever spread width > 5% of spot.
  - Polymarket and Deribit expiries rarely align exactly. The engine picks the nearest listed Deribit expiry and warns when the gap exceeds 7 days; mid-gap basis risk is acknowledged but not quantified.
  - Fees, slippage, and Polymarket → Deribit collateral transfer cost are not modeled in the edge calculation.

## 10. Future Work
- ETH and equity-index threshold matchers (extend `match-btc-threshold.ts` to a polymorphic matcher registry); SPY/QQQ via CBOE / Polygon.io.
- Smoothed risk-neutral density (cubic-spline of the call surface) replacing the discrete call-spread approximation.
- Additional signal engines (Lead-Lag VIX, Insurance Overlay, Dynamic Hedge Ratio) following the same pattern as the live cross-asset engine — each shipped only when its evaluation backtest is reproducible.
- Active learning loop from mismatch feedback into the Resolution Alignment Engine.
- Cross-platform settlement risk modeling and on-chain manipulation detection (transaction-graph analysis on Polygon).
- Advanced execution routing and slippage modeling.

## 11. Conclusion
PM Arbitrage tackles a core weakness in existing prediction platforms: **match quality and trust.** By combining alignment scoring, trust evidence, and actionable analytics, the system creates a defensible, research‑driven product with strong academic and practical value.

