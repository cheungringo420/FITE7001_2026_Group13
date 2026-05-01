import { EvidenceItemScored, ResolutionCriteria, TrustAnalysis } from './types';
import { NormalizedMarket } from '../kalshi/types';

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

const STANCE_WEIGHT: Record<EvidenceItemScored['stance'], number> = {
  support: 1,
  contradict: -1,
  neutral: 0,
};

export function computeEvidenceConsensus(evidence: EvidenceItemScored[]): {
  consensusScore: number;
  conflictScore: number;
} {
  if (evidence.length === 0) {
    return { consensusScore: 0.5, conflictScore: 1 };
  }

  const totalWeight = evidence.reduce((sum, item) => sum + item.weight, 0);
  const weightedSum = evidence.reduce((sum, item) => {
    return sum + item.weight * STANCE_WEIGHT[item.stance] * item.similarity;
  }, 0);

  const consensusScore = totalWeight === 0
    ? 0.5
    : clamp(0.5 + weightedSum / (2 * totalWeight));

  const conflictScore = clamp(1 - Math.abs(consensusScore - 0.5) * 2);

  return { consensusScore, conflictScore };
}

export function computeIntegrityRisk(market: NormalizedMarket): number {
  let risk = 0.2;

  if (market.liquidity) {
    if (market.liquidity < 500) risk += 0.2;
    else if (market.liquidity < 2000) risk += 0.1;
  }

  if (market.volume24h !== undefined) {
    if (market.volume24h < 1000) risk += 0.2;
    else if (market.volume24h < 5000) risk += 0.1;
  }

  const sum = market.yesPrice + market.noPrice;
  if (sum < 0.95 || sum > 1.05) {
    risk += 0.2;
  }

  return clamp(risk);
}

export function computeTrustAnalysis(params: {
  market: NormalizedMarket;
  criteria: ResolutionCriteria;
  evidence: EvidenceItemScored[];
  agreementScore?: number;
}): TrustAnalysis {
  const { market, criteria, evidence, agreementScore = 0.5 } = params;

  const { consensusScore, conflictScore } = computeEvidenceConsensus(evidence);
  const integrityRisk = computeIntegrityRisk(market);

  // Resolution Confidence Score — three-dimension weighted composite.
  // Weights chosen so that ambiguous criteria (40%) dominate, oracle-risk
  // proxied by evidence consensus (35%) is heavy, and historical dispute
  // likelihood (25%) is material rather than tail.
  const resolutionConfidence = 100 * (
    0.40 * criteria.clarityScore +
    0.35 * consensusScore +
    0.25 * (1 - integrityRisk)
  );

  // Trust score is the headline number surfaced to users; we keep
  // agreementScore as a small overlay (matches with independent feedback)
  // without letting it dominate the resolution-confidence semantics.
  const trustScore = 100 * (
    0.40 * criteria.clarityScore +
    0.35 * consensusScore +
    0.25 * (1 - integrityRisk) * (0.5 + 0.5 * agreementScore)
  );

  const disputeRisk = 100 * (0.5 * (1 - criteria.clarityScore) + 0.5 * conflictScore);

  return {
    trustScore: Math.round(trustScore),
    resolutionConfidence: Math.round(resolutionConfidence),
    disputeRisk: Math.round(disputeRisk),
    integrityRisk: Math.round(integrityRisk * 100),
    evidenceCount: evidence.length,
    criteria,
    evidence,
    consensusScore,
    agreementScore,
  };
}
