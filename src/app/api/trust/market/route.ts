import { NextResponse } from 'next/server';
import { loadUnifiedMarkets } from '@/lib/trust/markets';
import { extractResolutionCriteria } from '@/lib/trust/criteria';
import { matchEvidenceForMarket } from '@/lib/trust/evidence';
import { computeTrustAnalysis } from '@/lib/trust/scoring';
import { getCachedAnalysis, setCachedAnalysis } from '@/lib/trust/store';

const CACHE_TTL_MS = 30_000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');
  const marketId = searchParams.get('id');

  if (!platform || !marketId) {
    return NextResponse.json({ error: 'platform and id are required' }, { status: 400 });
  }

  if (platform !== 'polymarket' && platform !== 'kalshi') {
    return NextResponse.json({ error: 'invalid platform' }, { status: 400 });
  }

  const cacheKey = `trust-market:${platform}:${marketId}`;
  const cached = getCachedAnalysis(cacheKey);
  if (cached) {
    return NextResponse.json({ analysis: cached, cached: true });
  }

  try {
    const markets = await loadUnifiedMarkets({ platform, limit: 200 });
    const market = markets.find((m) => m.id === marketId);

    if (!market) {
      return NextResponse.json({ error: 'market not found' }, { status: 404 });
    }

    const criteria = extractResolutionCriteria(market.question, market.description);
    const evidence = await matchEvidenceForMarket({
      id: market.id,
      platform: market.platform,
      question: market.question,
      category: market.category,
    });

    const analysis = computeTrustAnalysis({ market, criteria, evidence });
    setCachedAnalysis(cacheKey, analysis, CACHE_TTL_MS);

    return NextResponse.json({
      market: {
        id: market.id,
        platform: market.platform,
        question: market.question,
        description: market.description,
        category: market.category,
        url: market.url,
        yesPrice: market.yesPrice,
        noPrice: market.noPrice,
      },
      analysis,
      cached: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to compute trust analysis';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
