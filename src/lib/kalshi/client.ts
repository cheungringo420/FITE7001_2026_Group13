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
        cache: 'no-store',
        next: { revalidate: 0 },
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
        cache: 'no-store',
        next: { revalidate: 0 },
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
        cache: 'no-store',
        next: { revalidate: 0 },
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
        cache: 'no-store',
        next: { revalidate: 0 },
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
        cache: 'no-store',
        next: { revalidate: 0 },
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
    const pickPrice = (values: Array<number | undefined>, fallback: number) => {
        for (const value of values) {
            if (typeof value === 'number' && value > 0 && value < 100) {
                return value;
            }
        }
        return fallback;
    };

    // Use ASK prices for buy-side arbitrage accuracy (fallback to bid/last)
    const yesCents = pickPrice([market.yes_ask, market.yes_bid, market.last_price], 50);
    const noCents = pickPrice(
        [market.no_ask, market.no_bid, market.last_price ? (100 - market.last_price) : undefined],
        50
    );

    const yesPrice = normalizeKalshiPrice(yesCents);
    const noPrice = normalizeKalshiPrice(noCents);

    // Build Kalshi URL - use series_ticker for working URLs
    // series_ticker is extracted from event_ticker by removing suffix
    const seriesTicker = extractSeriesTicker(market.event_ticker || market.ticker);
    const kalshiUrl = `https://kalshi.com/markets/${seriesTicker}`;

    return {
        id: market.ticker,
        platform: 'kalshi',
        // Clean title: "yes Seattle" -> "Seattle"
        question: market.title.replace(/^(yes|no)\s+/i, ''),
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

/**
 * Robustly fetch and normalize Kalshi markets
 * Fetches from multiple endpoints and strictly filters out invalid/sports markets
 */
export async function fetchAndNormalizeKalshiMarkets(limit = 100): Promise<NormalizedMarket[]> {
    try {
        const allMarkets: KalshiMarket[] = [];
        const seenTickers = new Set<string>();

        const addMarkets = (markets: KalshiMarket[]) => {
            for (const m of markets) {
                if (m.ticker && !seenTickers.has(m.ticker)) {
                    seenTickers.add(m.ticker);
                    allMarkets.push(m);
                }
            }
        };

        const fetchMarketsPaged = async (status?: string, maxItems = 2000) => {
            let cursor: string | undefined;
            let fetched = 0;
            const pageLimit = 1000;

            while (fetched < maxItems) {
                const params = new URLSearchParams();
                params.set('limit', pageLimit.toString());
                if (status) params.set('status', status);
                if (cursor) params.set('cursor', cursor);

                const res = await fetch(`${KALSHI_API_BASE}/markets?${params.toString()}`, {
                    headers: { 'Accept': 'application/json' },
                    next: { revalidate: 30 },
                });

                if (!res.ok) break;
                const data = await res.json();
                const markets = data.markets || [];
                addMarkets(markets);
                fetched += markets.length;
                cursor = data.cursor;
                if (!cursor || markets.length === 0) break;
            }
        };

        const fetchEventsPaged = async (maxItems = 2000) => {
            let cursor: string | undefined;
            let fetched = 0;
            const pageLimit = 500;

            while (fetched < maxItems) {
                const params = new URLSearchParams();
                params.set('limit', pageLimit.toString());
                params.set('with_nested_markets', 'true');
                if (cursor) params.set('cursor', cursor);

                const res = await fetch(`${KALSHI_API_BASE}/events?${params.toString()}`, {
                    headers: { 'Accept': 'application/json' },
                    next: { revalidate: 30 },
                });

                if (!res.ok) break;
                const data = await res.json();
                const events: KalshiEvent[] = data.events || [];
                for (const event of events) {
                    if (event.markets) {
                        addMarkets(event.markets);
                        fetched += event.markets.length;
                    }
                }
                cursor = data.cursor;
                if (!cursor || events.length === 0) break;
            }
        };

        // Fetch from multiple endpoints and paginate
        await Promise.all([
            fetchMarketsPaged(), // no status filter
            fetchMarketsPaged('active'),
            fetchMarketsPaged('open'),
            fetchEventsPaged(),
        ]);

        const fallbackFromEvents = async () => {
            try {
                const res = await fetch(`${KALSHI_API_BASE}/events?limit=200&with_nested_markets=true`, {
                    headers: { 'Accept': 'application/json' },
                    next: { revalidate: 30 },
                });
                if (!res.ok) return [];
                const data = await res.json();
                const events: KalshiEvent[] = data.events || [];
                const markets: KalshiMarket[] = [];
                for (const event of events) {
                    if (event.markets) {
                        markets.push(...event.markets);
                    }
                }
                return markets;
            } catch {
                return [];
            }
        };

        if (allMarkets.length === 0) {
            console.log('Kalshi API: No markets found from paged endpoints, using fallback events fetch');
            const fallbackMarkets = await fallbackFromEvents();
            if (fallbackMarkets.length === 0) return [];
            fallbackMarkets.forEach(m => addMarkets([m]));
        }

        // Filter out invalid/parlay markets while keeping valid sports + finance questions
        const normalizeList = (markets: KalshiMarket[]) =>
            markets
                .map(m => {
                    try {
                        return normalizeKalshiMarket(m);
                    } catch (e) {
                        console.error(`Failed to normalize market ${m.ticker}:`, e);
                        return null;
                    }
                })
                .filter((m): m is NormalizedMarket => m !== null && m.yesPrice > 0)
                .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
                .slice(0, limit);

        const primaryFiltered = allMarkets.filter(m => {
            const title = m.title?.toLowerCase() || '';
            if (!title || title.length < 10) return false;

            const isSportsStats = /\d+\+|wins by over|points scored|rebounds|assists|touchdown|strikeouts|home runs|passing yards/i.test(title);
            // Only filter as parlay if it contains comma-separated yes/no which indicates spread/parlay
            const isParlay = /,(yes|no)\s+/i.test(title);
            const isPlayerBet = /^(yes|no)\s+[A-Z][a-z]+\s+[A-Z]/i.test(m.title || '');

            const isActive = m.status === 'open' || m.status === 'active';

            // Relaxed filter: Just ensure it's active and not spammy sports props
            return isActive && !isSportsStats && !isParlay && !isPlayerBet;
        });

        let normalizedMarkets = normalizeList(primaryFiltered);

        // Fallback: if too strict, relax to show valid markets (still avoid parlays/stats)
        if (normalizedMarkets.length === 0) {
            const relaxedFiltered = allMarkets.filter(m => {
                const title = m.title?.toLowerCase() || '';
                if (!title || title.length < 6) return false;

                const isSportsStats = /\d+\+|wins by over|points scored|rebounds|assists|touchdown|strikeouts|home runs|passing yards/i.test(title);
                const isParlay = /^(yes|no)\s+/i.test(title) || /,(yes|no)\s+/i.test(title);
                const isActive = m.status === 'open' || m.status === 'active';

                return isActive && !isSportsStats && !isParlay;
            });
            normalizedMarkets = normalizeList(relaxedFiltered);
        }

        if (normalizedMarkets.length === 0) {
            const fallbackMarkets = await fallbackFromEvents();
            if (fallbackMarkets.length > 0) {
                const relaxedFiltered = fallbackMarkets.filter(m => {
                    const title = m.title?.toLowerCase() || '';
                    if (!title || title.length < 6) return false;
                    const isSportsStats = /\d+\+|wins by over|points scored|rebounds|assists|touchdown|strikeouts|home runs|passing yards/i.test(title);
                    const isParlay = /^(yes|no)\s+/i.test(title) || /,(yes|no)\s+/i.test(title);
                    const isActive = m.status === 'open' || m.status === 'active';
                    return isActive && !isSportsStats && !isParlay;
                });
                normalizedMarkets = normalizeList(relaxedFiltered);
            }
        }

        return normalizedMarkets;
    } catch (error) {
        console.error('Error fetching Kalshi markets:', error);
        return [];
    }
}
