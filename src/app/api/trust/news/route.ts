import { NextResponse } from 'next/server';
import { fetchNewsEvidence, getNewsSources } from '@/lib/trust/news';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || '';

        if (!query) {
            return NextResponse.json(
                { error: 'Missing query parameter "q"' },
                { status: 400 }
            );
        }

        const evidence = await fetchNewsEvidence(query);
        const sources = getNewsSources();

        return NextResponse.json({
            query,
            evidence,
            sources,
            count: evidence.length,
            fetchedAt: new Date().toISOString(),
            hasApiKey: Boolean(process.env.GNEWS_API_KEY),
        });
    } catch (error) {
        console.error('News evidence fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch news evidence' },
            { status: 500 }
        );
    }
}
