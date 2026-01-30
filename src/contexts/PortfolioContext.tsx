'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
    Position,
    Trade,
    ArbitrageTrade,
    PortfolioState,
    PortfolioStats,
    INITIAL_PORTFOLIO_STATE,
    calculatePortfolioStats,
} from '@/lib/portfolio/types';

interface PortfolioContextValue extends PortfolioState {
    // Position management
    addPosition: (position: Omit<Position, 'id'>) => string;
    updatePosition: (id: string, updates: Partial<Position>) => void;
    closePosition: (id: string, closePrice: number) => void;
    removePosition: (id: string) => void;

    // Trade management
    addTrade: (trade: Omit<Trade, 'id'>) => string;
    updateTrade: (id: string, updates: Partial<Trade>) => void;

    // Arbitrage trades
    addArbitrageTrade: (trade: Omit<ArbitrageTrade, 'id'>) => string;

    // Refresh data
    refreshStats: () => void;

    // Persistence
    loadFromStorage: () => void;
    saveToStorage: () => void;
    clearPortfolio: () => void;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

const STORAGE_KEY = 'pm-arbitrage-portfolio';

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
    const [positions, setPositions] = useState<Position[]>([]);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [arbitrageTrades, setArbitrageTrades] = useState<ArbitrageTrade[]>([]);
    const [stats, setStats] = useState<PortfolioStats>(INITIAL_PORTFOLIO_STATE.stats);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<number>();
    const [error, setError] = useState<string>();

    // Load from localStorage on mount
    useEffect(() => {
        loadFromStorage();
    }, []);

    // Recalculate stats when positions or trades change
    useEffect(() => {
        const newStats = calculatePortfolioStats(positions, trades);
        setStats(newStats);
        setLastUpdated(Date.now());
    }, [positions, trades]);

    // Auto-save on changes
    useEffect(() => {
        if (!isLoading && positions.length + trades.length > 0) {
            saveToStorage();
        }
    }, [positions, trades, arbitrageTrades, isLoading]);

    const loadFromStorage = useCallback(() => {
        setIsLoading(true);
        try {
            if (typeof window === 'undefined') return;

            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                setPositions(data.positions || []);
                setTrades(data.trades || []);
                setArbitrageTrades(data.arbitrageTrades || []);
            }
        } catch (err) {
            console.error('[Portfolio] Failed to load from storage:', err);
            setError('Failed to load portfolio data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const saveToStorage = useCallback(() => {
        try {
            if (typeof window === 'undefined') return;

            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                positions,
                trades,
                arbitrageTrades,
                savedAt: Date.now(),
            }));
        } catch (err) {
            console.error('[Portfolio] Failed to save to storage:', err);
        }
    }, [positions, trades, arbitrageTrades]);

    const clearPortfolio = useCallback(() => {
        setPositions([]);
        setTrades([]);
        setArbitrageTrades([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    const addPosition = useCallback((position: Omit<Position, 'id'>): string => {
        const id = generateId();
        const newPosition: Position = {
            ...position,
            id,
        };
        setPositions(prev => [...prev, newPosition]);
        return id;
    }, []);

    const updatePosition = useCallback((id: string, updates: Partial<Position>) => {
        setPositions(prev => prev.map(p =>
            p.id === id ? { ...p, ...updates } : p
        ));
    }, []);

    const closePosition = useCallback((id: string, closePrice: number) => {
        setPositions(prev => prev.map(p => {
            if (p.id !== id) return p;

            const realizedPnL = (closePrice - p.entryPrice) * p.quantity * (p.side === 'yes' ? 1 : -1);
            return {
                ...p,
                status: 'closed' as const,
                currentPrice: closePrice,
                currentValue: closePrice * p.quantity,
                realizedPnL,
            };
        }));
    }, []);

    const removePosition = useCallback((id: string) => {
        setPositions(prev => prev.filter(p => p.id !== id));
    }, []);

    const addTrade = useCallback((trade: Omit<Trade, 'id'>): string => {
        const id = generateId();
        const newTrade: Trade = {
            ...trade,
            id,
        };
        setTrades(prev => [...prev, newTrade]);
        return id;
    }, []);

    const updateTrade = useCallback((id: string, updates: Partial<Trade>) => {
        setTrades(prev => prev.map(t =>
            t.id === id ? { ...t, ...updates } : t
        ));
    }, []);

    const addArbitrageTrade = useCallback((trade: Omit<ArbitrageTrade, 'id'>): string => {
        const id = generateId();
        const newTrade: ArbitrageTrade = {
            ...trade,
            id,
        };
        setArbitrageTrades(prev => [...prev, newTrade]);
        return id;
    }, []);

    const refreshStats = useCallback(() => {
        const newStats = calculatePortfolioStats(positions, trades);
        setStats(newStats);
        setLastUpdated(Date.now());
    }, [positions, trades]);

    const value: PortfolioContextValue = {
        positions,
        trades,
        arbitrageTrades,
        stats,
        isLoading,
        lastUpdated,
        error,
        addPosition,
        updatePosition,
        closePosition,
        removePosition,
        addTrade,
        updateTrade,
        addArbitrageTrade,
        refreshStats,
        loadFromStorage,
        saveToStorage,
        clearPortfolio,
    };

    return (
        <PortfolioContext.Provider value={value}>
            {children}
        </PortfolioContext.Provider>
    );
}

export function usePortfolio() {
    const context = useContext(PortfolioContext);
    if (!context) {
        throw new Error('usePortfolio must be used within a PortfolioProvider');
    }
    return context;
}

// Hook for just stats
export function usePortfolioStats() {
    const { stats, isLoading, lastUpdated } = usePortfolio();
    return { stats, isLoading, lastUpdated };
}

// Hook for positions
export function usePositions() {
    const {
        positions,
        isLoading,
        addPosition,
        updatePosition,
        closePosition,
        removePosition
    } = usePortfolio();
    return { positions, isLoading, addPosition, updatePosition, closePosition, removePosition };
}

// Hook for trades
export function useTrades() {
    const { trades, isLoading, addTrade, updateTrade } = usePortfolio();
    return { trades, isLoading, addTrade, updateTrade };
}
