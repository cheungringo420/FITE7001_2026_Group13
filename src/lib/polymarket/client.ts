// Polymarket REST API Client

import { Market, OrderBook, ParsedMarket } from './types';

const CLOB_API_BASE = 'https://clob.polymarket.com';
const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

/**
 * Parse a market's JSON string fields into typed arrays
 */
export function parseMarket(market: Market): ParsedMarket {
    return {
        ...market,
        outcomes: JSON.parse(market.outcomes || '[]'),
        outcomePrices: JSON.parse(market.outcomePrices || '[]').map(Number),
        clobTokenIds: JSON.parse(market.clobTokenIds || '[]'),
    };
}

/**
 * Fetch markets from the Gamma API
 */
export async function fetchMarkets(params?: {
    limit?: number;
    offset?: number;
    order?: string;
    ascending?: boolean;
    active?: boolean;
    closed?: boolean;
}): Promise<Market[]> {
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.order) searchParams.set('order', params.order);
    if (params?.ascending !== undefined) searchParams.set('ascending', params.ascending.toString());
    if (params?.active !== undefined) searchParams.set('active', params.active.toString());
    if (params?.closed !== undefined) searchParams.set('closed', params.closed.toString());

    // Only fetch markets with orderbook enabled
    searchParams.set('enableOrderBook', 'true');

    const url = `${GAMMA_API_BASE}/markets?${searchParams.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch markets: ${response.status}`);
    }

    return response.json();
}

/**
 * Fetch a single market by slug
 */
export async function fetchMarketBySlug(slug: string): Promise<Market | null> {
    const url = `${GAMMA_API_BASE}/markets?slug=${encodeURIComponent(slug)}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch market: ${response.status}`);
    }

    const markets: Market[] = await response.json();
    return markets.length > 0 ? markets[0] : null;
}

/**
 * Fetch a single market by condition ID
 */
export async function fetchMarketByConditionId(conditionId: string): Promise<Market | null> {
    const url = `${GAMMA_API_BASE}/markets?condition_ids=${encodeURIComponent(conditionId)}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch market: ${response.status}`);
    }

    const markets: Market[] = await response.json();
    return markets.length > 0 ? markets[0] : null;
}

/**
 * Search markets by query string
 */
export async function searchMarkets(query: string, limit: number = 20): Promise<Market[]> {
    // The Gamma API doesn't have a direct search endpoint,
    // so we fetch markets and filter client-side
    // In production, you might use a search service
    const markets = await fetchMarkets({ limit: 100, active: true });

    const lowerQuery = query.toLowerCase();
    return markets
        .filter(m =>
            m.question?.toLowerCase().includes(lowerQuery) ||
            m.description?.toLowerCase().includes(lowerQuery)
        )
        .slice(0, limit);
}

/**
 * Fetch order book for a specific token ID from the CLOB API
 */
export async function fetchOrderBook(tokenId: string): Promise<OrderBook> {
    const url = `${CLOB_API_BASE}/book?token_id=${encodeURIComponent(tokenId)}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch order book: ${response.status}`);
    }

    return response.json();
}

/**
 * Fetch multiple order books at once
 */
export async function fetchOrderBooks(tokenIds: string[]): Promise<OrderBook[]> {
    return Promise.all(tokenIds.map(fetchOrderBook));
}

/**
 * Get the midpoint price for a token
 */
export async function fetchMidpointPrice(tokenId: string): Promise<number> {
    const url = `${CLOB_API_BASE}/midpoint?token_id=${encodeURIComponent(tokenId)}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch midpoint: ${response.status}`);
    }

    const data = await response.json();
    return parseFloat(data.mid);
}

/**
 * Get the best bid/ask price for a token
 */
export async function fetchPrice(tokenId: string, side: 'BUY' | 'SELL'): Promise<number> {
    const url = `${CLOB_API_BASE}/price?token_id=${encodeURIComponent(tokenId)}&side=${side}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch price: ${response.status}`);
    }

    const data = await response.json();
    return parseFloat(data.price);
}

/**
 * Calculate potential payout for a trade
 */
export function calculatePayout(amount: number, price: number): { shares: number; potentialPayout: number } {
    const shares = amount / price;
    const potentialPayout = shares; // Each share pays $1 if correct
    return { shares, potentialPayout };
}
