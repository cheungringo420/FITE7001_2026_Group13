import { NextResponse } from 'next/server';
import { parseMarket, Market } from '@/lib/polymarket';
import { fetchAndNormalizeKalshiMarkets } from '@/lib/kalshi';
import {
    normalizePolymarketMarket,
    findMatchingMarkets,
    scanForArbitrage,
    detectSinglePlatformArbitrage
} from '@/lib/arbitrage';
import { NormalizedMarket, ArbitrageOpportunity } from '@/lib/kalshi/types';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

export async function GET() {
    try {
        // Fetch markets from both platforms in parallel
        const [polymarketRes, normalizedKalshi] = await Promise.all([
            fetch(`${GAMMA_API_BASE}/markets?limit=100&active=true&closed=false&enableOrderBook=true`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 60 },
            }),
            fetchAndNormalizeKalshiMarkets(100)
        ]);

        if (!polymarketRes.ok) {
            throw new Error('Failed to fetch from one or more platforms');
        }

        const polymarketData: Market[] = await polymarketRes.json();

        // Normalize markets
        const normalizedPolymarket: NormalizedMarket[] = polymarketData
            .map(m => {
                try {
                    return normalizePolymarketMarket(parseMarket(m));
                } catch {
                    return null;
                }
            })
            .filter((m): m is NormalizedMarket => m !== null);

        // Kalshi markets are already normalized by the helper

        // Find matching markets across platforms
        const matches = findMatchingMarkets(normalizedPolymarket, normalizedKalshi, 0.35);

        // Scan for cross-platform arbitrage
        const crossPlatformArbitrage = scanForArbitrage(matches);

        // Also check for single-platform arbitrage opportunities
        const singlePlatformArbitrage: ArbitrageOpportunity[] = [];

        for (const market of [...normalizedPolymarket, ...normalizedKalshi]) {
            const opportunity = detectSinglePlatformArbitrage(market);
            if (opportunity) {
                singlePlatformArbitrage.push(opportunity);
            }
        }

        // Combine and sort all opportunities
        const allOpportunities = [...crossPlatformArbitrage, ...singlePlatformArbitrage]
            .sort((a, b) => b.profitPercentage - a.profitPercentage);

        return NextResponse.json({
            opportunities: allOpportunities,
            matchedMarkets: matches.length,
            polymarketCount: normalizedPolymarket.length,
            kalshiCount: normalizedKalshi.length,
            scannedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error scanning for arbitrage:', error);
        return NextResponse.json(
            { error: 'Failed to scan for arbitrage opportunities' },
            { status: 500 }
        );
    }
}
