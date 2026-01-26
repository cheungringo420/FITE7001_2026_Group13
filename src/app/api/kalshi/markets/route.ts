import { NextResponse } from 'next/server';
import { fetchAndNormalizeKalshiMarkets } from '@/lib/kalshi';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '500');

    try {
        const normalizedMarkets = await fetchAndNormalizeKalshiMarkets(limit);

        console.log(`Returning ${normalizedMarkets.length} normalized markets`);

        return NextResponse.json({ markets: normalizedMarkets });
    } catch (error) {
        console.error('Error fetching Kalshi markets:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Kalshi markets', markets: [] },
            { status: 500 }
        );
    }
}
