
const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';

async function checkKalshi() {
    try {
        console.log('Fetching Kalshi markets via events...');
        // Fetch events like route.ts does
        const res = await fetch(`${KALSHI_API}/events?limit=100&with_nested_markets=true`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`HTTP ${res.status}: ${txt}`);
        }

        const data = await res.json();
        const events = data.events || [];
        console.log(`Fetched ${events.length} events.`);

        // Flatten markets from events
        let markets = [];
        events.forEach(e => {
            if (e.markets) markets.push(...e.markets);
        });

        console.log(`Extracted ${markets.length} markets from events.`);

        let stats = {
            total: markets.length,
            rejected: 0,
            reasons: {
                inactive: 0,
                shortTitle: 0,
                sportsStats: 0,
                parlay: 0,
                other: 0 // Should match "keep"
            },
            kept: 0
        };

        markets.forEach((m, idx) => {
            const title = m.title || '';
            const t = title.toLowerCase();
            const status = m.status;

            // Route.ts logic simulation:

            // 1. Title length check
            if (!title || title.length < 10) {
                stats.rejected++;
                stats.reasons.shortTitle++;
                if (idx < 20) console.log(`[REJECT SHORT] "${title}"`);
                return;
            }

            // 2. Sports Stats
            const isSportsStats = /\d+\+|wins by over|points scored|rebounds|assists|touchdown|strikeouts|home runs|passing yards/i.test(t);

            // 3. Parlay (My Fix)
            const isParlay = /,(yes|no)\s+/i.test(t);

            // 4. Question format
            const looksLikeQuestion = /^will\s|will\s.*\?|\?$/i.test(t) ||
                /^(what|who|when|how|which)/i.test(t);

            // 5. Active check
            const isActive = status === 'open' || status === 'active';

            // 6. Valid Format logic
            const isValidFormat = looksLikeQuestion || !isParlay;

            const keep = isActive && !isSportsStats && isValidFormat;

            if (!keep) {
                stats.rejected++;
                if (!isActive) {
                    stats.reasons.inactive++;
                } else if (isSportsStats) {
                    stats.reasons.sportsStats++;
                    if (stats.reasons.sportsStats <= 5) {
                        console.log(`[REJECT SPORTS] "${title}"`);
                    }
                } else if (!isValidFormat) {
                    stats.reasons.parlay++;
                    if (stats.reasons.parlay <= 5) {
                        console.log(`[REJECT PARLAY] "${title}"`);
                    }
                } else {
                    console.log(`[REJECT UNKNOWN] "${title}"`);
                }
            } else {
                stats.kept++;
                if (stats.kept <= 10) {
                    console.log(`[KEPT] "${title}" (bid:${m.yes_bid}, last:${m.last_price}, status:${m.status})`);
                }
            }
        });

        console.log('\nStats:', JSON.stringify(stats, null, 2));

    } catch (e) {
        console.error(e);
    }
}

checkKalshi();
