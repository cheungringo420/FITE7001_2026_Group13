// Kalshi API Types

export interface KalshiMarket {
    ticker: string;
    event_ticker: string;
    market_type: string;
    title: string;
    subtitle: string;
    status: 'open' | 'active' | 'closed' | 'settled';
    yes_bid: number; // in cents
    yes_ask: number;
    no_bid: number;
    no_ask: number;
    last_price: number;
    previous_price: number;
    previous_yes_bid: number;
    previous_yes_ask: number;
    volume: number;
    volume_24h: number;
    open_interest: number;
    liquidity: number;
    result?: 'yes' | 'no';
    close_time: string;
    expiration_time: string;
    settlement_timer_seconds: number;
    category: string;
    risk_limit_cents: number;
    strike_type: string;
    floor_strike?: number;
    cap_strike?: number;
    rules_primary?: string;
    rules_secondary?: string;
    expected_expiration_time?: string;
}

export interface KalshiEvent {
    event_ticker: string;
    series_ticker: string;
    sub_title: string;
    title: string;
    mutually_exclusive: boolean;
    category: string;
    markets?: KalshiMarket[];
    strike_date?: string;
    strike_period?: string;
}

// Orderbook types - Kalshi uses a unique structure
// A yes bid at price X = no ask at (100-X)
export interface KalshiOrderBookLevel {
    price: number; // in cents (1-99)
    count: number; // number of orders at this level
    quantity: number; // total contracts
}

export interface KalshiOrderBook {
    ticker: string;
    yes: KalshiOrderBookLevel[];
    no: KalshiOrderBookLevel[];
}

// API Response types
export interface GetMarketsResponse {
    markets: KalshiMarket[];
    cursor: string;
}

export interface GetMarketResponse {
    market: KalshiMarket;
}

export interface GetEventsResponse {
    events: KalshiEvent[];
    cursor: string;
}

export interface GetEventResponse {
    event: KalshiEvent;
    markets?: KalshiMarket[];
}

export interface GetOrderBookResponse {
    orderbook: KalshiOrderBook;
}

// Normalized market format for cross-platform comparison
export interface NormalizedMarket {
    id: string;
    platform: 'polymarket' | 'kalshi';
    question: string;
    description?: string;
    category: string;
    yesPrice: number; // 0-1 (normalized from cents)
    noPrice: number;
    volume: number;
    volume24h: number;
    liquidity: number;
    status: 'active' | 'closed' | 'settled';
    endDate?: string;
    url?: string; // Link to market page on the platform
    originalData: KalshiMarket | object;
}

// Arbitrage opportunity
export interface ArbitrageOpportunity {
    id: string;
    question: string;
    type: 'cross-platform' | 'single-platform';
    strategy: 'buy-yes-a-no-b' | 'buy-no-a-yes-b' | 'buy-both-same';
    platform1: {
        name: 'polymarket' | 'kalshi';
        marketId: string;
        yesPrice: number;
        noPrice: number;
        url?: string;
    };
    platform2: {
        name: 'polymarket' | 'kalshi';
        marketId: string;
        yesPrice: number;
        noPrice: number;
        url?: string;
    };
    profitPercentage: number;
    totalCost: number; // Cost to buy both positions
    guaranteedProfit: number; // Profit per $1 outcome
    detectedAt: string;
}
