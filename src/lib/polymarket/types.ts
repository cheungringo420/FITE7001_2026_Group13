// Polymarket API Types

// Market from Gamma API
export interface Market {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  endDate: string;
  category: string;
  liquidity: string;
  volume: string;
  outcomes: string; // JSON stringified array like '["Yes", "No"]'
  outcomePrices: string; // JSON stringified array like '[0.65, 0.35]'
  active: boolean;
  closed: boolean;
  clobTokenIds: string; // JSON stringified array of token IDs
  description: string;
  image: string;
  icon: string;
  volume24hr: number;
  bestBid: number;
  bestAsk: number;
  lastTradePrice: number;
  events?: MarketEvent[];
}

export interface MarketEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  image: string;
  active: boolean;
  closed: boolean;
  volume: number;
  liquidity: number;
}

// Parsed market with typed outcomes
export interface ParsedMarket extends Omit<Market, 'outcomes' | 'outcomePrices' | 'clobTokenIds'> {
  outcomes: string[];
  outcomePrices: number[];
  clobTokenIds: string[];
}

// Order Book Types
export interface OrderBookLevel {
  price: string;
  size: string;
}

export interface OrderBook {
  market: string;
  asset_id: string;
  hash: string;
  timestamp: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

// WebSocket Event Types
export type WebSocketEventType = 
  | 'book'
  | 'price_change'
  | 'last_trade_price'
  | 'tick_size_change';

export interface BaseWebSocketEvent {
  event_type: WebSocketEventType;
  asset_id: string;
  timestamp: string;
}

export interface BookEvent extends BaseWebSocketEvent {
  event_type: 'book';
  market: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface PriceChangeEvent extends BaseWebSocketEvent {
  event_type: 'price_change';
  price: string;
  side: 'BUY' | 'SELL';
  size: string;
}

export interface LastTradePriceEvent extends BaseWebSocketEvent {
  event_type: 'last_trade_price';
  price: string;
}

export interface TickSizeChangeEvent extends BaseWebSocketEvent {
  event_type: 'tick_size_change';
  tick_size: string;
}

export type WebSocketEvent = 
  | BookEvent 
  | PriceChangeEvent 
  | LastTradePriceEvent 
  | TickSizeChangeEvent;

// API Responses
export interface MarketsResponse {
  data: Market[];
  limit: number;
  offset: number;
}

// Trading related
export interface TradeEstimate {
  outcomeIndex: number; // 0 = Yes, 1 = No
  amount: number;
  price: number;
  shares: number;
  potentialPayout: number;
}
