import { NextResponse } from 'next/server';
import { parseMarket, Market } from '@/lib/polymarket';
import { normalizeKalshiMarket, KalshiMarket, KalshiEvent } from '@/lib/kalshi';
import {
    normalizePolymarketMarket,
    findMatchingMarkets,
    detectArbitrage,
} from '@/lib/arbitrage';
import { NormalizedMarket, ArbitrageOpportunity } from '@/lib/kalshi/types';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

export interface MatchedMarketPair {
    id: string;
    polymarket: NormalizedMarket;
    kalshi: NormalizedMarket;
    similarity: number;
    arbitrage: ArbitrageOpportunity | null;
}

export interface CompareResponse {
    matchedPairs: MatchedMarketPair[];
    unmatchedPolymarket: NormalizedMarket[];
    unmatchedKalshi: NormalizedMarket[];
    polymarketCount: number;
    kalshiCount: number;
    fetchedAt: string;
}

export async function GET() {
    try {
        // Fetch markets from both platforms in parallel
        // For Kalshi, we fetch both regular markets AND events with nested markets
        // Events contain more political/event-based markets that are comparable to Polymarket
        const [polymarketRes, kalshiMarketsRes, kalshiEventsRes] = await Promise.all([
            fetch(`${GAMMA_API_BASE}/markets?limit=100&active=true&closed=false&enableOrderBook=true`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 60 },
            }),
            fetch(`${KALSHI_API_BASE}/markets?limit=200&status=open`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 60 },
            }),
            // Fetch events with nested markets for better coverage of political/event markets
            fetch(`${KALSHI_API_BASE}/events?limit=100&status=open&with_nested_markets=true`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 60 },
            }),
        ]);

        if (!polymarketRes.ok) {
            throw new Error(`Polymarket API error: ${polymarketRes.status}`);
        }

        const polymarketData: Market[] = await polymarketRes.json();

        // Collect Kalshi markets from multiple sources
        const allKalshiMarkets: KalshiMarket[] = [];
        const seenTickers = new Set<string>();

        // Add markets from direct markets endpoint
        if (kalshiMarketsRes.ok) {
            const kalshiData = await kalshiMarketsRes.json();
            const markets = kalshiData.markets || [];
            for (const m of markets) {
                if (!seenTickers.has(m.ticker)) {
                    seenTickers.add(m.ticker);
                    allKalshiMarkets.push(m);
                }
            }
        }

        // Add markets from events (these are often better for comparison)
        if (kalshiEventsRes.ok) {
            const eventsData = await kalshiEventsRes.json();
            const events: KalshiEvent[] = eventsData.events || [];
            for (const event of events) {
                if (event.markets) {
                    for (const m of event.markets) {
                        if (!seenTickers.has(m.ticker)) {
                            seenTickers.add(m.ticker);
                            allKalshiMarkets.push(m);
                        }
                    }
                }
            }
        }

        // Normalize Polymarket markets
        const normalizedPolymarket: NormalizedMarket[] = polymarketData
            .filter(m => !m.closed && m.active) // Only active, open markets
            .map(m => {
                try {
                    return normalizePolymarketMarket(parseMarket(m));
                } catch {
                    return null;
                }
            })
            .filter((m): m is NormalizedMarket => m !== null && m.yesPrice > 0);

        // Normalize Kalshi markets - filter out sports-heavy markets for better matching
        const normalizedKalshi: NormalizedMarket[] = allKalshiMarkets
            .filter(m => {
                // Filter out short-term sports markets (usually have very specific player names/stats)
                const title = m.title?.toLowerCase() || '';
                const isSportsStats = /\d+\+|wins by over|points scored|rebounds|assists/i.test(title);
                // Kalshi uses 'active' or 'open' for open markets
                const isOpen = m.status === 'open' || m.status === 'active';
                return isOpen && !isSportsStats;
            })
            .map((m: KalshiMarket) => {
                try {
                    return normalizeKalshiMarket(m);
                } catch {
                    return null;
                }
            })
            .filter((m: NormalizedMarket | null): m is NormalizedMarket => m !== null && m.yesPrice > 0);

        // Find related markets across platforms
        // Use moderate threshold (0.40) to find topically related markets
        // Note: Exact same markets rarely exist across platforms due to different resolution criteria
        const matches = findMatchingMarkets(normalizedPolymarket, normalizedKalshi, 0.40);

        // Track matched IDs
        const matchedPolyIds = new Set<string>();
        const matchedKalshiIds = new Set<string>();

        // Build matched pairs with arbitrage detection
        // Only detect arbitrage for highly similar markets (>65% similarity)
        // to avoid false positives from topically related but different markets
        const ARBITRAGE_SIMILARITY_THRESHOLD = 0.65;

        const matchedPairs: MatchedMarketPair[] = matches.map(match => {
            matchedPolyIds.add(match.polymarket.id);
            matchedKalshiIds.add(match.kalshi.id);

            // Only check for arbitrage if markets are very similar (likely same event)
            // Different markets on related topics are NOT arbitrage opportunities
            const arbitrage = match.similarity >= ARBITRAGE_SIMILARITY_THRESHOLD
                ? detectArbitrage(match.polymarket, match.kalshi)
                : null;

            return {
                id: `${match.polymarket.id}-${match.kalshi.id}`,
                polymarket: match.polymarket,
                kalshi: match.kalshi,
                similarity: match.similarity,
                arbitrage,
            };
        });

        // Get unmatched markets - sort by volume for relevance
        const unmatchedPolymarket = normalizedPolymarket
            .filter(m => !matchedPolyIds.has(m.id))
            .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
            .slice(0, 30);

        const unmatchedKalshi = normalizedKalshi
            .filter(m => !matchedKalshiIds.has(m.id))
            .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
            .slice(0, 30);

        const response: CompareResponse = {
            matchedPairs: matchedPairs.sort((a, b) => {
                // Sort by arbitrage profit first, then by similarity
                if (a.arbitrage && b.arbitrage) {
                    return b.arbitrage.profitPercentage - a.arbitrage.profitPercentage;
                }
                if (a.arbitrage) return -1;
                if (b.arbitrage) return 1;
                return b.similarity - a.similarity;
            }),
            unmatchedPolymarket,
            unmatchedKalshi,
            polymarketCount: normalizedPolymarket.length,
            kalshiCount: normalizedKalshi.length,
            fetchedAt: new Date().toISOString(),
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error comparing markets:', error);
        return NextResponse.json(
            { error: 'Failed to compare markets' },
            { status: 500 }
        );
    }
}
