// Polymarket WebSocket Manager

import { WebSocketEvent, BookEvent, OrderBookLevel } from './types';

export type WebSocketEventHandler = (event: WebSocketEvent) => void;
export type ConnectionStateHandler = (connected: boolean) => void;

const WEBSOCKET_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
const PING_INTERVAL = 10000; // 10 seconds
const RECONNECT_DELAY = 3000; // 3 seconds

export class PolymarketWebSocket {
    private ws: WebSocket | null = null;
    private subscribedAssets: Set<string> = new Set();
    private eventHandlers: Set<WebSocketEventHandler> = new Set();
    private connectionHandlers: Set<ConnectionStateHandler> = new Set();
    private pingInterval: NodeJS.Timeout | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private isIntentionalClose = false;

    constructor() { }

    /**
     * Connect to the WebSocket server
     */
    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return;
        }

        this.isIntentionalClose = false;

        try {
            this.ws = new WebSocket(WEBSOCKET_URL);

            this.ws.onopen = () => {
                console.log('[Polymarket WS] Connected');
                this.notifyConnectionState(true);
                this.startPing();

                // Resubscribe to any assets we were tracking
                if (this.subscribedAssets.size > 0) {
                    this.sendSubscribe(Array.from(this.subscribedAssets));
                }
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.ws.onerror = (error) => {
                console.error('[Polymarket WS] Error:', error);
            };

            this.ws.onclose = () => {
                console.log('[Polymarket WS] Disconnected');
                this.notifyConnectionState(false);
                this.stopPing();

                // Auto-reconnect unless intentionally closed
                if (!this.isIntentionalClose) {
                    this.scheduleReconnect();
                }
            };
        } catch (error) {
            console.error('[Polymarket WS] Failed to create connection:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * Disconnect from the WebSocket server
     */
    disconnect(): void {
        this.isIntentionalClose = true;
        this.stopPing();

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Subscribe to asset updates
     */
    subscribe(assetIds: string[]): void {
        assetIds.forEach(id => this.subscribedAssets.add(id));

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.sendSubscribe(assetIds);
        } else {
            // Will subscribe when connected
            this.connect();
        }
    }

    /**
     * Unsubscribe from asset updates
     */
    unsubscribe(assetIds: string[]): void {
        assetIds.forEach(id => this.subscribedAssets.delete(id));

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                assets_ids: assetIds,
                operation: 'unsubscribe',
            }));
        }
    }

    /**
     * Add an event handler
     */
    onEvent(handler: WebSocketEventHandler): () => void {
        this.eventHandlers.add(handler);
        return () => this.eventHandlers.delete(handler);
    }

    /**
     * Add a connection state handler
     */
    onConnectionChange(handler: ConnectionStateHandler): () => void {
        this.connectionHandlers.add(handler);
        return () => this.connectionHandlers.delete(handler);
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    private sendSubscribe(assetIds: string[]): void {
        if (this.ws?.readyState === WebSocket.OPEN && assetIds.length > 0) {
            this.ws.send(JSON.stringify({
                assets_ids: assetIds,
                type: 'market',
            }));
        }
    }

    private handleMessage(data: string): void {
        // Handle PONG response
        if (data === 'PONG') {
            return;
        }

        try {
            const events: WebSocketEvent[] = JSON.parse(data);

            // The WebSocket returns an array of events
            if (Array.isArray(events)) {
                events.forEach(event => {
                    this.eventHandlers.forEach(handler => handler(event));
                });
            }
        } catch (error) {
            // Some messages might not be JSON (like connection confirmations)
            console.log('[Polymarket WS] Non-JSON message:', data);
        }
    }

    private notifyConnectionState(connected: boolean): void {
        this.connectionHandlers.forEach(handler => handler(connected));
    }

    private startPing(): void {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send('PING');
            }
        }, PING_INTERVAL);
    }

    private stopPing(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        this.reconnectTimeout = setTimeout(() => {
            console.log('[Polymarket WS] Attempting to reconnect...');
            this.connect();
        }, RECONNECT_DELAY);
    }
}

// Singleton instance for easy use across the app
let wsInstance: PolymarketWebSocket | null = null;

export function getPolymarketWebSocket(): PolymarketWebSocket {
    if (!wsInstance) {
        wsInstance = new PolymarketWebSocket();
    }
    return wsInstance;
}

/**
 * Parse order book from WebSocket BookEvent
 */
export function parseBookEvent(event: BookEvent): {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
} {
    return {
        bids: event.bids || [],
        asks: event.asks || [],
    };
}
