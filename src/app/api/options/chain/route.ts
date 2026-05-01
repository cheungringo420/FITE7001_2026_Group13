import { NextResponse } from 'next/server';
import { getOptionsChain, SUPPORTED_TICKERS } from '@/lib/options/client';
import { getFeatureFlags } from '@/lib/config/features';

export async function GET(request: Request) {
    try {
        const flags = getFeatureFlags();
        if (!flags.labs) {
            return NextResponse.json({ error: 'Options IV endpoint is available only in Labs mode' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const ticker = (searchParams.get('ticker') || 'SPY').toUpperCase();

        if (!SUPPORTED_TICKERS.includes(ticker)) {
            return NextResponse.json(
                { error: `Unsupported ticker: ${ticker}. Supported: ${SUPPORTED_TICKERS.join(', ')}` },
                { status: 400 }
            );
        }

        const chain = await getOptionsChain(ticker);

        return NextResponse.json(chain);
    } catch (error) {
        console.error('Error fetching options chain:', error);
        return NextResponse.json(
            { error: 'Failed to fetch options data' },
            { status: 500 }
        );
    }
}
