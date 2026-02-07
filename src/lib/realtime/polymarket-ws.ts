/**
 * Polymarket WebSocket Client
 * 
 * Connects to Polymarket's real-time market data stream for live price updates.
 * WebSocket endpoint: wss://ws-subscriptions-clob.polymarket.com/ws/market
 */

export interface PriceUpdate {
    marketId: string;
    tokenId: string;
    price: number;
    side: 'yes' | 'no';
    timestamp: number;
    change?: number;  // Price change from previous
}

export interface OrderbookUpdate {
    marketId: string;
    bids: Array<{ price: number; size: number }>;
    asks: Array<{ price: number; size: number }>;
    timestamp: number;
}

export interface TradeUpdate {
    marketId: string;
    price: number;
    size: number;
    side: 'buy' | 'sell';
    timestamp: number;
}

type PriceCallback = (update: PriceUpdate) => void;
type OrderbookCallback = (update: OrderbookUpdate) => void;
type TradeCallback = (update: TradeUpdate) => void;
type StatusCallback = (status: 'connected' | 'disconnected' | 'reconnecting' | 'error') => void;
type ConnectionCallback = (connected: boolean) => void;
type EventCallback = (event: import('../polymarket/types').WebSocketEvent) => void;

const POLYMARKET_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
const RECONNECT_DELAY = 3000;
const PING_INTERVAL = 30000;

export class PolymarketWebSocket {
    private ws: WebSocket | null = null;
    private subscribedMarkets: Set<string> = new Set();
    private priceCallbacks: PriceCallback[] = [];
    private orderbookCallbacks: OrderbookCallback[] = [];
    private tradeCallbacks: TradeCallback[] = [];
    private statusCallbacks: StatusCallback[] = [];
    private connectionCallbacks: ConnectionCallback[] = [];
    private eventCallbacks: EventCallback[] = [];
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private lastPrices: Map<string, number> = new Map();
    private isManualDisconnect = false;

    constructor(private initialMarkets: string[] = []) {
        this.subscribedMarkets = new Set(initialMarkets);
    }

    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log('[PolymarketWS] Already connected');
            return;
        }

        this.isManualDisconnect = false;
        console.log('[PolymarketWS] Connecting...');

        try {
            this.ws = new WebSocket(POLYMARKET_WS_URL);

            this.ws.onopen = () => {
                console.log('[PolymarketWS] Connected');
                this.notifyStatus('connected');

                // Subscribe to initial markets
                this.sendSubscribe(Array.from(this.subscribedMarkets));

                // Start ping interval
                this.startPing();
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.ws.onerror = (error) => {
                console.error('[PolymarketWS] Error:', error);
                this.notifyStatus('error');
            };

            this.ws.onclose = () => {
                console.log('[PolymarketWS] Disconnected');
                this.notifyStatus('disconnected');
                this.stopPing();

                // Auto-reconnect unless manually disconnected
                if (!this.isManualDisconnect) {
                    this.scheduleReconnect();
                }
            };
        } catch (error) {
            console.error('[PolymarketWS] Failed to connect:', error);
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

        console.log('[PolymarketWS] Manually disconnected');
    }

    subscribe(marketIds: string | string[]): void {
        const ids = Array.isArray(marketIds) ? marketIds : [marketIds];
        ids.forEach((marketId) => this.subscribedMarkets.add(marketId));

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendSubscribe(ids);
        }
    }

    unsubscribe(marketIds: string | string[]): void {
        const ids = Array.isArray(marketIds) ? marketIds : [marketIds];
        ids.forEach((marketId) => this.subscribedMarkets.delete(marketId));

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendUnsubscribe(ids);
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

    onConnectionChange(callback: ConnectionCallback): () => void {
        this.connectionCallbacks.push(callback);
        return () => {
            this.connectionCallbacks = this.connectionCallbacks.filter(cb => cb !== callback);
        };
    }

    onEvent(callback: EventCallback): () => void {
        this.eventCallbacks.push(callback);
        return () => {
            this.eventCallbacks = this.eventCallbacks.filter(cb => cb !== callback);
        };
    }

    getSubscribedMarkets(): string[] {
        return Array.from(this.subscribedMarkets);
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    private sendSubscribe(marketIds: string[]): void {
        if (marketIds.length === 0) return;
        this.send({
            type: 'subscribe',
            channel: 'market',
            markets: marketIds,
        });
    }

    private sendUnsubscribe(marketIds: string[]): void {
        if (marketIds.length === 0) return;
        this.send({
            type: 'unsubscribe',
            channel: 'market',
            markets: marketIds,
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

            // Handle different message types
            if (Array.isArray(message)) {
                message.forEach((event) => this.handleEventMessage(event));
                return;
            }

            switch (message.type) {
                case 'price_change':
                    this.handlePriceChange(message);
                    break;
                case 'book':
                case 'orderbook':
                    this.handleOrderbook(message);
                    break;
                case 'trade':
                case 'last_trade_price':
                    this.handleTrade(message);
                    break;
                case 'pong':
                    // Ping response, connection is alive
                    break;
                default:
                    // Log unknown message types for debugging
                    if (message.event_type) {
                        this.handleEventMessage(message);
                    }
            }
        } catch (error) {
            console.error('[PolymarketWS] Failed to parse message:', error);
        }
    }

    private handleEventMessage(message: { event_type: string;[key: string]: unknown }): void {
        // Emit raw event for legacy consumers
        this.eventCallbacks.forEach(cb => cb(message as import('../polymarket/types').WebSocketEvent));

        const marketId = (message.asset_id as string) || (message.market as string);

        if (message.event_type === 'book') {
            const bids = (message.bids as Array<{ price: string | number; size: string | number }> || [])
                .map(level => ({ price: Number(level.price), size: Number(level.size) }));
            const asks = (message.asks as Array<{ price: string | number; size: string | number }> || [])
                .map(level => ({ price: Number(level.price), size: Number(level.size) }));

            if (marketId) {
                const update: OrderbookUpdate = {
                    marketId,
                    bids,
                    asks,
                    timestamp: Date.now(),
                };
                this.orderbookCallbacks.forEach(cb => cb(update));
            }
        }

        // Handle Polymarket's event-based message format
        if (message.event_type === 'price_change' || message.event_type === 'tick_size_change' || message.event_type === 'last_trade_price') {
            const price = Number(message.price);

            if (marketId && price !== undefined) {
                const lastPrice = this.lastPrices.get(marketId);
                const change = lastPrice ? price - lastPrice : undefined;
                this.lastPrices.set(marketId, price);

                const update: PriceUpdate = {
                    marketId,
                    tokenId: marketId,
                    price,
                    side: 'yes', // Will be determined by token
                    timestamp: Date.now(),
                    change,
                };

                this.priceCallbacks.forEach(cb => cb(update));
            }
        }
    }

    private handlePriceChange(message: { market?: string; asset_id?: string; price?: number;[key: string]: unknown }): void {
        const marketId = message.market || message.asset_id;
        const price = message.price;

        if (marketId && price !== undefined) {
            const lastPrice = this.lastPrices.get(marketId);
            const change = lastPrice ? price - lastPrice : undefined;
            this.lastPrices.set(marketId, price);

            const update: PriceUpdate = {
                marketId,
                tokenId: marketId,
                price,
                side: 'yes',
                timestamp: Date.now(),
                change,
            };

            this.priceCallbacks.forEach(cb => cb(update));
        }
    }

    private handleOrderbook(message: { market?: string; bids?: Array<{ price: number; size: number }>; asks?: Array<{ price: number; size: number }> }): void {
        if (message.market && (message.bids || message.asks)) {
            const update: OrderbookUpdate = {
                marketId: message.market,
                bids: message.bids || [],
                asks: message.asks || [],
                timestamp: Date.now(),
            };

            this.orderbookCallbacks.forEach(cb => cb(update));
        }
    }

    private handleTrade(message: { market?: string; price?: number; size?: number; side?: string }): void {
        if (message.market && message.price !== undefined) {
            const update: TradeUpdate = {
                marketId: message.market,
                price: message.price,
                size: message.size || 0,
                side: message.side === 'sell' ? 'sell' : 'buy',
                timestamp: Date.now(),
            };

            this.tradeCallbacks.forEach(cb => cb(update));

            // Also emit as price update
            const lastPrice = this.lastPrices.get(message.market);
            const change = lastPrice ? message.price - lastPrice : undefined;
            this.lastPrices.set(message.market, message.price);

            const priceUpdate: PriceUpdate = {
                marketId: message.market,
                tokenId: message.market,
                price: message.price,
                side: 'yes',
                timestamp: Date.now(),
                change,
            };

            this.priceCallbacks.forEach(cb => cb(priceUpdate));
        }
    }

    private notifyStatus(status: 'connected' | 'disconnected' | 'reconnecting' | 'error'): void {
        this.statusCallbacks.forEach(cb => cb(status));
        const isConnected = status === 'connected';
        if (status === 'connected' || status === 'disconnected') {
            this.connectionCallbacks.forEach(cb => cb(isConnected));
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimeout) return;

        console.log(`[PolymarketWS] Reconnecting in ${RECONNECT_DELAY}ms...`);
        this.notifyStatus('reconnecting');

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, RECONNECT_DELAY);
    }

    private startPing(): void {
        this.pingInterval = setInterval(() => {
            this.send({ type: 'ping' });
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
let polymarketWsInstance: PolymarketWebSocket | null = null;

export function getPolymarketWebSocket(): PolymarketWebSocket {
    if (!polymarketWsInstance) {
        polymarketWsInstance = new PolymarketWebSocket();
    }
    return polymarketWsInstance;
}
