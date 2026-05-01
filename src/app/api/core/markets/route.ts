import { NextResponse } from 'next/server';
import { getCanonicalMarketSnapshot } from '@/lib/core/markets/service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const snapshot = await getCanonicalMarketSnapshot();

    return NextResponse.json({
      snapshotVersion: snapshot.snapshotVersion,
      fetchedAt: snapshot.updatedAt,
      markets: snapshot.markets,
      count: snapshot.markets.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch canonical markets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
