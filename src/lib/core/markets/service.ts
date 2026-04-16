/**
 * Canonical market snapshot service.
 * Returns a unified view of all normalised markets from the in-memory realtime cache.
 */

import { getMarketSnapshot } from '@/lib/realtime/market-stream';
import { NormalizedMarket } from '@/lib/kalshi/types';
import { normalizePolymarketMarket } from '@/lib/arbitrage/engine';
import { parseMarket } from '@/lib/polymarket/client';

export interface CanonicalMarketSnapshot {
  markets: NormalizedMarket[];
  updatedAt: string;
  snapshotVersion: string;
}

export async function getCanonicalMarketSnapshot(): Promise<CanonicalMarketSnapshot> {
  const snapshot = getMarketSnapshot();

  const polyMarkets: NormalizedMarket[] = (snapshot.polymarket ?? []).map((m) =>
    normalizePolymarketMarket(parseMarket(m)),
  );

  const kalshiMarkets: NormalizedMarket[] = snapshot.kalshi ?? [];

  return {
    markets: [...polyMarkets, ...kalshiMarkets],
    updatedAt: snapshot.updatedAt,
    snapshotVersion: snapshot.updatedAt,
  };
}
