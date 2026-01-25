import { NextResponse } from 'next/server';

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const params = new URLSearchParams();

    const limit = searchParams.get('limit') || '20';
    const cursor = searchParams.get('cursor');
    const status = searchParams.get('status') || 'open';
    const event_ticker = searchParams.get('event_ticker');
    const series_ticker = searchParams.get('series_ticker');

    params.set('limit', limit);
    params.set('status', status);
    if (cursor) params.set('cursor', cursor);
    if (event_ticker) params.set('event_ticker', event_ticker);
    if (series_ticker) params.set('series_ticker', series_ticker);

    try {
        const url = `${KALSHI_API_BASE}/markets?${params.toString()}`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
            next: { revalidate: 30 },
        });

        if (!response.ok) {
            throw new Error(`Kalshi API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching Kalshi markets:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Kalshi markets' },
            { status: 500 }
        );
    }
}
