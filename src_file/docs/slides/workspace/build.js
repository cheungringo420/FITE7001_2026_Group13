const pptxgen = require('pptxgenjs');
const path = require('path');
const html2pptx = require('./html2pptx');

// Per-slide speaker notes — what to say while each slide is on screen.
// Tuned for ~12-minute total walk-through. Read these aloud naturally,
// don't memorise verbatim — the script is in docs/presentation-script.md
// for the polished long-form version.
const NOTES = {
    '01-title.html': `
[Open: 30 seconds, set the frame.]
"Good morning. I'm Ringo Cheung, and this is the final presentation for our FITE7001 capstone — a working prototype that turns Polymarket and Kalshi prediction markets into hedging instruments alongside traditional derivatives.
What I'll show you is live at pmv12.vercel.app, and the report and the slides are in the repo."
[Click to next.]`,

    '02-thesis.html': `
[Set the map: 60 seconds.]
"Before I dive in, here's the entire project on one screen. Six surfaces in the navbar — Markets, Compare, Arbitrage, Trust, Cross-Asset, Research. Each maps one-to-one to a section of the report. Earlier exploratory features — auto-trading bot, portfolio tracker, multi-strategy signal feed — were retired before today, deliberately, on the principle that a smaller surface that fully delivers is more credible than a packed one that partially delivers.
The two declared technical contributions sit on Compare and Trust — the Resolution Alignment Engine and the Resolution Confidence Score. The most novel piece, the cross-asset framework, sits on Cross-Asset. Those three are what I'll spend most of my time on."
[Click to next.]`,

    '03-markets.html': `
[Markets entry point: 45 seconds.]
"This is the entry. A unified Polymarket plus Kalshi list. Top-right of the navbar shows LIVE — both WebSocket feeds open automatically the moment the app boots. Prices are streaming. There's a 'Demo' toggle next to the LIVE pill in case Wi-Fi dies during my talk; one click and prices freeze instead of erroring out.
The two filters that matter — platform tab and the minimum-trust slider — are visible. The trust slider does real work: it filters the entire opportunity set, not just hides a hint."
[Click to next.]`,

    '04-compare.html': `
[The first contribution: 90 seconds. This is the most quantitative claim in the talk.]
"Compare is where the first technical contribution lives — the Resolution Alignment Engine. Why does this matter? A naïve text-similarity match between Polymarket and Kalshi has a sixty-percent false-positive rate on our cleaned universe. Six out of every ten apparent arbitrage opportunities are not arbitrage at all — they are resolution mismatches. Two markets phrased identically can resolve on different dates, against different criteria, against different evidence sources.
The Engine is a three-layer pipeline. Layer one is TF-IDF text similarity. Layer two is dense semantic embeddings. Layer three — the actual contribution — extracts five resolution-critical dimensions from each question: explicit date, objective threshold, resolution wording, time window, and ambiguity flags. A match is confirmed only when all five align.
End-to-end, that drops the false-positive rate from sixty percent to about twenty percent. Forty percentage points. The 'Why this match?' tooltip you see here breaks down which of the five criteria each side satisfied — before you commit any capital."
[Click to next.]`,

    '05-arbitrage.html': `
[The scanner: 60 seconds.]
"Arbitrage takes the matched pairs from Compare and runs the standard Yes-plus-No-less-than-one profitability check. The list is trust-filtered — opportunities that pass the alignment gate but fail the trust gate are suppressed before display, not just labelled.
Click any opportunity and the execution modal opens. To be clear: this is paper-trade only with audit logs. The cross-venue settlement architecture — the Polygon-USDC to Deribit-BTC bridging required for a real auto-execution pipeline — is future work, deliberately. The report's regulatory section explains why."
[Click to next.]`,

    '06-trust.html': `
[Second contribution: 90 seconds. This is where I'd slow down.]
"This is the second declared contribution — the Resolution Confidence Score. Even when two markets are correctly aligned, a separate question remains: will this market resolve cleanly without dispute? That question has no answer in the displayed price. It depends on the integrity of the resolution mechanism — UMA's Optimistic Oracle for Polymarket — and on whether the underlying real-world fact is multi-source-attested or contested.
The Score is a zero-to-one-hundred composite of three independently-assessed components. Criteria Clarity at forty percent. Evidence Consensus at thirty-five. Integrity Risk at twenty-five percent, inverted.
Worked example you can check live: 'Will Bitcoin hit one million dollars before GTA Six?' scores about seventy. Why? Criteria Clarity is high — the conjunction is unambiguous. Evidence Consensus is medium — there's no corroborating reporting. Integrity Risk is high because the conjunction is a known dispute pattern in the UMA log. The seventy tells the institutional reader: structurally sound, but resolution-side risk is elevated. Size accordingly."
[Click to next.]`,

    '07-cross-asset.html': `
[The centrepiece: 75 seconds. This is what makes the project novel.]
"This is the most novel part of the project. Existing prediction-market tools compare one prediction market against another. We compare them against the options market.
The pipeline runs four steps in real time, every thirty seconds. One: scan Polymarket — top five hundred markets by twenty-four-hour volume, BTC-filtered. Two: parse the question — a regex matcher extracts threshold, direction, and expiry. 'Will Bitcoin reach one hundred thousand dollars by December thirty-first, 2026' becomes a structured object. Three: fetch the Deribit chain — public REST, no auth required. We pick the listed expiry closest to the matched date and normalize Deribit's BTC-denominated prices to USD. Four: replicate the binary using a tight call spread, and emit a structured three-leg trade ticket if the discrepancy exceeds the no-arbitrage band.
What you see on the screen is the live engine. Today happens to be efficient market — zero opportunities — and the page tells you exactly why through the filter chips."
[Click to next, walk through the worked example.]`,

    '08-worked-example.html': `
[Worked example with numbers: 75 seconds. Read the trade aloud.]
"Concrete example. Polymarket question: 'Will Bitcoin reach eighty thousand by May 31, 2026?' Polymarket YES is forty-five cents — market says forty-five percent chance. Bitcoin spot today is seventy-seven thousand.
On Deribit, take the call spread straddling eighty K. Long the eighty K call at one thousand two hundred. Short the eighty-two K call at seven hundred twenty. Net cost: four hundred eighty dollars per spread. Per dollar of binary payoff that's four hundred eighty divided by two thousand spread width — twenty-four cents. So the options market implies a twenty-four percent probability.
Forty-five versus twenty-four — they cannot both be right. Twenty-one percentage points of disagreement. The engine emits the trade you see on the right: short thirteen hundred Polymarket YES, buy one Deribit eighty-K call, sell one Deribit eighty-two-K call. Net cash up front is plus one hundred five dollars. Edge per trade — about two hundred ten dollars on a thousand dollars of capital. That's what 'a structured trade ticket the audience can read like a desk would' means."
[Click to next.]`,

    '09-math.html': `
[Math slide: 60 seconds. Don't dwell.]
"For the methodology question I expect from the panel: the replication is the textbook Breeden-Litzenberger digital approximation. The discrete form is on the left — call price at K minus call price at K-plus-epsilon, divided by epsilon, equals approximately the risk-neutral probability of being above K. As epsilon shrinks to zero, the call spread recovers the full risk-neutral density f-of-K — that's the partial-second-derivative of C with respect to K.
We use the discrete approximation with adjacent listed strikes. It's defensible textbook, it's inspectable in the UI — you can see exactly which two strikes the engine is differencing — and the bigger error sources are not the discretisation but unmodeled fees and expiry gap, which I'll cover in limitations."
[Click to next.]`,

    '10-quality-gates.html': `
[Quality gates: 45 seconds. Audience-friendly slide.]
"Two filters. Wing-distortion gate: options-implied probability bounded to between five and ninety-five percent. Why? At the wings, both options trade at intrinsic and the spread cost equals the spread width. The math says one hundred percent probability — but that's an artifact, not signal. Filtered out.
Gamma-noise gate: minimum three days to expiration. Same-day binaries are pure gamma plays — a single tweet moves both prices instantly. Coin flip, not stable cross-asset signal. Filtered out.
The chips show you exactly how many were filtered for each reason. Today: thirty-two scanned, thirteen parsed, twelve killed by the DTE filter, zero by the wing filter, one within the no-arb band — zero opportunities. That's the efficient-market case. The system is working; markets just happen to agree right now."
[Click to next.]`,

    '11-research.html': `
[Backtests: 45 seconds.]
"Every claim on the previous slides is backed by a notebook. The Research page lists six strategies. Walk-forward validation, train-validation-test splits enforced in code, no look-ahead bias. The portfolio metrics on the test set February through April 2026 are on the right: Sharpe one-point-six-five, fourteen-point-two percent annualized return, eight-point-six volatility, max drawdown five-point-eight, t-statistic four-point-two — well above the Harvey-Liu-and-Zhang threshold of three for treating a backtest as believable.
The point of the page is reproducibility. Anything I claimed earlier you can re-run yourself."
[Click to next.]`,

    '12-limitations.html': `
[Limitations: 45 seconds. Get ahead of the panel's questions.]
"Three things I want to disclose before you ask. First, digital replication is approximate — discrete differencing, not a smoothed call surface. The UI flags this when spread width exceeds five percent of spot. The fix is a cubic-spline of the surface; that's the highest-priority future-work item. Second, expiries don't always align — Polymarket and Deribit dates differ in most cases. We pick nearest-listed and warn when the gap exceeds seven days. Mid-gap basis risk is acknowledged but not quantified. Third, fees and cross-venue collateral — Polymarket has zero fees, Deribit takes 0.03 percent, but the real-world cost is bridging USDC from Polygon to a centralized exchange. Net edge is roughly three to five percentage points lower than displayed. Real research prototype, not production trading desk."
[Click to next.]`,

    '13-closing.html': `
[Closing: 30 seconds. Land the plane.]
"To summarize: three pillars. Resolution Alignment cuts false positives sixty to twenty percent. Resolution Confidence exposes oracle risk before capital commitment. The cross-asset framework bridges prediction markets and traditional derivatives end-to-end. Code and report are in the repo. Live demo at pmv12.vercel.app. Happy to take questions on methodology, math, code, or future work."
[Stop. Wait for questions.]`,
};

async function build() {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'Ringo Cheung';
    pptx.title = 'PM Arbitrage — Final Presentation';
    pptx.subject = 'FITE7001 Capstone';

    const slides = Object.keys(NOTES);
    for (const f of slides) {
        const slidePath = path.join(__dirname, f);
        const { slide } = await html2pptx(slidePath, pptx);
        slide.addNotes(NOTES[f].trim());
        console.log(`  added ${f} (with speaker notes)`);
    }

    const outPath = path.join(__dirname, '..', 'pm-arbitrage-final-presentation.pptx');
    await pptx.writeFile({ fileName: outPath });
    console.log(`\nWrote ${outPath}`);
}

build().catch((e) => { console.error(e); process.exit(1); });
