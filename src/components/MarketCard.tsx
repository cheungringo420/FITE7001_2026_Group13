'use client';

import { ParsedMarket } from '@/lib/polymarket/types';
import { TrustSummaryItem } from '@/lib/trust/types';
import { TrustBadge } from './TrustBadge';
import Link from 'next/link';
import Image from 'next/image';

interface MarketCardProps {
    market: ParsedMarket;
    trust?: TrustSummaryItem;
}

export function MarketCard({ market, trust }: MarketCardProps) {
    const yesPrice = market.outcomePrices[0] || 0;
    const noPrice = market.outcomePrices[1] || 0;
    const externalUrl = market.events?.[0]?.slug || market.slug
        ? `https://polymarket.com/event/${market.events?.[0]?.slug || market.slug}`
        : undefined;

    // Format volume with K/M suffix
    const formatVolume = (volume: string | number) => {
        const num = typeof volume === 'string' ? parseFloat(volume) : volume;
        if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
        return `$${num.toFixed(0)}`;
    };

    return (
        <Link href={`/market/${market.conditionId}`} className="block">
            <div className="market-card group relative web3-card rounded-2xl p-5 hover:shadow-2xl cursor-pointer transform hover:scale-[1.01]">
                {/* Platform Badge + Live indicator */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-brand-500/10 border border-brand-500/30">
                        <span className="w-4 h-4 rounded bg-brand-500/30 text-brand-300 text-[10px] flex items-center justify-center font-bold">P</span>
                        <span className="text-xs text-brand-300 font-medium">Polymarket</span>
                    </span>
                    {market.active && !market.closed && (
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="text-xs text-green-400 font-medium">LIVE</span>
                        </div>
                    )}
                </div>

                {/* Market Image */}
                {market.image && (
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden mb-4 ring-2 ring-brand-500/30 group-hover:ring-brand-500/50 transition-all">
                        <Image
                            src={market.image}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                        />
                    </div>
                )}

                {/* Question */}
                <h3 className="text-white font-medium text-lg mb-4 line-clamp-2 group-hover:text-brand-200 transition-colors" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                    {market.question}
                </h3>

                {/* Trust Snapshot */}
                {trust && (
                    <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
                        <TrustBadge score={trust.trustScore} />
                        <span className="text-slate-500">
                            Dispute {trust.disputeRisk}%
                        </span>
                    </div>
                )}

                {/* Yes/No Prices */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20">
                        <div className="text-xs text-green-400 mb-1 font-medium">Yes</div>
                        <div className="text-2xl font-bold text-green-400">
                            {(yesPrice * 100).toFixed(1)}¢
                        </div>
                    </div>
                    <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                        <div className="text-xs text-red-400 mb-1 font-medium">No</div>
                        <div className="text-2xl font-bold text-red-400">
                            {(noPrice * 100).toFixed(1)}¢
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
                        {externalUrl && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(externalUrl, '_blank', 'noopener,noreferrer');
                                }}
                                className="text-brand-300 hover:text-brand-200 text-xs flex items-center gap-1"
                                title="Open on Polymarket"
                            >
                                Polymarket
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </button>
                        )}
                        <span className="text-brand-300">
                            View →
                        </span>
                    </div>
                </div>

                {/* Category Badge */}
                {market.category && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <span className="px-2 py-1 rounded-full text-xs bg-brand-500/10 text-brand-300 border border-brand-500/20">
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
