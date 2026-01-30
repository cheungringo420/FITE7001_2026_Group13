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

    // Price data
    polymarketPrices: Map<string, MarketPrices>;
    kalshiPrices: Map<string, MarketPrices>;

    // Subscriptions
    subscribePolymarket: (marketId: string) => void;
    unsubscribePolymarket: (marketId: string) => void;
    subscribeKalshi: (ticker: string) => void;
    unsubscribeKalshi: (ticker: string) => void;

    // Get price for a market
    getPrice: (platform: 'polymarket' | 'kalshi', marketId: string) => MarketPrices | undefined;

    // Connect/disconnect
    connect: () => void;
    disconnect: () => void;

    // Check if price was recently updated (for flash animation)
    wasRecentlyUpdated: (platform: 'polymarket' | 'kalshi', marketId: string) => boolean;
}

const PriceContext = createContext<PriceContextValue | null>(null);

const RECENT_UPDATE_THRESHOLD = 2000; // 2 seconds

export function PriceProvider({ children }: { children: React.ReactNode }) {
    // Connection status
    const [polymarketStatus, setPolymarketStatus] = useState<ConnectionStatus>('disconnected');
    const [kalshiStatus, setKalshiStatus] = useState<ConnectionStatus>('disconnected');

    // Price maps
    const [polymarketPrices, setPolymarketPrices] = useState<Map<string, MarketPrices>>(new Map());
    const [kalshiPrices, setKalshiPrices] = useState<Map<string, MarketPrices>>(new Map());

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

        const unsubPolyPrice = polyWs.current.onPriceUpdate((update: PolyPriceUpdate) => {
            setPolymarketPrices(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(update.marketId);
                newMap.set(update.marketId, {
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
                });
                return newMap;
            });
        });

        // Set up Kalshi callbacks
        const unsubKalshiStatus = kalshiWs.current.onStatusChange((status) => {
            setKalshiStatus(status === 'connected' ? 'connected' :
                status === 'reconnecting' ? 'reconnecting' :
                    status === 'error' ? 'error' : 'disconnected');
        });

        const unsubKalshiPrice = kalshiWs.current.onPriceUpdate((update: KalshiPriceUpdate) => {
            setKalshiPrices(prev => {
                const newMap = new Map(prev);
                newMap.set(update.ticker, {
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
                });
                return newMap;
            });
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
        if (platform === 'polymarket') {
            return polymarketPrices.get(marketId);
        }
        return kalshiPrices.get(marketId);
    }, [polymarketPrices, kalshiPrices]);

    const wasRecentlyUpdated = useCallback((platform: 'polymarket' | 'kalshi', marketId: string): boolean => {
        const prices = platform === 'polymarket'
            ? polymarketPrices.get(marketId)
            : kalshiPrices.get(marketId);

        if (!prices) return false;

        const now = Date.now();
        return (now - prices.yes.lastUpdate) < RECENT_UPDATE_THRESHOLD;
    }, [polymarketPrices, kalshiPrices]);

    const value: PriceContextValue = {
        polymarketStatus,
        kalshiStatus,
        polymarketPrices,
        kalshiPrices,
        subscribePolymarket,
        unsubscribePolymarket,
        subscribeKalshi,
        unsubscribeKalshi,
        getPrice,
        connect,
        disconnect,
        wasRecentlyUpdated,
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

// Hook for subscribing to specific markets
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
    } = usePrices();

    useEffect(() => {
        if (platform === 'polymarket') {
            subscribePolymarket(marketId);
            return () => unsubscribePolymarket(marketId);
        } else {
            subscribeKalshi(marketId);
            return () => unsubscribeKalshi(marketId);
        }
    }, [platform, marketId, subscribePolymarket, unsubscribePolymarket, subscribeKalshi, unsubscribeKalshi]);

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
