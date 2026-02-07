'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
    PolymarketWebSocket,
    getPolymarketWebSocket,
    PriceUpdate as PolyPriceUpdate
} from '@/lib/realtime/polymarket-ws';
import {
    KalshiWebSocket,
    getKalshiWebSocket,
    KalshiPriceUpdate
} from '@/lib/realtime/kalshi-ws';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface PriceData {
    price: number;
    change?: number;
    lastUpdate: number;
}

interface MarketPrices {
    yes: PriceData;
    no: PriceData;
}

interface PriceContextValue {
    // Connection status
    polymarketStatus: ConnectionStatus;
    kalshiStatus: ConnectionStatus;

    // Price data (refs - stable references, don't trigger re-renders)
    polymarketPricesRef: React.MutableRefObject<Map<string, MarketPrices>>;
    kalshiPricesRef: React.MutableRefObject<Map<string, MarketPrices>>;

    // Subscriptions
    subscribePolymarket: (marketId: string) => void;
    unsubscribePolymarket: (marketId: string) => void;
    subscribeKalshi: (ticker: string) => void;
    unsubscribeKalshi: (ticker: string) => void;

    // Get price for a market (reads from ref)
    getPrice: (platform: 'polymarket' | 'kalshi', marketId: string) => MarketPrices | undefined;

    // Connect/disconnect
    connect: () => void;
    disconnect: () => void;

    // Check if price was recently updated (for flash animation)
    wasRecentlyUpdated: (platform: 'polymarket' | 'kalshi', marketId: string) => boolean;

    // Subscribe to price updates for a specific market (returns unsubscribe fn)
    subscribeToPriceUpdates: (platform: 'polymarket' | 'kalshi', marketId: string, callback: () => void) => () => void;
}

const PriceContext = createContext<PriceContextValue | null>(null);

const RECENT_UPDATE_THRESHOLD = 2000; // 2 seconds

// Price store for efficient subscriptions - prevents re-render storm
class PriceStore {
    private polymarketPrices = new Map<string, MarketPrices>();
    private kalshiPrices = new Map<string, MarketPrices>();
    private listeners = new Map<string, Set<() => void>>();

    getPolymarketPrices() {
        return this.polymarketPrices;
    }

    getKalshiPrices() {
        return this.kalshiPrices;
    }

    getPrice(platform: 'polymarket' | 'kalshi', marketId: string): MarketPrices | undefined {
        return platform === 'polymarket'
            ? this.polymarketPrices.get(marketId)
            : this.kalshiPrices.get(marketId);
    }

    updatePolymarketPrice(marketId: string, prices: MarketPrices) {
        this.polymarketPrices.set(marketId, prices);
        this.notifyListeners(`polymarket:${marketId}`);
    }

    updateKalshiPrice(ticker: string, prices: MarketPrices) {
        this.kalshiPrices.set(ticker, prices);
        this.notifyListeners(`kalshi:${ticker}`);
    }

    subscribe(platform: 'polymarket' | 'kalshi', marketId: string, callback: () => void): () => void {
        const key = `${platform}:${marketId}`;
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key)!.add(callback);

        return () => {
            this.listeners.get(key)?.delete(callback);
            if (this.listeners.get(key)?.size === 0) {
                this.listeners.delete(key);
            }
        };
    }

    private notifyListeners(key: string) {
        this.listeners.get(key)?.forEach(callback => callback());
    }
}

// Singleton store instance
const priceStore = new PriceStore();

export function PriceProvider({ children }: { children: React.ReactNode }) {
    // Connection status (these can trigger re-renders - they change rarely)
    const [polymarketStatus, setPolymarketStatus] = useState<ConnectionStatus>('disconnected');
    const [kalshiStatus, setKalshiStatus] = useState<ConnectionStatus>('disconnected');

    // Price maps stored as refs (stable references - don't trigger re-renders on update)
    const polymarketPricesRef = useRef<Map<string, MarketPrices>>(priceStore.getPolymarketPrices());
    const kalshiPricesRef = useRef<Map<string, MarketPrices>>(priceStore.getKalshiPrices());

    // WebSocket instances
    const polyWs = useRef<PolymarketWebSocket | null>(null);
    const kalshiWs = useRef<KalshiWebSocket | null>(null);

    // Initialize WebSocket clients
    useEffect(() => {
        if (typeof window === 'undefined') return;

        polyWs.current = getPolymarketWebSocket();
        kalshiWs.current = getKalshiWebSocket();

        // Set up Polymarket callbacks
        const unsubPolyStatus = polyWs.current.onStatusChange((status) => {
            setPolymarketStatus(status === 'connected' ? 'connected' :
                status === 'reconnecting' ? 'reconnecting' :
                    status === 'error' ? 'error' : 'disconnected');
        });

        // Optimized: Update store directly, only subscribed components re-render
        const unsubPolyPrice = polyWs.current.onPriceUpdate((update: PolyPriceUpdate) => {
            const prices: MarketPrices = {
                yes: {
                    price: update.price,
                    change: update.change,
                    lastUpdate: update.timestamp,
                },
                no: {
                    price: 1 - update.price,
                    change: update.change ? -update.change : undefined,
                    lastUpdate: update.timestamp,
                },
            };
            priceStore.updatePolymarketPrice(update.marketId, prices);
        });

        // Set up Kalshi callbacks
        const unsubKalshiStatus = kalshiWs.current.onStatusChange((status) => {
            setKalshiStatus(status === 'connected' ? 'connected' :
                status === 'reconnecting' ? 'reconnecting' :
                    status === 'error' ? 'error' : 'disconnected');
        });

        // Optimized: Update store directly, only subscribed components re-render
        const unsubKalshiPrice = kalshiWs.current.onPriceUpdate((update: KalshiPriceUpdate) => {
            const prices: MarketPrices = {
                yes: {
                    price: update.yesPrice,
                    change: update.yesChange,
                    lastUpdate: update.timestamp,
                },
                no: {
                    price: update.noPrice,
                    change: update.noChange,
                    lastUpdate: update.timestamp,
                },
            };
            priceStore.updateKalshiPrice(update.ticker, prices);
        });

        return () => {
            unsubPolyStatus();
            unsubPolyPrice();
            unsubKalshiStatus();
            unsubKalshiPrice();
        };
    }, []);

    const connect = useCallback(() => {
        setPolymarketStatus('connecting');
        setKalshiStatus('connecting');
        polyWs.current?.connect();
        kalshiWs.current?.connect();
    }, []);

    const disconnect = useCallback(() => {
        polyWs.current?.disconnect();
        kalshiWs.current?.disconnect();
    }, []);

    const subscribePolymarket = useCallback((marketId: string) => {
        polyWs.current?.subscribe(marketId);
    }, []);

    const unsubscribePolymarket = useCallback((marketId: string) => {
        polyWs.current?.unsubscribe(marketId);
    }, []);

    const subscribeKalshi = useCallback((ticker: string) => {
        kalshiWs.current?.subscribe(ticker);
    }, []);

    const unsubscribeKalshi = useCallback((ticker: string) => {
        kalshiWs.current?.unsubscribe(ticker);
    }, []);

    const getPrice = useCallback((platform: 'polymarket' | 'kalshi', marketId: string): MarketPrices | undefined => {
        return priceStore.getPrice(platform, marketId);
    }, []);

    const wasRecentlyUpdated = useCallback((platform: 'polymarket' | 'kalshi', marketId: string): boolean => {
        const prices = priceStore.getPrice(platform, marketId);
        if (!prices) return false;
        return (Date.now() - prices.yes.lastUpdate) < RECENT_UPDATE_THRESHOLD;
    }, []);

    const subscribeToPriceUpdates = useCallback((
        platform: 'polymarket' | 'kalshi',
        marketId: string,
        callback: () => void
    ): (() => void) => {
        return priceStore.subscribe(platform, marketId, callback);
    }, []);

    const value: PriceContextValue = {
        polymarketStatus,
        kalshiStatus,
        polymarketPricesRef,
        kalshiPricesRef,
        subscribePolymarket,
        unsubscribePolymarket,
        subscribeKalshi,
        unsubscribeKalshi,
        getPrice,
        connect,
        disconnect,
        wasRecentlyUpdated,
        subscribeToPriceUpdates,
    };

    return (
        <PriceContext.Provider value={value}>
            {children}
        </PriceContext.Provider>
    );
}

export function usePrices() {
    const context = useContext(PriceContext);
    if (!context) {
        throw new Error('usePrices must be used within a PriceProvider');
    }
    return context;
}

export function useMarketPrice(platform: 'polymarket' | 'kalshi', marketId: string) {
    const {
        getPrice,
        subscribePolymarket,
        unsubscribePolymarket,
        subscribeKalshi,
        unsubscribeKalshi,
        wasRecentlyUpdated,
        polymarketStatus,
        kalshiStatus,
        subscribeToPriceUpdates,
    } = usePrices();

    const [, forceUpdate] = useState({});

    useEffect(() => {
        if (platform === 'polymarket') {
            subscribePolymarket(marketId);
        } else {
            subscribeKalshi(marketId);
        }

        const unsubscribe = subscribeToPriceUpdates(platform, marketId, () => {
            forceUpdate({});
        });

        return () => {
            unsubscribe();
            if (platform === 'polymarket') {
                unsubscribePolymarket(marketId);
            } else {
                unsubscribeKalshi(marketId);
            }
        };
    }, [platform, marketId, subscribePolymarket, unsubscribePolymarket, subscribeKalshi, unsubscribeKalshi, subscribeToPriceUpdates]);

    const prices = getPrice(platform, marketId);
    const isRecentlyUpdated = wasRecentlyUpdated(platform, marketId);
    const status = platform === 'polymarket' ? polymarketStatus : kalshiStatus;

    return {
        prices,
        isRecentlyUpdated,
        isConnected: status === 'connected',
        status,
    };
}

// Hook to get connection status
export function useWebSocketStatus() {
    const { polymarketStatus, kalshiStatus, connect, disconnect } = usePrices();

    return {
        polymarket: polymarketStatus,
        kalshi: kalshiStatus,
        isFullyConnected: polymarketStatus === 'connected' && kalshiStatus === 'connected',
        hasAnyConnection: polymarketStatus === 'connected' || kalshiStatus === 'connected',
        connect,
        disconnect,
    };
}
