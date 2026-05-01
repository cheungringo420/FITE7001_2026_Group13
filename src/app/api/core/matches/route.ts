import { NextResponse } from 'next/server';
import { scanMatches } from '@/lib/core/matching/service';
import { detectArbitrage } from '@/lib/arbitrage';
import { CORE_POLICY } from '@/lib/core/config';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const strict = searchParams.get('strict') === 'true';
    const forceRefresh = searchParams.get('refresh') === 'true';
    const result = await scanMatches({ strict, forceRefresh });
    const gate = strict ? CORE_POLICY.opportunities.strictMinSimilarity : CORE_POLICY.opportunities.minSimilarity;

    return NextResponse.json({
      ...result,
      matchedPairs: result.matchedPairs.map((pair) => ({
        ...pair,
        arbitrage: pair.similarity >= gate ? detectArbitrage(pair.polymarket, pair.kalshi) : null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to compute deterministic matches';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
