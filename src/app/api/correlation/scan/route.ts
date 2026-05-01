import { NextResponse } from 'next/server';
import { parseMarket, Market } from '@/lib/polymarket';
import { fetchAndNormalizeKalshiMarkets } from '@/lib/kalshi';
import { normalizePolymarketMarket } from '@/lib/arbitrage';
import { NormalizedMarket } from '@/lib/kalshi/types';
import { scanCorrelations } from '@/lib/correlation/engine';
import { getFeatureFlags } from '@/lib/config/features';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

export async function GET(request: Request) {
    try {
        const flags = getFeatureFlags();
        if (!flags.labs) {
            return NextResponse.json({ error: 'Correlation scanner is available only in Labs mode' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const region = searchParams.get('region') || 'all';

        // Fetch markets from both platforms
        const [polymarketRes, normalizedKalshi] = await Promise.all([
            fetch(`${GAMMA_API_BASE}/markets?limit=200&active=true&closed=false`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 120 },
            }),
            fetchAndNormalizeKalshiMarkets(200)
        ]);

        if (!polymarketRes.ok) {
            throw new Error('Failed to fetch Polymarket data');
        }

        const polymarketData: Market[] = await polymarketRes.json();

        const normalizedPolymarket: NormalizedMarket[] = polymarketData
            .map(m => {
                try {
                    return normalizePolymarketMarket(parseMarket(m));
                } catch {
                    return null;
                }
            })
            .filter((m): m is NormalizedMarket => m !== null);

        // Combine all markets for correlation scan
        const allMarkets = [...normalizedPolymarket, ...normalizedKalshi];

        // Run correlation scan
        const result = scanCorrelations(allMarkets);

        // Filter by region if specified
        if (region !== 'all') {
            result.chains = result.chains.filter(
                c => c.region.toLowerCase() === region.toLowerCase()
            );
            const chainMarketIds = new Set(
                result.chains.flatMap(c => c.links.flatMap(l => [l.eventA.marketId, l.eventB.marketId]))
            );
            result.pairs = result.pairs.filter(
                p => chainMarketIds.has(p.eventA.marketId) || chainMarketIds.has(p.eventB.marketId)
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error scanning correlations:', error);
        return NextResponse.json(
            { error: 'Failed to scan for correlations' },
            { status: 500 }
        );
    }
}
