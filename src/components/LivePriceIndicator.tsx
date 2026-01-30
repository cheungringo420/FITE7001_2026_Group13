'use client';

import React, { useEffect, useState } from 'react';

interface LivePriceIndicatorProps {
    price: number;
    previousPrice?: number;
    side: 'yes' | 'no';
    showChange?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    isLive?: boolean;
}

export function LivePriceIndicator({
    price,
    previousPrice,
    side,
    showChange = true,
    size = 'md',
    className = '',
    isLive = false,
}: LivePriceIndicatorProps) {
    const [isFlashing, setIsFlashing] = useState(false);
    const [flashDirection, setFlashDirection] = useState<'up' | 'down' | null>(null);

    const change = previousPrice !== undefined ? price - previousPrice : null;
    const changePercent = previousPrice && previousPrice !== 0
        ? ((price - previousPrice) / previousPrice) * 100
        : null;

    // Flash animation on price change
    useEffect(() => {
        if (change && change !== 0) {
            setFlashDirection(change > 0 ? 'up' : 'down');
            setIsFlashing(true);
            const timer = setTimeout(() => setIsFlashing(false), 500);
            return () => clearTimeout(timer);
        }
    }, [price, change]);

    const sizeClasses = {
        sm: 'text-lg',
        md: 'text-2xl',
        lg: 'text-3xl',
    };

    const baseColor = side === 'yes' ? 'text-green-400' : 'text-red-400';
    const flashColor = flashDirection === 'up'
        ? 'bg-green-500/30'
        : flashDirection === 'down'
            ? 'bg-red-500/30'
            : '';

    return (
        <div className={`relative inline-flex items-center gap-2 ${className}`}>
            {/* Price with flash effect */}
            <div
                className={`
                    ${sizeClasses[size]} font-bold ${baseColor}
                    ${isFlashing ? `${flashColor} rounded-lg px-2 -mx-2` : ''}
                    transition-all duration-300
                `}
            >
                {(price * 100).toFixed(1)}¢
            </div>

            {/* Live indicator */}
            {isLive && (
                <div className="flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                </div>
            )}

            {/* Change indicator */}
            {showChange && change !== null && change !== 0 && (
                <div className={`flex items-center gap-0.5 text-xs font-medium ${change > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                    <svg
                        className={`w-3 h-3 ${change < 0 ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    <span>{Math.abs(change * 100).toFixed(1)}¢</span>
                    {changePercent !== null && (
                        <span className="text-slate-500">({Math.abs(changePercent).toFixed(1)}%)</span>
                    )}
                </div>
            )}
        </div>
    );
}

// Connection status indicator
interface ConnectionStatusProps {
    polymarketStatus: 'connected' | 'disconnected' | 'reconnecting' | 'error';
    kalshiStatus: 'connected' | 'disconnected' | 'reconnecting' | 'error';
    className?: string;
}

export function ConnectionStatus({
    polymarketStatus,
    kalshiStatus,
    className = '',
}: ConnectionStatusProps) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'connected': return 'bg-green-500';
            case 'reconnecting': return 'bg-yellow-500 animate-pulse';
            case 'error': return 'bg-red-500';
            default: return 'bg-slate-500';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'connected': return 'Live';
            case 'reconnecting': return 'Reconnecting...';
            case 'error': return 'Error';
            default: return 'Offline';
        }
    };

    return (
        <div className={`flex items-center gap-4 ${className}`}>
            {/* Polymarket */}
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${getStatusColor(polymarketStatus)}`} />
                <span className="text-xs text-slate-400">
                    <span className="text-purple-400">Polymarket</span>
                    {' '}
                    <span className={polymarketStatus === 'connected' ? 'text-green-400' : 'text-slate-500'}>
                        {getStatusText(polymarketStatus)}
                    </span>
                </span>
            </div>

            {/* Kalshi */}
            <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${getStatusColor(kalshiStatus)}`} />
                <span className="text-xs text-slate-400">
                    <span className="text-blue-400">Kalshi</span>
                    {' '}
                    <span className={kalshiStatus === 'connected' ? 'text-green-400' : 'text-slate-500'}>
                        {getStatusText(kalshiStatus)}
                    </span>
                </span>
            </div>
        </div>
    );
}

// Price comparison for arbitrage
interface PriceComparisonProps {
    polymarketYes: number;
    polymarketNo: number;
    kalshiYes: number;
    kalshiNo: number;
    isLive?: boolean;
    className?: string;
}

export function PriceComparison({
    polymarketYes,
    polymarketNo,
    kalshiYes,
    kalshiNo,
    isLive = false,
    className = '',
}: PriceComparisonProps) {
    const totalCost = Math.min(
        polymarketYes + kalshiNo,
        polymarketNo + kalshiYes
    );
    const profit = totalCost < 1 ? (1 - totalCost) * 100 : 0;
    const hasArbitrage = profit > 0;

    return (
        <div className={`bg-slate-800/50 rounded-xl p-4 border ${hasArbitrage ? 'border-green-500/50' : 'border-slate-700/50'
            } ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-slate-400">Price Comparison</span>
                {isLive && (
                    <div className="flex items-center gap-1 text-xs text-green-400">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        LIVE
                    </div>
                )}
            </div>

            {/* Price grid */}
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="text-xs text-slate-500"></div>
                <div className="text-xs text-green-400 font-medium">Yes</div>
                <div className="text-xs text-red-400 font-medium">No</div>

                <div className="text-xs text-purple-400 font-medium text-left">Polymarket</div>
                <div className="text-white font-bold">{(polymarketYes * 100).toFixed(1)}¢</div>
                <div className="text-white font-bold">{(polymarketNo * 100).toFixed(1)}¢</div>

                <div className="text-xs text-blue-400 font-medium text-left">Kalshi</div>
                <div className="text-white font-bold">{(kalshiYes * 100).toFixed(1)}¢</div>
                <div className="text-white font-bold">{(kalshiNo * 100).toFixed(1)}¢</div>
            </div>

            {/* Arbitrage indicator */}
            {hasArbitrage && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                    <div className="text-green-400 font-bold text-lg">
                        +{profit.toFixed(2)}% Profit
                    </div>
                    <div className="text-xs text-slate-400">
                        Total cost: {(totalCost * 100).toFixed(1)}¢
                    </div>
                </div>
            )}
        </div>
    );
}
