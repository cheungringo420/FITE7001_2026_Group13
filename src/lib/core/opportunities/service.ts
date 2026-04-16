/**
 * Opportunities service — wraps the core arbitrage detection engine.
 * Fetches live market data, normalises it, runs the matching + detection pass,
 * and returns a structured scan result.
 */

import {
  findMatchingMarkets,
  scanForArbitrage,
  normalizePolymarketMarket,
} from '@/lib/arbitrage/engine';
import { fetchKalshiMarkets, normalizeKalshiMarket } from '@/lib/kalshi/client';
import { parseMarket } from '@/lib/polymarket/client';
import { NormalizedMarket, ArbitrageOpportunity } from '@/lib/kalshi/types';
import { getCacheClient } from '@/lib/cache';

const SCAN_CACHE_TTL_MS = 15_000;
const SCAN_CACHE_KEY = 'core:opportunities:scan';

export interface OpportunityScanResult {
  opportunities: Array<ArbitrageOpportunity & { confidence?: 'high' | 'medium' | 'low' }>;
  matchedMarkets: number;
  polymarketCount: number;
  kalshiCount: number;
  scannedAt: string;
  snapshotVersion?: string;
}

function toConfidence(
  opp: ArbitrageOpportunity,
): 'high' | 'medium' | 'low' {
  if (opp.profitPercentage >= 3) return 'high';
  if (opp.profitPercentage >= 1) return 'medium';
  return 'low';
}

export async function scanOpportunities(opts?: {
  strict?: boolean;
}): Promise<OpportunityScanResult> {
  const cache = getCacheClient();
  const cacheKey = `${SCAN_CACHE_KEY}:${opts?.strict ? 'strict' : 'loose'}`;

  const cached = await cache.get<OpportunityScanResult>(cacheKey);
  if (cached) return cached;

  // Fetch polymarket markets from Gamma API
  const polyRes = await fetch(
    'https://gamma-api.polymarket.com/markets?limit=100&active=true&closed=false&order=volume24hr&ascending=false',
    { headers: { Accept: 'application/json' }, next: { revalidate: 15 } },
  );

  let polyMarkets: NormalizedMarket[] = [];
  if (polyRes.ok) {
    const raw = await polyRes.json() as Record<string, unknown>[];
    polyMarkets = raw
      .filter((m) => m.active && !m.closed)
      .map((m) => normalizePolymarketMarket(parseMarket(m as unknown as Parameters<typeof parseMarket>[0])));
  }

  // Fetch Kalshi markets
  const kalshiData = await fetchKalshiMarkets({ limit: 100, status: 'open' });
  const kalshiMarkets: NormalizedMarket[] = kalshiData.markets.map(normalizeKalshiMarket);

  // Match and detect
  const matches = findMatchingMarkets(polyMarkets, kalshiMarkets, 0.25, {
    strict: opts?.strict,
  });

  const rawOpportunities = scanForArbitrage(matches);
  const opportunities = rawOpportunities.map((opp) => ({
    ...opp,
    confidence: toConfidence(opp),
  }));

  const result: OpportunityScanResult = {
    opportunities,
    matchedMarkets: matches.length,
    polymarketCount: polyMarkets.length,
    kalshiCount: kalshiMarkets.length,
    scannedAt: new Date().toISOString(),
    snapshotVersion: `${Date.now()}`,
  };

  await cache.set(cacheKey, result, SCAN_CACHE_TTL_MS);
  return result;
}
