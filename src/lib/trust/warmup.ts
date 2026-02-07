import { loadUnifiedMarkets } from './markets';
import { extractResolutionCriteria } from './criteria';
import { matchEvidenceForMarket } from './evidence';
import { computeTrustAnalysis } from './scoring';
import { setCachedAnalysis, setCachedSummary } from './store';
import { TrustSummaryItem } from './types';

const CACHE_TTL_MS = 30_000;

export async function warmupTrustCaches(limit = 50) {
  const markets = await loadUnifiedMarkets({ platform: 'all', limit });
  const summary: TrustSummaryItem[] = [];

  for (const market of markets) {
    const criteria = extractResolutionCriteria(market.question, market.description);
    const evidence = await matchEvidenceForMarket({
      id: market.id,
      platform: market.platform,
      question: market.question,
      category: market.category,
    });

    const analysis = computeTrustAnalysis({ market, criteria, evidence });
    const analysisKey = `trust-market:${market.platform}:${market.id}`;
    setCachedAnalysis(analysisKey, analysis, CACHE_TTL_MS);

    summary.push({
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

  summary.sort((a, b) => b.trustScore - a.trustScore);
  setCachedSummary(`trust-summary:all:${limit}:0`, summary, CACHE_TTL_MS);
  return { warmed: summary.length };
}
