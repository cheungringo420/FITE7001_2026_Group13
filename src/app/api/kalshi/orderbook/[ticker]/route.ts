import { NextResponse } from 'next/server';

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ ticker: string }> }
) {
    const { ticker } = await params;

    if (!ticker) {
        return NextResponse.json(
            { error: 'Ticker is required' },
            { status: 400 }
        );
    }

    try {
        const url = `${KALSHI_API_BASE}/markets/${encodeURIComponent(ticker)}/orderbook`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Kalshi API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching Kalshi orderbook:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Kalshi orderbook' },
            { status: 500 }
        );
    }
}
