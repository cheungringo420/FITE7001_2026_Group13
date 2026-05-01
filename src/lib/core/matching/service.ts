import { calculateResolutionAlignment, calculateSimilarity } from '@/lib/arbitrage';
import { getMatchFeedbackMap, getMatchKey } from '@/lib/feedback/matchFeedback';
import { extractResolutionCriteria } from '@/lib/trust/criteria';
import { ResolutionAlignmentBreakdown } from '@/lib/trust/types';
import { CORE_POLICY } from '@/lib/core/config';
import { getCanonicalMarketSnapshot } from '@/lib/core/markets/service';
import { CanonicalMarket, MatchResult, MatchScanResult } from '@/lib/core/types';

interface MatchCandidate {
  polymarket: CanonicalMarket;
  kalshi: CanonicalMarket;
  textSimilarity: number;
  categorySimilarity: number;
  resolutionAlignment: number;
  feedbackPenalty: number;
  finalScore: number;
  flagged: boolean;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function categorySimilarity(left?: string, right?: string): number {
  const tokenize = (input?: string) =>
    (input || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token && token !== 'market' && token !== 'markets' && token !== 'general');

  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (!leftTokens.size || !rightTokens.size) return 0.5;

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token));
  const union = new Set([...leftTokens, ...rightTokens]);
  return union.size ? intersection.length / union.size : 0.5;
}

function buildAlignmentBreakdown(
  polymarket: CanonicalMarket,
  kalshi: CanonicalMarket,
): ResolutionAlignmentBreakdown {
  const polyCriteria = extractResolutionCriteria(polymarket.question, polymarket.description);
  const kalshiCriteria = extractResolutionCriteria(kalshi.question, kalshi.description);

  const timeWindowPoly = polyCriteria.timeWindow?.raw;
  const timeWindowKalshi = kalshiCriteria.timeWindow?.raw;

  const ambiguityMatch =
    polyCriteria.ambiguityFlags.length === kalshiCriteria.ambiguityFlags.length &&
    polyCriteria.ambiguityFlags.every((flag) => kalshiCriteria.ambiguityFlags.includes(flag));

  return {
    score: calculateResolutionAlignment(polymarket.question, kalshi.question),
    criteria: {
      explicitDate: {
        polymarket: polyCriteria.hasExplicitDate,
        kalshi: kalshiCriteria.hasExplicitDate,
        match: polyCriteria.hasExplicitDate === kalshiCriteria.hasExplicitDate,
      },
      objectiveThreshold: {
        polymarket: polyCriteria.hasObjectiveThreshold,
        kalshi: kalshiCriteria.hasObjectiveThreshold,
        match: polyCriteria.hasObjectiveThreshold === kalshiCriteria.hasObjectiveThreshold,
      },
      resolutionWording: {
        polymarket: polyCriteria.hasResolutionWording,
        kalshi: kalshiCriteria.hasResolutionWording,
        match: polyCriteria.hasResolutionWording === kalshiCriteria.hasResolutionWording,
      },
      timeWindow: {
        polymarket: timeWindowPoly,
        kalshi: timeWindowKalshi,
        match: (!timeWindowPoly && !timeWindowKalshi) || timeWindowPoly === timeWindowKalshi,
      },
      ambiguityFlags: {
        polymarket: polyCriteria.ambiguityFlags,
        kalshi: kalshiCriteria.ambiguityFlags,
        match: ambiguityMatch,
      },
    },
    clarity: {
      polymarket: polyCriteria.clarityScore,
      kalshi: kalshiCriteria.clarityScore,
    },
  };
}

function confidenceFromScore(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.75) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

async function buildCandidates(
  polymarket: CanonicalMarket[],
  kalshi: CanonicalMarket[],
  strict: boolean,
): Promise<MatchCandidate[]> {
  const feedbackMap = await getMatchFeedbackMap();
  const threshold = strict ? CORE_POLICY.matching.strictThreshold : CORE_POLICY.matching.threshold;
  const minAlignment = strict ? Math.max(0.55, CORE_POLICY.matching.minAlignment) : CORE_POLICY.matching.minAlignment;
  const candidates: MatchCandidate[] = [];

  for (const pm of polymarket) {
    for (const km of kalshi) {
      const textSimilarity = calculateSimilarity(pm.question, km.question);
      if (textSimilarity < CORE_POLICY.matching.minTextSimilarity) continue;

      const resolutionAlignment = calculateResolutionAlignment(pm.question, km.question);
      if (resolutionAlignment < minAlignment) continue;

      const category = categorySimilarity(pm.category, km.category);
      if (category < CORE_POLICY.matching.minCategorySimilarity) continue;

      const feedbackKey = getMatchKey(pm.id, km.id);
      const feedbackEntry = feedbackMap[feedbackKey];
      const mismatchVotes = feedbackEntry?.votes?.mismatch ?? 0;
      const feedbackPenalty = mismatchVotes >= CORE_POLICY.feedback.minVotesToPenalize
        ? CORE_POLICY.feedback.mismatchPenalty
        : 1;

      const weightedScore = clamp(
        (textSimilarity * 0.6 + resolutionAlignment * 0.25 + category * 0.15) * feedbackPenalty,
      );
      if (weightedScore < threshold) continue;

      candidates.push({
        polymarket: pm,
        kalshi: km,
        textSimilarity,
        categorySimilarity: category,
        resolutionAlignment,
        feedbackPenalty,
        finalScore: weightedScore,
        flagged: feedbackPenalty < 1,
      });
    }
  }

  candidates.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (b.resolutionAlignment !== a.resolutionAlignment) return b.resolutionAlignment - a.resolutionAlignment;
    if (a.polymarket.id !== b.polymarket.id) return a.polymarket.id.localeCompare(b.polymarket.id);
    return a.kalshi.id.localeCompare(b.kalshi.id);
  });

  return candidates;
}

export interface DeterministicMatchResult extends MatchScanResult {
  matchedPairs: Array<MatchResult & { alignmentBreakdown: ResolutionAlignmentBreakdown }>;
}

export async function scanMatches(options?: {
  strict?: boolean;
  forceRefresh?: boolean;
}): Promise<DeterministicMatchResult> {
  const strict = options?.strict === true;
  const snapshot = await getCanonicalMarketSnapshot();
  const polymarket = snapshot.markets.filter((market) => market.platform === 'polymarket');
  const kalshi = snapshot.markets.filter((market) => market.platform === 'kalshi');

  const candidates = await buildCandidates(polymarket, kalshi, strict);
  const usedPolymarketIds = new Set<string>();
  const usedKalshiIds = new Set<string>();
  const matchedPairs: Array<MatchResult & { alignmentBreakdown: ResolutionAlignmentBreakdown }> = [];

  for (const candidate of candidates) {
    if (usedPolymarketIds.has(candidate.polymarket.id) || usedKalshiIds.has(candidate.kalshi.id)) continue;

    usedPolymarketIds.add(candidate.polymarket.id);
    usedKalshiIds.add(candidate.kalshi.id);

    matchedPairs.push({
      id: `${candidate.polymarket.id}-${candidate.kalshi.id}`,
      snapshotVersion: snapshot.snapshotVersion,
      polymarket: candidate.polymarket,
      kalshi: candidate.kalshi,
      similarity: candidate.finalScore,
      confidence: confidenceFromScore(candidate.finalScore),
      scoreBreakdown: {
        textSimilarity: candidate.textSimilarity,
        categorySimilarity: candidate.categorySimilarity,
        resolutionAlignment: candidate.resolutionAlignment,
        feedbackPenalty: candidate.feedbackPenalty,
        finalScore: candidate.finalScore,
      },
      flagged: candidate.flagged,
      alignmentBreakdown: buildAlignmentBreakdown(candidate.polymarket, candidate.kalshi),
    });
  }

  const unmatchedPolymarket = polymarket.filter((market) => !usedPolymarketIds.has(market.id));
  const unmatchedKalshi = kalshi.filter((market) => !usedKalshiIds.has(market.id));

  return {
    snapshotVersion: snapshot.snapshotVersion,
    fetchedAt: new Date().toISOString(),
    matchingMethod: 'deterministic',
    matchedPairs,
    unmatchedPolymarket,
    unmatchedKalshi,
    polymarketCount: polymarket.length,
    kalshiCount: kalshi.length,
  };
}
