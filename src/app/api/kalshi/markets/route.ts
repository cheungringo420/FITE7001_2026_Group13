import { NextResponse } from 'next/server';
import { normalizeKalshiMarket, KalshiMarket, KalshiEvent } from '@/lib/kalshi';

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '200');

    try {
        // Fetch both regular markets and events for better coverage
        const [marketsRes, eventsRes] = await Promise.all([
            fetch(`${KALSHI_API_BASE}/markets?limit=${limit}&status=open`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 30 },
            }),
            fetch(`${KALSHI_API_BASE}/events?limit=50&status=open&with_nested_markets=true`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 30 },
            }),
        ]);

        const allMarkets: KalshiMarket[] = [];
        const seenTickers = new Set<string>();

        // Add markets from direct endpoint
        if (marketsRes.ok) {
            const marketsData = await marketsRes.json();
            for (const m of (marketsData.markets || [])) {
                if (!seenTickers.has(m.ticker)) {
                    seenTickers.add(m.ticker);
                    allMarkets.push(m);
                }
            }
        }

        // Add markets from events
        if (eventsRes.ok) {
            const eventsData = await eventsRes.json();
            const events: KalshiEvent[] = eventsData.events || [];
            for (const event of events) {
                if (event.markets) {
                    for (const m of event.markets) {
                        if (!seenTickers.has(m.ticker)) {
                            seenTickers.add(m.ticker);
                            allMarkets.push(m);
                        }
                    }
                }
            }
        }

        // Filter out sports betting markets and normalize
        const normalizedMarkets = allMarkets
            .filter(m => {
                const title = m.title?.toLowerCase() || '';
                // Filter out sports stats markets
                const isSportsStats = /\d+\+|wins by over|points scored|rebounds|assists|touchdown/i.test(title);
                const isActive = m.status === 'open' || m.status === 'active';
                return isActive && !isSportsStats;
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
