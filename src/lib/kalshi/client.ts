// Kalshi API Client

import {
    KalshiMarket,
    KalshiEvent,
    KalshiOrderBook,
    GetMarketsResponse,
    GetMarketResponse,
    GetEventsResponse,
    GetEventResponse,
    GetOrderBookResponse,
    NormalizedMarket,
} from './types';

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

/**
 * Fetch all open markets from Kalshi
 */
export async function fetchKalshiMarkets(params?: {
    limit?: number;
    cursor?: string;
    status?: 'open' | 'closed' | 'settled';
    event_ticker?: string;
    series_ticker?: string;
}): Promise<GetMarketsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.event_ticker) searchParams.set('event_ticker', params.event_ticker);
    if (params?.series_ticker) searchParams.set('series_ticker', params.series_ticker);

    const url = `${KALSHI_API_BASE}/markets?${searchParams.toString()}`;

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Kalshi API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Fetch a single market by ticker
 */
export async function fetchKalshiMarket(ticker: string): Promise<GetMarketResponse> {
    const url = `${KALSHI_API_BASE}/markets/${encodeURIComponent(ticker)}`;

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Kalshi API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Fetch events from Kalshi
 */
export async function fetchKalshiEvents(params?: {
    limit?: number;
    cursor?: string;
    status?: 'open' | 'closed' | 'settled';
    series_ticker?: string;
    with_nested_markets?: boolean;
}): Promise<GetEventsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.series_ticker) searchParams.set('series_ticker', params.series_ticker);
    if (params?.with_nested_markets) searchParams.set('with_nested_markets', 'true');

    const url = `${KALSHI_API_BASE}/events?${searchParams.toString()}`;

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Kalshi API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Fetch a single event by ticker
 */
export async function fetchKalshiEvent(eventTicker: string, withMarkets = true): Promise<GetEventResponse> {
    const searchParams = new URLSearchParams();
    if (withMarkets) {
        searchParams.set('with_nested_markets', 'true');
    }

    const url = `${KALSHI_API_BASE}/events/${encodeURIComponent(eventTicker)}?${searchParams.toString()}`;

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Kalshi API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Fetch orderbook for a market
 */
export async function fetchKalshiOrderBook(ticker: string): Promise<GetOrderBookResponse> {
    const url = `${KALSHI_API_BASE}/markets/${encodeURIComponent(ticker)}/orderbook`;

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Kalshi API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Convert Kalshi price (cents) to normalized price (0-1)
 */
export function normalizeKalshiPrice(priceCents: number): number {
    return priceCents / 100;
}

/**
 * Extract series ticker from event ticker (e.g., "KXBALANCE-29" -> "KXBALANCE")
 * Kalshi URLs use series_ticker, not event_ticker
 */
function extractSeriesTicker(eventTicker: string): string {
    // Remove the suffix (typically a number after the last hyphen)
    // e.g., "KXBALANCE-29" -> "KXBALANCE"
    // e.g., "KXNEWPOPE-70-PPAR" -> "KXNEWPOPE"
    const parts = eventTicker.split('-');
    // If has multiple parts and last part is numeric, remove it
    if (parts.length >= 2) {
        // Check if last part is numeric (like -29, -70)
        const lastPart = parts[parts.length - 1];
        if (/^\d+$/.test(lastPart)) {
            return parts.slice(0, -1).join('-');
        }
        // For tickers like KXNEWPOPE-70-PPAR, take just the first part
        if (parts.length >= 3 && /^\d+$/.test(parts[1])) {
            return parts[0];
        }
    }
    return parts[0]; // Fallback to first part
}

/**
 * Normalize a Kalshi market to our cross-platform format
 */
export function normalizeKalshiMarket(market: KalshiMarket): NormalizedMarket {
    // Kalshi prices are in cents (1-99)
    const yesPrice = normalizeKalshiPrice(market.yes_bid || market.last_price || 50);
    const noPrice = normalizeKalshiPrice(market.no_bid || (100 - (market.last_price || 50)));

    // Build Kalshi URL - use series_ticker for working URLs
    // series_ticker is extracted from event_ticker by removing suffix
    const seriesTicker = extractSeriesTicker(market.event_ticker || market.ticker);
    const kalshiUrl = `https://kalshi.com/markets/${seriesTicker}`;

    return {
        id: market.ticker,
        platform: 'kalshi',
        question: market.title,
        description: market.subtitle,
        category: market.category,
        yesPrice,
        noPrice,
        volume: market.volume / 100, // Convert cents to dollars
        volume24h: market.volume_24h / 100,
        liquidity: market.liquidity / 100,
        status: (market.status === 'open' || market.status === 'active') ? 'active' : market.status === 'settled' ? 'settled' : 'closed',
        endDate: market.expiration_time,
        url: kalshiUrl,
        originalData: market,
    };
}

/**
 * Search Kalshi markets by keyword
 */
export async function searchKalshiMarkets(query: string, limit = 20): Promise<KalshiMarket[]> {
    // Fetch markets and filter by query
    const { markets } = await fetchKalshiMarkets({ limit: 100, status: 'open' });

    const lowerQuery = query.toLowerCase();
    return markets
        .filter(m =>
            m.title?.toLowerCase().includes(lowerQuery) ||
            m.subtitle?.toLowerCase().includes(lowerQuery)
        )
        .slice(0, limit);
}

/**
 * Convert Kalshi orderbook to a format similar to Polymarket
 * Kalshi: yes bid at X = no ask at (100-X)
 */
export function convertKalshiOrderBook(orderbook: KalshiOrderBook): {
    bids: { price: string; size: string }[];
    asks: { price: string; size: string }[];
} {
    // Yes bids become bids
    const bids = orderbook.yes.map(level => ({
        price: (level.price / 100).toFixed(2),
        size: level.quantity.toString(),
    }));

    // No bids at price X become asks at (1 - X/100)
    const asks = orderbook.no.map(level => ({
        price: ((100 - level.price) / 100).toFixed(2),
        size: level.quantity.toString(),
    }));

    return { bids, asks };
}
