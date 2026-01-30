/**
 * Kalshi WebSocket Client
 * 
 * Connects to Kalshi's real-time market data stream for live price updates.
 * WebSocket endpoint: wss://api.elections.kalshi.com/trade-api/ws/v2
 */

export interface KalshiPriceUpdate {
    ticker: string;
    yesPrice: number;
    noPrice: number;
    yesChange?: number;
    noChange?: number;
    timestamp: number;
}

export interface KalshiOrderbookUpdate {
    ticker: string;
    yesBids: Array<{ price: number; quantity: number }>;
    yesAsks: Array<{ price: number; quantity: number }>;
    noBids: Array<{ price: number; quantity: number }>;
    noAsks: Array<{ price: number; quantity: number }>;
    timestamp: number;
}

export interface KalshiTradeUpdate {
    ticker: string;
    price: number;
    count: number;
    side: 'yes' | 'no';
    takerSide: 'buy' | 'sell';
    timestamp: number;
}

type PriceCallback = (update: KalshiPriceUpdate) => void;
type OrderbookCallback = (update: KalshiOrderbookUpdate) => void;
type TradeCallback = (update: KalshiTradeUpdate) => void;
type StatusCallback = (status: 'connected' | 'disconnected' | 'reconnecting' | 'error') => void;

const KALSHI_WS_URL = 'wss://api.elections.kalshi.com/trade-api/ws/v2';
const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;

export class KalshiWebSocket {
    private ws: WebSocket | null = null;
    private subscribedTickers: Set<string> = new Set();
    private priceCallbacks: PriceCallback[] = [];
    private orderbookCallbacks: OrderbookCallback[] = [];
    private tradeCallbacks: TradeCallback[] = [];
    private statusCallbacks: StatusCallback[] = [];
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private lastPrices: Map<string, { yes: number; no: number }> = new Map();
    private isManualDisconnect = false;
    private commandId = 1;

    constructor(private initialTickers: string[] = []) {
        this.subscribedTickers = new Set(initialTickers);
    }

    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log('[KalshiWS] Already connected');
            return;
        }

        this.isManualDisconnect = false;
        console.log('[KalshiWS] Connecting...');

        try {
            this.ws = new WebSocket(KALSHI_WS_URL);

            this.ws.onopen = () => {
                console.log('[KalshiWS] Connected');
                this.notifyStatus('connected');

                // Subscribe to initial tickers
                if (this.subscribedTickers.size > 0) {
                    this.sendSubscribe(Array.from(this.subscribedTickers));
                }

                // Start ping interval
                this.startPing();
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.ws.onerror = (error) => {
                console.error('[KalshiWS] Error:', error);
                this.notifyStatus('error');
            };

            this.ws.onclose = () => {
                console.log('[KalshiWS] Disconnected');
                this.notifyStatus('disconnected');
                this.stopPing();

                // Auto-reconnect unless manually disconnected
                if (!this.isManualDisconnect) {
                    this.scheduleReconnect();
                }
            };
        } catch (error) {
            console.error('[KalshiWS] Failed to connect:', error);
            this.notifyStatus('error');
            this.scheduleReconnect();
        }
    }

    disconnect(): void {
        this.isManualDisconnect = true;
        this.stopPing();

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        console.log('[KalshiWS] Manually disconnected');
    }

    subscribe(ticker: string): void {
        this.subscribedTickers.add(ticker);

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendSubscribe([ticker]);
        }
    }

    subscribeBatch(tickers: string[]): void {
        tickers.forEach(t => this.subscribedTickers.add(t));

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendSubscribe(tickers);
        }
    }

    unsubscribe(ticker: string): void {
        this.subscribedTickers.delete(ticker);

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendUnsubscribe([ticker]);
        }
    }

    onPriceUpdate(callback: PriceCallback): () => void {
        this.priceCallbacks.push(callback);
        return () => {
            this.priceCallbacks = this.priceCallbacks.filter(cb => cb !== callback);
        };
    }

    onOrderbookUpdate(callback: OrderbookCallback): () => void {
        this.orderbookCallbacks.push(callback);
        return () => {
            this.orderbookCallbacks = this.orderbookCallbacks.filter(cb => cb !== callback);
        };
    }

    onTradeUpdate(callback: TradeCallback): () => void {
        this.tradeCallbacks.push(callback);
        return () => {
            this.tradeCallbacks = this.tradeCallbacks.filter(cb => cb !== callback);
        };
    }

    onStatusChange(callback: StatusCallback): () => void {
        this.statusCallbacks.push(callback);
        return () => {
            this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
        };
    }

    getSubscribedTickers(): string[] {
        return Array.from(this.subscribedTickers);
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    private sendSubscribe(tickers: string[]): void {
        // Subscribe to ticker channel for price updates
        this.send({
            id: this.commandId++,
            cmd: 'subscribe',
            params: {
                channels: ['ticker'],
                market_tickers: tickers,
            },
        });

        // Subscribe to orderbook updates
        this.send({
            id: this.commandId++,
            cmd: 'subscribe',
            params: {
                channels: ['orderbook_delta'],
                market_tickers: tickers,
            },
        });

        // Subscribe to trade updates
        this.send({
            id: this.commandId++,
            cmd: 'subscribe',
            params: {
                channels: ['trade'],
                market_tickers: tickers,
            },
        });
    }

    private sendUnsubscribe(tickers: string[]): void {
        this.send({
            id: this.commandId++,
            cmd: 'unsubscribe',
            params: {
                channels: ['ticker', 'orderbook_delta', 'trade'],
                market_tickers: tickers,
            },
        });
    }

    private send(data: unknown): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    private handleMessage(data: string): void {
        try {
            const message = JSON.parse(data);

            // Handle different message types based on Kalshi's format
            if (message.type === 'ticker') {
                this.handleTicker(message.msg);
            } else if (message.type === 'orderbook_delta' || message.type === 'orderbook_snapshot') {
                this.handleOrderbook(message.msg);
            } else if (message.type === 'trade') {
                this.handleTrade(message.msg);
            } else if (message.type === 'subscribed') {
                console.log('[KalshiWS] Subscribed to:', message.msg?.channels);
            } else if (message.type === 'error') {
                console.error('[KalshiWS] Server error:', message.msg);
            }
        } catch (error) {
            console.error('[KalshiWS] Failed to parse message:', error);
        }
    }

    private handleTicker(msg: { market_ticker?: string; yes_price?: number; no_price?: number; yes_bid?: number; no_bid?: number; yes_ask?: number; no_ask?: number }): void {
        if (!msg?.market_ticker) return;

        const ticker = msg.market_ticker;
        // Kalshi prices are in cents (1-99)
        const yesPrice = (msg.yes_price ?? msg.yes_bid ?? 50) / 100;
        const noPrice = (msg.no_price ?? msg.no_bid ?? 50) / 100;

        const last = this.lastPrices.get(ticker);
        const yesChange = last ? yesPrice - last.yes : undefined;
        const noChange = last ? noPrice - last.no : undefined;
        this.lastPrices.set(ticker, { yes: yesPrice, no: noPrice });

        const update: KalshiPriceUpdate = {
            ticker,
            yesPrice,
            noPrice,
            yesChange,
            noChange,
            timestamp: Date.now(),
        };

        this.priceCallbacks.forEach(cb => cb(update));
    }

    private handleOrderbook(msg: { market_ticker?: string; yes?: { bids?: Array<[number, number]>; asks?: Array<[number, number]> }; no?: { bids?: Array<[number, number]>; asks?: Array<[number, number]> } }): void {
        if (!msg?.market_ticker) return;

        const formatOrders = (orders?: Array<[number, number]>) =>
            (orders || []).map(([price, quantity]) => ({ price: price / 100, quantity }));

        const update: KalshiOrderbookUpdate = {
            ticker: msg.market_ticker,
            yesBids: formatOrders(msg.yes?.bids),
            yesAsks: formatOrders(msg.yes?.asks),
            noBids: formatOrders(msg.no?.bids),
            noAsks: formatOrders(msg.no?.asks),
            timestamp: Date.now(),
        };

        this.orderbookCallbacks.forEach(cb => cb(update));
    }

    private handleTrade(msg: { market_ticker?: string; price?: number; count?: number; side?: string; taker_side?: string }): void {
        if (!msg?.market_ticker) return;

        const update: KalshiTradeUpdate = {
            ticker: msg.market_ticker,
            price: (msg.price || 0) / 100,
            count: msg.count || 0,
            side: msg.side === 'no' ? 'no' : 'yes',
            takerSide: msg.taker_side === 'sell' ? 'sell' : 'buy',
            timestamp: Date.now(),
        };

        this.tradeCallbacks.forEach(cb => cb(update));

        // Also emit as price update
        const ticker = msg.market_ticker;
        const price = (msg.price || 0) / 100;
        const isYes = msg.side !== 'no';

        const last = this.lastPrices.get(ticker) || { yes: 0.5, no: 0.5 };
        const newPrices = isYes
            ? { yes: price, no: 1 - price }
            : { yes: 1 - price, no: price };

        const yesChange = newPrices.yes - last.yes;
        const noChange = newPrices.no - last.no;
        this.lastPrices.set(ticker, newPrices);

        const priceUpdate: KalshiPriceUpdate = {
            ticker,
            yesPrice: newPrices.yes,
            noPrice: newPrices.no,
            yesChange,
            noChange,
            timestamp: Date.now(),
        };

        this.priceCallbacks.forEach(cb => cb(priceUpdate));
    }

    private notifyStatus(status: 'connected' | 'disconnected' | 'reconnecting' | 'error'): void {
        this.statusCallbacks.forEach(cb => cb(status));
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimeout) return;

        console.log(`[KalshiWS] Reconnecting in ${RECONNECT_DELAY}ms...`);
        this.notifyStatus('reconnecting');

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, RECONNECT_DELAY);
    }

    private startPing(): void {
        this.pingInterval = setInterval(() => {
            this.send({ id: this.commandId++, cmd: 'ping' });
        }, PING_INTERVAL);
    }

    private stopPing(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}

// Singleton instance for app-wide use
let kalshiWsInstance: KalshiWebSocket | null = null;

export function getKalshiWebSocket(): KalshiWebSocket {
    if (!kalshiWsInstance) {
        kalshiWsInstance = new KalshiWebSocket();
    }
    return kalshiWsInstance;
}
