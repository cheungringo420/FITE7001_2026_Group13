/**
 * Shared core domain types.
 */

import { NormalizedMarket } from '@/lib/kalshi/types';

/** Alias for NormalizedMarket used in core matching contexts. */
export type CanonicalMarket = NormalizedMarket;

export interface MatchResult {
  id: string;
  snapshotVersion: string;
  polymarket: CanonicalMarket;
  kalshi: CanonicalMarket;
  similarity: number;
  confidence: string;
  scoreBreakdown: {
    textSimilarity: number;
    categorySimilarity: number;
    resolutionAlignment: number;
    feedbackPenalty: number;
    finalScore: number;
  };
  flagged: boolean;
}

export interface MatchScanResult {
  snapshotVersion: string;
  fetchedAt: string;
  matchingMethod: string;
  matchedPairs: MatchResult[];
  unmatchedPolymarket: CanonicalMarket[];
  unmatchedKalshi: CanonicalMarket[];
  polymarketCount: number;
  kalshiCount: number;
}

export interface MatchFeedbackEvent {
  id: string;
  polymarketId: string;
  kalshiId: string;
  status: 'match' | 'mismatch';
  votes: {
    match: number;
    mismatch: number;
  };
  reason?: string;
  createdAt: string;
  updatedAt: string;
}
