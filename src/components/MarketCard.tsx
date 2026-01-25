'use client';

import { ParsedMarket } from '@/lib/polymarket/types';
import Link from 'next/link';

interface MarketCardProps {
    market: ParsedMarket;
}

export function MarketCard({ market }: MarketCardProps) {
    const yesPrice = market.outcomePrices[0] || 0;
    const noPrice = market.outcomePrices[1] || 0;

    // Format volume with K/M suffix
    const formatVolume = (volume: string | number) => {
        const num = typeof volume === 'string' ? parseFloat(volume) : volume;
        if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
        return `$${num.toFixed(0)}`;
    };

    return (
        <Link href={`/market/${market.conditionId}`}>
            <div className="market-card group relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 cursor-pointer">
                {/* Live indicator */}
                {market.active && !market.closed && (
                    <div className="absolute top-4 right-4 flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-xs text-green-400 font-medium">LIVE</span>
                    </div>
                )}

                {/* Market Image */}
                {market.image && (
                    <div className="w-12 h-12 rounded-xl overflow-hidden mb-4 ring-2 ring-slate-700 group-hover:ring-purple-500/50 transition-all">
                        <img
                            src={market.image}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}

                {/* Question */}
                <h3 className="text-white font-semibold text-lg mb-4 line-clamp-2 group-hover:text-purple-200 transition-colors">
                    {market.question}
                </h3>

                {/* Yes/No Prices */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20">
                        <div className="text-xs text-green-400 mb-1 font-medium">Yes</div>
                        <div className="text-2xl font-bold text-green-400">
                            {(yesPrice * 100).toFixed(0)}¢
                        </div>
                    </div>
                    <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                        <div className="text-xs text-red-400 mb-1 font-medium">No</div>
                        <div className="text-2xl font-bold text-red-400">
                            {(noPrice * 100).toFixed(0)}¢
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-slate-400">
                    <div className="flex items-center gap-4">
                        <div>
                            <span className="text-slate-500">Vol: </span>
                            <span className="text-slate-300">{formatVolume(market.volume)}</span>
                        </div>
                        {market.volume24hr > 0 && (
                            <div>
                                <span className="text-slate-500">24h: </span>
                                <span className="text-slate-300">{formatVolume(market.volume24hr)}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {(market.events?.[0]?.slug || market.slug) && (
                            <a
                                href={`https://polymarket.com/event/${market.events?.[0]?.slug || market.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="relative text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="⚠️ May be geo-restricted in some regions. Data is fetched via API regardless."
                            >
                                Polymarket
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        )}
                        <span className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            View →
                        </span>
                    </div>
                </div>

                {/* Category Badge */}
                {market.category && (
                    <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="px-2 py-1 rounded-full text-xs bg-slate-700/50 text-slate-300">
                            {market.category}
                        </span>
                    </div>
                )}
            </div>
        </Link>
    );
}

export function MarketCardSkeleton() {
    return (
        <div className="market-card bg-slate-800/50 rounded-2xl p-5 animate-pulse">
            <div className="w-12 h-12 rounded-xl bg-slate-700 mb-4"></div>
            <div className="h-6 bg-slate-700 rounded mb-2 w-3/4"></div>
            <div className="h-6 bg-slate-700 rounded mb-4 w-1/2"></div>
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="h-20 bg-slate-700/50 rounded-xl"></div>
                <div className="h-20 bg-slate-700/50 rounded-xl"></div>
            </div>
            <div className="h-4 bg-slate-700 rounded w-1/3"></div>
        </div>
    );
}
