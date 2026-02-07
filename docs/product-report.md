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
1. **Market Explorer**
   - Unified list with search, category, and platform filters.
2. **Compare (P vs K)**
   - Semantic/text matching, strict alignment filters, confidence scores.
   - “Why this match?” tooltip and alignment breakdown.
3. **Arbitrage Scanner**
   - Cross‑platform + single‑platform arbitrage detection.
   - Trust‑filtered results and execute workflow.
4. **Terminal**
   - Live orderbook stream, price updates, trading panel.
5. **Trust Center**
   - Evidence explorer, dispute risk, resolution confidence.
6. **Options IV Analysis**
   - Options‑implied probability vs prediction markets.
   - Expiry alignment badges, liquidity guardrails, Greeks.
7. **Portfolio & Bot**
   - Track positions, P&L, and automated strategy presets.

## 5. Differentiation & Novelty
- **Resolution Alignment Engine**: Match quality is explicitly scored (date, threshold, wording, ambiguity).
- **Trust‑first UI**: Trust score is displayed before execution to reduce reckless trades.
- **Feedback loop**: Users can flag mismatches to improve the matching engine.
- **Evidence‑aware decisions**: Visualized evidence reliability and conflict signals.

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

## 8. Evaluation Goals
- Reduce false positive matches by enforcing resolution alignment.
- Improve user confidence with trust explanations.
- Detect actionable arbitrage under strict filters.

## 9. Limitations
- Options IV data is mocked in the demo.
- Execution service is simulated (paper‑trade).
- Trust evidence is a fixed dataset; real‑time ingestion is future work.

## 10. Future Work
- Real options data integrations (CBOE, broker APIs).
- Active learning loop from mismatch feedback.
- Cross‑platform settlement risk modeling.
- Advanced execution routing and slippage modeling.

## 11. Conclusion
PM Arbitrage tackles a core weakness in existing prediction platforms: **match quality and trust.** By combining alignment scoring, trust evidence, and actionable analytics, the system creates a defensible, research‑driven product with strong academic and practical value.

