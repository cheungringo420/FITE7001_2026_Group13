import { NextResponse } from 'next/server';
import { getCacheClient } from '@/lib/cache';
import { updatePolymarketSnapshot } from '@/lib/realtime/market-stream';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const CACHE_TTL_MS = 30_000;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    // Forward query parameters to Gamma API
    const params = new URLSearchParams();

    const limit = searchParams.get('limit') || '20';
    const offset = searchParams.get('offset') || '0';
    const order = searchParams.get('order') || 'volume24hr';
    const ascending = searchParams.get('ascending') || 'false';
    const active = searchParams.get('active') || 'true';
    const closed = searchParams.get('closed') || 'false';
    const search = searchParams.get('search');

    params.set('limit', limit);
    params.set('offset', offset);
    params.set('order', order);
    params.set('ascending', ascending);
    params.set('active', active);
    params.set('closed', closed);
    params.set('enableOrderBook', 'true');

    try {
        const cache = getCacheClient();
        const cacheKey = `polymarket:markets:${params.toString()}`;
        const cached = await cache.get<unknown[]>(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        const url = `${GAMMA_API_BASE}/markets?${params.toString()}`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
            next: { revalidate: 30 }, // Cache for 30 seconds
        });

        if (!response.ok) {
            throw new Error(`Gamma API error: ${response.status}`);
        }

        let markets = await response.json();

        // Client-side search filtering if search term provided
        if (search) {
            const lowerSearch = search.toLowerCase();
            markets = markets.filter((m: { question?: string; description?: string }) =>
                m.question?.toLowerCase().includes(lowerSearch) ||
                m.description?.toLowerCase().includes(lowerSearch)
            );
        }

        await cache.set(cacheKey, markets, CACHE_TTL_MS);
        updatePolymarketSnapshot(markets);
        return NextResponse.json(markets);
    } catch (error) {
        console.error('Error fetching markets:', error);
        return NextResponse.json(
            { error: 'Failed to fetch markets' },
            { status: 500 }
        );
    }
}
