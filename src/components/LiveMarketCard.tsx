'use client';

import React from 'react';
import { useMarketPrice } from '@/contexts/PriceContext';
import { Sparkline } from './charts/PriceChart';

interface LiveMarketCardProps {
    platform: 'polymarket' | 'kalshi';
    marketId: string;
    title: string;
    subtitle?: string;
    staticPrice?: number;
    onClick?: () => void;
    className?: string;
}

export function LiveMarketCard({
    platform,
    marketId,
    title,
    subtitle,
    staticPrice,
    onClick,
    className = '',
}: LiveMarketCardProps) {
    const { prices, isRecentlyUpdated, isConnected } = useMarketPrice(platform, marketId);

    // Use live price if available, otherwise static
    const yesPrice = prices?.yes.price ?? staticPrice ?? 0;
    const priceChange = prices?.yes.change;

    const platformColor = platform === 'polymarket'
        ? 'from-purple-500 to-purple-600'
        : 'from-blue-500 to-blue-600';

    const platformBg = platform === 'polymarket'
        ? 'bg-purple-500/10 border-purple-500/20'
        : 'bg-blue-500/10 border-blue-500/20';

    return (
        <div
            onClick={onClick}
            className={`
                relative overflow-hidden rounded-xl border border-slate-700/50 
                bg-slate-800/30 backdrop-blur-sm p-4 
                hover:border-slate-600/50 transition-all duration-300
                ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}
                ${className}
            `}
        >
            {/* Live indicator */}
            {isConnected && (
                <div className="absolute top-2 right-2 flex items-center gap-1">
                    <span className={`relative flex h-2 w-2 ${isRecentlyUpdated ? '' : ''}`}>
                        {isRecentlyUpdated && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        )}
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-[10px] text-green-400">LIVE</span>
                </div>
            )}

            {/* Platform badge */}
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${platformBg} border mb-3`}>
                <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${platformColor}`} />
                <span className={platform === 'polymarket' ? 'text-purple-400' : 'text-blue-400'}>
                    {platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                </span>
            </div>

            {/* Title */}
            <h3 className="font-medium text-white mb-1 line-clamp-2">{title}</h3>
            {subtitle && (
                <p className="text-sm text-slate-400 mb-3 line-clamp-1">{subtitle}</p>
            )}

            {/* Price display */}
            <div className="flex items-end justify-between">
                <div>
                    <div className="flex items-baseline gap-2">
                        <span className={`
                            text-2xl font-bold
                            ${isRecentlyUpdated ? 'animate-pulse' : ''}
                            ${priceChange && priceChange > 0 ? 'text-green-400' : ''}
                            ${priceChange && priceChange < 0 ? 'text-red-400' : ''}
                            ${!priceChange ? 'text-white' : ''}
                        `}>
                            {(yesPrice * 100).toFixed(1)}%
                        </span>

                        {priceChange !== undefined && priceChange !== 0 && (
                            <span className={`text-sm flex items-center ${priceChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {priceChange > 0 ? '↑' : '↓'}
                                {Math.abs(priceChange * 100).toFixed(2)}%
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-slate-500">YES Price</span>
                </div>

                {/* Mini sparkline placeholder */}
                <div className="w-16 h-8 opacity-50">
                    <Sparkline
                        data={[
                            yesPrice - 0.02,
                            yesPrice - 0.01,
                            yesPrice + 0.005,
                            yesPrice,
                        ]}
                        color={platform === 'polymarket' ? '#a855f7' : '#3b82f6'}
                        height={32}
                    />
                </div>
            </div>
        </div>
    );
}

// Comparison card showing both platforms side by side
interface LiveComparisonCardProps {
    polymarketId: string;
    kalshiId: string;
    title: string;
    polymarketPrice?: number;
    kalshiPrice?: number;
    similarity?: number;
    onClick?: () => void;
}

export function LiveComparisonCard({
    polymarketId,
    kalshiId,
    title,
    polymarketPrice: staticPolyPrice,
    kalshiPrice: staticKalshiPrice,
    similarity,
    onClick,
}: LiveComparisonCardProps) {
    const polyData = useMarketPrice('polymarket', polymarketId);
    const kalshiData = useMarketPrice('kalshi', kalshiId);

    const polyPrice = polyData.prices?.yes.price ?? staticPolyPrice ?? 0;
    const kalshiPrice = kalshiData.prices?.yes.price ?? staticKalshiPrice ?? 0;

    const isLive = polyData.isConnected || kalshiData.isConnected;
    const spread = Math.abs(polyPrice - kalshiPrice);
    const hasArbitrage = spread > 0.02;

    return (
        <div
            onClick={onClick}
            className={`
                relative overflow-hidden rounded-xl border 
                ${hasArbitrage
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-slate-700/50 bg-slate-800/30'
                }
                backdrop-blur-sm p-4 
                hover:border-slate-600/50 transition-all duration-300
                ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}
            `}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <h3 className="font-medium text-white line-clamp-2">{title}</h3>
                    {similarity !== undefined && (
                        <span className="text-xs text-slate-500">
                            {Math.round(similarity * 100)}% match confidence
                        </span>
                    )}
                </div>

                {isLive && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 rounded-full">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-[10px] text-green-400">LIVE</span>
                    </div>
                )}
            </div>

            {/* Price comparison */}
            <div className="grid grid-cols-2 gap-4">
                {/* Polymarket */}
                <div className="text-center">
                    <div className="text-xs text-purple-400 mb-1 flex items-center justify-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        Polymarket
                    </div>
                    <div className={`text-xl font-bold ${polyData.isRecentlyUpdated ? 'text-green-400 animate-pulse' : 'text-white'}`}>
                        {(polyPrice * 100).toFixed(1)}%
                    </div>
                </div>

                {/* Kalshi */}
                <div className="text-center">
                    <div className="text-xs text-blue-400 mb-1 flex items-center justify-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Kalshi
                    </div>
                    <div className={`text-xl font-bold ${kalshiData.isRecentlyUpdated ? 'text-green-400 animate-pulse' : 'text-white'}`}>
                        {(kalshiPrice * 100).toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Spread indicator */}
            {hasArbitrage && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Spread</span>
                        <span className="text-sm font-medium text-green-400">
                            {(spread * 100).toFixed(2)}% opportunity
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
