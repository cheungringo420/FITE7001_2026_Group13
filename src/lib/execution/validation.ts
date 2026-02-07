import { ExecutionLeg } from './types';

export interface MatchResult {
  marketMatch: 'strict' | 'heuristic';
  matchStatus: 'ok' | 'blocked';
  reasons: string[];
}

export function evaluateMarketMatch(
  legs: ExecutionLeg[],
  options?: { marketMatchKey?: string; allowHeuristic?: boolean }
): MatchResult {
  const reasons: string[] = [];
  let marketMatch: 'strict' | 'heuristic' = 'heuristic';
  let matchStatus: 'ok' | 'blocked' = 'ok';

  const platforms = new Set(legs.map((leg) => leg.platform));
  const isCrossPlatform = platforms.size > 1;

  if (isCrossPlatform) {
    if (options?.marketMatchKey) {
      marketMatch = 'strict';
    } else {
      marketMatch = 'heuristic';
      if (!options?.allowHeuristic) {
        matchStatus = 'blocked';
        reasons.push('Cross-platform execution requires marketMatchKey');
      } else {
        reasons.push('Cross-platform execution using heuristic match');
      }
    }
  }

  if (legs.some((leg) => !Number.isFinite(leg.limitPrice) || leg.limitPrice <= 0 || leg.limitPrice > 1)) {
    matchStatus = 'blocked';
    reasons.push('Limit price must be between 0 and 1');
  }

  if (legs.some((leg) => !Number.isFinite(leg.size) || leg.size <= 0)) {
    matchStatus = 'blocked';
    reasons.push('Size must be positive');
  }

  return { marketMatch, matchStatus, reasons };
}
