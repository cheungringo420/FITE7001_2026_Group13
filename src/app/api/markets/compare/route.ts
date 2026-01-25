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
        // For Kalshi, we fetch from multiple endpoints and use pagination
        const [polymarketRes, kalshiMarketsRes1, kalshiMarketsRes2, kalshiEventsRes] = await Promise.all([
            // Fetch ALL markets for comprehensive coverage
            fetch(`${GAMMA_API_BASE}/markets?limit=1000&active=true&closed=false&enableOrderBook=true`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 60 },
            }),
            // Kalshi markets endpoint - try without status filter first
            fetch(`${KALSHI_API_BASE}/markets?limit=1000`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 60 },
            }),
            // Also try with active status
            fetch(`${KALSHI_API_BASE}/markets?limit=1000&status=active`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 60 },
            }),
            // Fetch events with nested markets for better coverage of political/event markets
            fetch(`${KALSHI_API_BASE}/events?limit=1000&with_nested_markets=true`, {
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

        // Helper to add markets from a response
        const addMarketsFromResponse = async (res: Response) => {
            if (res.ok) {
                try {
                    const data = await res.json();
                    const markets = data.markets || [];
                    for (const m of markets) {
                        if (m.ticker && !seenTickers.has(m.ticker)) {
                            seenTickers.add(m.ticker);
                            allKalshiMarkets.push(m);
                        }
                    }
                } catch (e) {
                    console.error('Error parsing Kalshi markets response:', e);
                }
            }
        };

        // Add markets from direct markets endpoints (multiple fetches)
        await addMarketsFromResponse(kalshiMarketsRes1);
        await addMarketsFromResponse(kalshiMarketsRes2);

        // Add markets from events (these are often better for comparison)
        if (kalshiEventsRes.ok) {
            try {
                const eventsData = await kalshiEventsRes.json();
                const events: KalshiEvent[] = eventsData.events || [];
                for (const event of events) {
                    if (event.markets) {
                        for (const m of event.markets) {
                            if (m.ticker && !seenTickers.has(m.ticker)) {
                                seenTickers.add(m.ticker);
                                allKalshiMarkets.push(m);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Error parsing Kalshi events response:', e);
            }
        }

        console.log(`Fetched Kalshi markets: ${allKalshiMarkets.length} total (${seenTickers.size} unique)`);

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

        // Normalize Kalshi markets - filter out sports-heavy and invalid markets
        const normalizedKalshi: NormalizedMarket[] = allKalshiMarkets
            .filter(m => {
                const title = m.title?.toLowerCase() || '';
                
                // Must have a title
                if (!title || title.length < 10) return false;
                
                // Filter out sports stats markets
                const isSportsStats = /\d+\+|wins by over|points scored|rebounds|assists|touchdown|strikeouts|home runs|passing yards/i.test(title);
                
                // Filter out parlay/multi-leg bets
                const isParlay = /^(yes|no)\s+[a-z]/i.test(title) || /,(yes|no)\s+/i.test(title);
                
                // Filter out player-specific sports bets
                const isPlayerBet = /^(yes|no)\s+[A-Z][a-z]+\s+[A-Z]/i.test(m.title || '');
                
                // Valid markets typically look like questions
                const looksLikeQuestion = /^will\s|will\s.*\?|\?$/i.test(title) || 
                                          /^(what|who|when|how|which)/i.test(title);
                const startsWithYesNo = /^(yes|no)\s/i.test(title);
                
                // Kalshi uses 'active' or 'open' for open markets
                const isOpen = m.status === 'open' || m.status === 'active';
                
                // Accept if it looks like a question OR doesn't start with yes/no
                const isValidFormat = looksLikeQuestion || (!startsWithYesNo && !isParlay && !isPlayerBet);
                
                return isOpen && !isSportsStats && isValidFormat;
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
        // Use lower threshold (0.25) to return more potential matches
        // Frontend will filter based on user-selected threshold
        const matches = findMatchingMarkets(normalizedPolymarket, normalizedKalshi, 0.25);

        // Track matched IDs and deduplicate pairs
        const matchedPolyIds = new Set<string>();
        const matchedKalshiIds = new Set<string>();
        const seenPairs = new Set<string>(); // Track unique poly-kalshi title pairs

        // Build matched pairs with arbitrage detection
        // Only detect arbitrage for highly similar markets (>65% similarity)
        // to avoid false positives from topically related but different markets
        const ARBITRAGE_SIMILARITY_THRESHOLD = 0.65;

        const matchedPairs: MatchedMarketPair[] = [];

        for (const match of matches) {
            // Create a unique key based on question texts to avoid duplicates
            // (Kalshi often has multiple markets with same title for different candidates)
            const pairKey = `${match.polymarket.question}|||${match.kalshi.question}`;

            if (seenPairs.has(pairKey)) {
                continue; // Skip duplicate pair
            }
            seenPairs.add(pairKey);

            matchedPolyIds.add(match.polymarket.id);
            matchedKalshiIds.add(match.kalshi.id);

            // Only check for arbitrage if markets are very similar (likely same event)
            // Different markets on related topics are NOT arbitrage opportunities
            const arbitrage = match.similarity >= ARBITRAGE_SIMILARITY_THRESHOLD
                ? detectArbitrage(match.polymarket, match.kalshi)
                : null;

            matchedPairs.push({
                id: `${match.polymarket.id}-${match.kalshi.id}`,
                polymarket: match.polymarket,
                kalshi: match.kalshi,
                similarity: match.similarity,
                arbitrage,
            });
        }

        // Get unmatched markets - sort by volume for relevance
        // Show all unmatched markets (no limit)
        const unmatchedPolymarket = normalizedPolymarket
            .filter(m => !matchedPolyIds.has(m.id))
            .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

        const unmatchedKalshi = normalizedKalshi
            .filter(m => !matchedKalshiIds.has(m.id))
            .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

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
