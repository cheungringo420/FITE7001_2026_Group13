import { NextResponse } from 'next/server';
import { parseMarket, Market } from '@/lib/polymarket';
import { fetchAndNormalizeKalshiMarkets } from '@/lib/kalshi';
import {
    normalizePolymarketMarket,
    findMatchingMarkets,
    findMatchingMarketsAsync,
    detectArbitrage,
} from '@/lib/arbitrage';
import { NormalizedMarket, ArbitrageOpportunity } from '@/lib/kalshi/types';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

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
    matchingMethod: 'semantic' | 'text';  // Indicates which matching algorithm was used
}

export async function GET() {
    try {
        // Fetch markets from both platforms in parallel
        const [polymarketRes, normalizedKalshi] = await Promise.all([
            fetch(`${GAMMA_API_BASE}/markets?limit=1000&active=true&closed=false&enableOrderBook=true`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 60 },
            }),
            fetchAndNormalizeKalshiMarkets(1000)
        ]);

        if (!polymarketRes.ok) {
            throw new Error(`Polymarket API error: ${polymarketRes.status}`);
        }

        const polymarketData: Market[] = await polymarketRes.json();

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

        // Kalshi markets are already normalized by the helper

        // Find related markets across platforms using semantic matching
        // Uses OpenAI embeddings for better accuracy, falls back to text matching
        const { matches, matchingMethod } = await findMatchingMarketsAsync(
            normalizedPolymarket,
            normalizedKalshi,
            0.30  // Use moderate threshold for semantic matching
        );

        console.log(`[Compare] Using ${matchingMethod} matching, found ${matches.length} potential matches`);

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
            matchingMethod,  // 'semantic' or 'text'
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
