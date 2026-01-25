import { NextResponse } from 'next/server';
import { normalizeKalshiMarket, KalshiMarket, KalshiEvent } from '@/lib/kalshi';

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '500');

    try {
        // Fetch from multiple endpoints for better coverage
        const [marketsRes1, marketsRes2, eventsRes] = await Promise.all([
            // Fetch without status filter (gets all markets)
            fetch(`${KALSHI_API_BASE}/markets?limit=1000`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 30 },
            }),
            // Fetch with active status
            fetch(`${KALSHI_API_BASE}/markets?limit=1000&status=active`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 30 },
            }),
            // Fetch all events with nested markets
            fetch(`${KALSHI_API_BASE}/events?limit=500&with_nested_markets=true`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 30 },
            }),
        ]);

        const allMarkets: KalshiMarket[] = [];
        const seenTickers = new Set<string>();

        // Helper to add markets
        const addMarkets = (markets: KalshiMarket[]) => {
            for (const m of markets) {
                if (m.ticker && !seenTickers.has(m.ticker)) {
                    seenTickers.add(m.ticker);
                    allMarkets.push(m);
                }
            }
        };

        // Add markets from direct endpoints
        if (marketsRes1.ok) {
            const data = await marketsRes1.json();
            addMarkets(data.markets || []);
        }
        if (marketsRes2.ok) {
            const data = await marketsRes2.json();
            addMarkets(data.markets || []);
        }

        // Add markets from events
        if (eventsRes.ok) {
            const eventsData = await eventsRes.json();
            const events: KalshiEvent[] = eventsData.events || [];
            for (const event of events) {
                if (event.markets) {
                    addMarkets(event.markets);
                }
            }
        }

        console.log(`Kalshi API: fetched ${allMarkets.length} total markets`);

        // Filter out sports betting markets and invalid markets
        const normalizedMarkets = allMarkets
            .filter(m => {
                const title = m.title?.toLowerCase() || '';
                
                // Must have a title
                if (!title || title.length < 10) return false;

                // Filter out sports stats markets
                const isSportsStats = /\d+\+|wins by over|points scored|rebounds|assists|touchdown|strikeouts|home runs|passing yards/i.test(title);

                // Filter out parlay/multi-leg bets (titles with comma-separated names)
                // These look like "yes TeamA,yes TeamB" or "no PlayerA,no PlayerB"
                const isParlay = /^(yes|no)\s+[a-z]/i.test(title) || /,(yes|no)\s+/i.test(title);

                // Filter out player-specific sports bets (contains player names with "no" or "yes" prefix)
                const isPlayerBet = /^(yes|no)\s+[A-Z][a-z]+\s+[A-Z]/i.test(m.title || '');

                // Valid markets typically:
                // - Start with "Will" or contain "?"
                // - Don't start with "yes " or "no "
                const looksLikeQuestion = /^will\s|will\s.*\?|\?$/i.test(title) || 
                                          /^(what|who|when|how|which)/i.test(title);
                const startsWithYesNo = /^(yes|no)\s/i.test(title);

                const isActive = m.status === 'open' || m.status === 'active';
                
                // Accept if it looks like a question OR doesn't start with yes/no and passes other filters
                const isValidFormat = looksLikeQuestion || (!startsWithYesNo && !isParlay && !isPlayerBet);

                return isActive && !isSportsStats && isValidFormat;
            })
            .map(m => {
                try {
                    return normalizeKalshiMarket(m);
                } catch {
                    return null;
                }
            })
            .filter(m => m !== null && m.yesPrice > 0)
            .sort((a, b) => (b!.volume24h || 0) - (a!.volume24h || 0))
            .slice(0, limit);

        return NextResponse.json({ markets: normalizedMarkets });
    } catch (error) {
        console.error('Error fetching Kalshi markets:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Kalshi markets', markets: [] },
            { status: 500 }
        );
    }
}
