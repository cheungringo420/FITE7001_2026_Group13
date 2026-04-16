import { NextResponse } from 'next/server';
import { createExecutionQuote } from '@/lib/execution/service';
import { ExecutionLeg, ExecutionLegTrust, ExecutionTrustSnapshot } from '@/lib/execution/types';
import { getCanonicalMarketSnapshot } from '@/lib/core/markets/service';
import { extractResolutionCriteria } from '@/lib/trust/criteria';
import { matchEvidenceForMarket } from '@/lib/trust/evidence';
import { computeTrustAnalysis } from '@/lib/trust/scoring';

async function buildTrustSnapshot(legs: ExecutionLeg[]): Promise<ExecutionTrustSnapshot | undefined> {
  const snapshot = await getCanonicalMarketSnapshot();
  const marketMap = new Map(
    snapshot.markets.map((market) => [`${market.platform}:${market.id}`, market] as const),
  );

  const trustLegs: ExecutionLegTrust[] = [];

  for (const leg of legs) {
    const market = marketMap.get(`${leg.platform}:${leg.marketId}`);
    if (!market) continue;

    const criteria = extractResolutionCriteria(market.question, market.description);
    const evidence = await matchEvidenceForMarket({
      id: market.id,
      platform: market.platform,
      question: market.question,
      category: market.category,
    });

    const analysis = computeTrustAnalysis({ market, criteria, evidence });
    trustLegs.push({
      platform: leg.platform,
      marketId: leg.marketId,
      trustScore: analysis.trustScore,
      resolutionConfidence: analysis.resolutionConfidence,
      disputeRisk: analysis.disputeRisk,
      integrityRisk: analysis.integrityRisk,
      evidenceCount: analysis.evidenceCount,
    });
  }

  if (trustLegs.length === 0) return undefined;

  return {
    snapshotVersion: snapshot.snapshotVersion,
    evaluatedAt: new Date().toISOString(),
    legs: trustLegs,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const legs = (body.legs || []) as ExecutionLeg[];
    const maxNotional = Number(body.maxNotional || 0);
    const ttlMs = body.ttlMs ? Number(body.ttlMs) : undefined;
    const marketMatchKey = body.marketMatchKey ? String(body.marketMatchKey) : undefined;
    const allowHeuristic = body.allowHeuristic === true;

    if (!legs.length || !Number.isFinite(maxNotional) || maxNotional <= 0) {
      return NextResponse.json({ error: 'Invalid quote request' }, { status: 400 });
    }

    const trustSnapshot = await buildTrustSnapshot(legs);
    const quote = createExecutionQuote({ legs, maxNotional, ttlMs, marketMatchKey, allowHeuristic, trustSnapshot });
    return NextResponse.json(quote);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create quote';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
