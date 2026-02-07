import { NextResponse } from 'next/server';
import { loadUnifiedMarkets } from '@/lib/trust/markets';
import { extractResolutionCriteria } from '@/lib/trust/criteria';
import { matchEvidenceForMarket } from '@/lib/trust/evidence';
import { computeTrustAnalysis } from '@/lib/trust/scoring';
import { getCachedSummary, setCachedSummary } from '@/lib/trust/store';
import { TrustSummaryItem } from '@/lib/trust/types';

const CACHE_TTL_MS = 30_000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platformParam = searchParams.get('platform') || 'all';
  const limitParam = Number(searchParams.get('limit') || '100');
  const minTrustParam = Number(searchParams.get('minTrust') || '0');

  const platform = platformParam === 'polymarket' || platformParam === 'kalshi'
    ? platformParam
    : 'all';
  const limit = Number.isFinite(limitParam) ? Math.max(1, limitParam) : 100;
  const minTrust = Number.isFinite(minTrustParam) ? minTrustParam : 0;

  const cacheKey = `trust-summary:${platform}:${limit}:${minTrust}`;
  const cached = getCachedSummary(cacheKey);
  if (cached) {
    return NextResponse.json({ items: cached, cached: true, updatedAt: new Date().toISOString() });
  }

  try {
    const markets = await loadUnifiedMarkets({ platform, limit });
    const items: TrustSummaryItem[] = [];

    for (const market of markets) {
      const criteria = extractResolutionCriteria(market.question, market.description);
      const evidence = await matchEvidenceForMarket({
        id: market.id,
        platform: market.platform,
        question: market.question,
        category: market.category,
      });

      const analysis = computeTrustAnalysis({ market, criteria, evidence });

      if (analysis.trustScore < minTrust) continue;

      items.push({
        marketId: market.id,
        platform: market.platform,
        question: market.question,
        category: market.category,
        trustScore: analysis.trustScore,
        resolutionConfidence: analysis.resolutionConfidence,
        disputeRisk: analysis.disputeRisk,
        integrityRisk: analysis.integrityRisk,
        evidenceCount: analysis.evidenceCount,
        updatedAt: new Date().toISOString(),
      });
    }

    items.sort((a, b) => b.trustScore - a.trustScore);
    setCachedSummary(cacheKey, items, CACHE_TTL_MS);
    return NextResponse.json({ items, cached: false, updatedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to compute trust summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
