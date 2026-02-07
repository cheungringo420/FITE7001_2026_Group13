import { getMarketSnapshot } from '../realtime/market-stream';
import { parseMarket } from '../polymarket';
import { normalizePolymarketMarket } from '../arbitrage';
import { fetchAndNormalizeKalshiMarkets } from '../kalshi';
import { NormalizedMarket } from '../kalshi/types';
import { Market } from '../polymarket/types';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

export interface LoadMarketsOptions {
  platform?: 'polymarket' | 'kalshi' | 'all';
  limit?: number;
}

async function fetchPolymarketMarkets(limit: number): Promise<Market[]> {
  const url = `${GAMMA_API_BASE}/markets?limit=${limit}&active=true&closed=false&enableOrderBook=true`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Polymarket API error: ${response.status}`);
  }
  return response.json();
}

export async function loadUnifiedMarkets(options: LoadMarketsOptions = {}): Promise<NormalizedMarket[]> {
  const platform = options.platform ?? 'all';
  const limit = options.limit ?? 100;

  const snapshot = getMarketSnapshot();
  const results: NormalizedMarket[] = [];

  if (platform === 'all' || platform === 'polymarket') {
    let polymarket: Market[] = [];
    if (snapshot.polymarket?.length) {
      polymarket = snapshot.polymarket as Market[];
    } else {
      polymarket = await fetchPolymarketMarkets(limit);
    }

    const normalized = polymarket
      .map((m) => {
        try {
          return normalizePolymarketMarket(parseMarket(m));
        } catch {
          return null;
        }
      })
      .filter((m): m is NormalizedMarket => Boolean(m));

    results.push(...normalized.slice(0, limit));
  }

  if (platform === 'all' || platform === 'kalshi') {
    let kalshi: NormalizedMarket[] = [];
    if (snapshot.kalshi?.length) {
      kalshi = snapshot.kalshi as NormalizedMarket[];
    } else {
      kalshi = await fetchAndNormalizeKalshiMarkets(limit);
    }

    results.push(...kalshi.slice(0, limit));
  }

  return results;
}
