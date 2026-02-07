/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');

try {
    const raw = fs.readFileSync('kalshi_sample.json', 'utf8');
    const data = JSON.parse(raw);
    const allMarkets = data.markets || [];

    console.log(`Loaded ${allMarkets.length} markets`);

    let kept = 0;
    let rejected = 0;

    allMarkets.forEach(m => {
        const title = m.title?.toLowerCase() || '';

        // Must have a title
        if (!title || title.length < 10) return;

        // Filter out sports stats markets
        const isSportsStats = /\d+\+|wins by over|points scored|rebounds|assists|touchdown|strikeouts|home runs|passing yards/i.test(title);

        // Filter out parlay/multi-leg bets (titles with comma-separated names)
        // These look like "yes TeamA,yes TeamB" or "no PlayerA,no PlayerB"
        const isParlay = /^(yes|no)\s+[a-z]/i.test(title) || /,(yes|no)\s+/i.test(title);

        // Valid markets typically:
        // - Start with "Will" or contain "?"
        // - Don't start with "yes " or "no "
        const looksLikeQuestion = /^will\s|will\s.*\?|\?$/i.test(title) ||
            /^(what|who|when|how|which)/i.test(title);

        const isActive = m.status === 'open' || m.status === 'active';

        // Accept if it looks like a question OR valid format (not parlay)
        // We interpret "yes Team" as "Will Team win?"
        const isValidFormat = looksLikeQuestion || !isParlay;

        const keep = isActive && !isSportsStats && isValidFormat;

        if (keep) {
            kept++;
            if (kept <= 10) console.log(`KEPT: ${title}`);
        } else {
            rejected++;
            if (rejected <= 10) {
                console.log(`REJECTED: ${title}`);
                console.log(`  Stats=${isSportsStats} Parlay=${isParlay} Q=${looksLikeQuestion}`);
            }
        }
    });

    console.log(`\nTotal Kept: ${kept}`);
    console.log(`Total Rejected: ${rejected}`);

} catch (e) {
    console.error(e);
}
