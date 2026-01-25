import { NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ conditionId: string }> }
) {
    const { conditionId } = await params;

    if (!conditionId) {
        return NextResponse.json(
            { error: 'Condition ID is required' },
            { status: 400 }
        );
    }

    try {
        const url = `${GAMMA_API_BASE}/markets?condition_ids=${encodeURIComponent(conditionId)}`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
            next: { revalidate: 60 }, // Cache for 1 minute
        });

        if (!response.ok) {
            throw new Error(`Gamma API error: ${response.status}`);
        }

        const markets = await response.json();

        if (markets.length === 0) {
            return NextResponse.json(
                { error: 'Market not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(markets[0]);
    } catch (error) {
        console.error('Error fetching market:', error);
        return NextResponse.json(
            { error: 'Failed to fetch market' },
            { status: 500 }
        );
    }
}
