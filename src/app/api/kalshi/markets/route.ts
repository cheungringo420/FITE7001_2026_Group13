import { NextResponse } from 'next/server';
import { fetchAndNormalizeKalshiMarkets } from '@/lib/kalshi';
import { getCacheClient } from '@/lib/cache';
import { updateKalshiSnapshot } from '@/lib/realtime/market-stream';

const CACHE_TTL_MS = 30_000;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '500');

    try {
        const cache = getCacheClient();
        const cacheKey = `kalshi:markets:${limit}`;
        const cached = await cache.get<unknown[]>(cacheKey);
        if (cached) {
            return NextResponse.json({ markets: cached });
        }

        const normalizedMarkets = await fetchAndNormalizeKalshiMarkets(limit);

        console.log(`Returning ${normalizedMarkets.length} normalized markets`);

        await cache.set(cacheKey, normalizedMarkets, CACHE_TTL_MS);
        updateKalshiSnapshot(normalizedMarkets);
        return NextResponse.json({ markets: normalizedMarkets });
    } catch (error) {
        console.error('Error fetching Kalshi markets:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Kalshi markets', markets: [] },
            { status: 500 }
        );
    }
}
