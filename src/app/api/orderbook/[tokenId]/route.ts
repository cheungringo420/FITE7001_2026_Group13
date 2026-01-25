import { NextResponse } from 'next/server';

const CLOB_API_BASE = 'https://clob.polymarket.com';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ tokenId: string }> }
) {
    const { tokenId } = await params;

    if (!tokenId) {
        return NextResponse.json(
            { error: 'Token ID is required' },
            { status: 400 }
        );
    }

    try {
        const url = `${CLOB_API_BASE}/book?token_id=${encodeURIComponent(tokenId)}`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
            },
            // No caching for orderbook - we want real-time data
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`CLOB API error: ${response.status}`);
        }

        const orderBook = await response.json();
        return NextResponse.json(orderBook);
    } catch (error) {
        console.error('Error fetching orderbook:', error);
        return NextResponse.json(
            { error: 'Failed to fetch orderbook' },
            { status: 500 }
        );
    }
}
