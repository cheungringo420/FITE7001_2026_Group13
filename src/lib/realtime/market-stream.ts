import { Market } from '@/lib/polymarket/types';
import { NormalizedMarket } from '@/lib/kalshi/types';

export interface MarketSnapshot {
  polymarket?: Market[];
  kalshi?: NormalizedMarket[];
  updatedAt: string;
  sources: {
    polymarket?: string;
    kalshi?: string;
  };
}

type SnapshotListener = (snapshot: MarketSnapshot) => void;

let snapshot: MarketSnapshot = {
  updatedAt: new Date(0).toISOString(),
  sources: {},
};

const listeners = new Set<SnapshotListener>();

function notify() {
  listeners.forEach((listener) => listener(snapshot));
}

export function updatePolymarketSnapshot(markets: Market[]) {
  snapshot = {
    ...snapshot,
    polymarket: markets,
    updatedAt: new Date().toISOString(),
    sources: {
      ...snapshot.sources,
      polymarket: new Date().toISOString(),
    },
  };
  notify();
}

export function updateKalshiSnapshot(markets: NormalizedMarket[]) {
  snapshot = {
    ...snapshot,
    kalshi: markets,
    updatedAt: new Date().toISOString(),
    sources: {
      ...snapshot.sources,
      kalshi: new Date().toISOString(),
    },
  };
  notify();
}

export function getMarketSnapshot(): MarketSnapshot {
  return snapshot;
}

export function subscribeToMarketSnapshots(listener: SnapshotListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
