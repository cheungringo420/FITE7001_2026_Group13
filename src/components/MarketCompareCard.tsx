'use client';

import { NormalizedMarket, ArbitrageOpportunity } from '@/lib/kalshi/types';

interface MarketCompareCardProps {
    polymarket: NormalizedMarket;
    kalshi: NormalizedMarket;
    similarity: number;
    arbitrage: ArbitrageOpportunity | null;
    onExecuteArbitrage?: (arbitrage: ArbitrageOpportunity) => void;
}

export function MarketCompareCard({
    polymarket,
    kalshi,
    similarity,
    arbitrage,
    onExecuteArbitrage,
}: MarketCompareCardProps) {
    const formatVolume = (volume: number) => {
        if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
        if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
        return `$${volume.toFixed(0)}`;
    };

    const priceDiffYes = ((polymarket.yesPrice - kalshi.yesPrice) * 100).toFixed(1);
    const priceDiffNo = ((polymarket.noPrice - kalshi.noPrice) * 100).toFixed(1);

    return (
        <div className={`relative rounded-2xl border transition-all duration-300 overflow-hidden ${
            arbitrage 
                ? 'bg-gradient-to-br from-green-900/30 via-slate-900 to-emerald-900/30 border-green-500/50 shadow-lg shadow-green-500/10' 
                : 'bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50 hover:border-slate-600'
        }`}>
            {/* Arbitrage Badge */}
            {arbitrage && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-green-500 to-emerald-500 text-black font-bold px-4 py-1 text-sm rounded-bl-xl">
                    💰 +{arbitrage.profitPercentage.toFixed(2)}% Arbitrage
                </div>
            )}

            {/* Header - Show both market questions */}
            <div className="p-5 border-b border-slate-700/50">
                <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                        <div className="text-xs text-purple-400 font-medium mb-1 flex items-center gap-1">
                            <span className="w-4 h-4 rounded bg-purple-500/20 flex items-center justify-center text-[10px] font-bold">P</span>
                            Polymarket
                        </div>
                        <h3 className="text-sm font-medium text-white line-clamp-2">
                            {polymarket.question}
                        </h3>
                    </div>
                    <div>
                        <div className="text-xs text-blue-400 font-medium mb-1 flex items-center gap-1">
                            <span className="w-4 h-4 rounded bg-blue-500/20 flex items-center justify-center text-[10px] font-bold">K</span>
                            Kalshi
                        </div>
                        <h3 className="text-sm font-medium text-white line-clamp-2">
                            {kalshi.question}
                        </h3>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-300">
                        {polymarket.category || 'General'}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${
                        similarity >= 0.6 ? 'bg-green-500/20 text-green-400' :
                        similarity >= 0.45 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-600/50 text-slate-400'
                    }`}>
                        {similarity >= 0.6 ? '🎯' : similarity >= 0.45 ? '🔗' : '💡'} {(similarity * 100).toFixed(0)}% similar
                    </span>
                </div>
            </div>

            {/* Side by Side Comparison */}
            <div className="grid grid-cols-2 divide-x divide-slate-700/50">
                {/* Polymarket Side */}
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <a 
                            href={polymarket.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                                <span className="text-purple-400 font-bold text-sm">P</span>
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-purple-400 group-hover:text-purple-300 transition-colors flex items-center gap-1">
                                    Polymarket
                                    <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </div>
                                <div className="text-xs text-slate-500">Decentralized</div>
                            </div>
                        </a>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">Yes</span>
                            <span className={`text-lg font-bold ${
                                arbitrage?.strategy === 'buy-yes-a-no-b' && arbitrage.platform1.name === 'polymarket'
                                    ? 'text-green-400 animate-pulse'
                                    : 'text-green-400'
                            }`}>
                                {(polymarket.yesPrice * 100).toFixed(1)}¢
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">No</span>
                            <span className={`text-lg font-bold ${
                                arbitrage?.strategy === 'buy-no-a-yes-b' && arbitrage.platform1.name === 'polymarket'
                                    ? 'text-red-400 animate-pulse'
                                    : 'text-red-400'
                            }`}>
                                {(polymarket.noPrice * 100).toFixed(1)}¢
                            </span>
                        </div>
                        <div className="pt-2 border-t border-slate-700/50 space-y-1">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>24h Vol</span>
                                <span className="text-slate-300">{formatVolume(polymarket.volume24h)}</span>
                            </div>
                            {polymarket.url && (
                                <a
                                    href={polymarket.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-xs text-purple-400/70 hover:text-purple-400 truncate transition-colors"
                                    title={polymarket.url}
                                >
                                    🔗 {polymarket.url.replace('https://', '')}
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Kalshi Side */}
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <a 
                            href={kalshi.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                                <span className="text-blue-400 font-bold text-sm">K</span>
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-blue-400 group-hover:text-blue-300 transition-colors flex items-center gap-1">
                                    Kalshi
                                    <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </div>
                                <div className="text-xs text-slate-500">Regulated US</div>
                            </div>
                        </a>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">Yes</span>
                            <div className="flex items-center gap-2">
                                <span className={`text-lg font-bold ${
                                    arbitrage?.strategy === 'buy-no-a-yes-b' && arbitrage.platform2.name === 'kalshi'
                                        ? 'text-green-400 animate-pulse'
                                        : 'text-green-400'
                                }`}>
                                    {(kalshi.yesPrice * 100).toFixed(1)}¢
                                </span>
                                {parseFloat(priceDiffYes) !== 0 && (
                                    <span className={`text-xs ${parseFloat(priceDiffYes) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {parseFloat(priceDiffYes) > 0 ? '▲' : '▼'} {Math.abs(parseFloat(priceDiffYes))}¢
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">No</span>
                            <div className="flex items-center gap-2">
                                <span className={`text-lg font-bold ${
                                    arbitrage?.strategy === 'buy-yes-a-no-b' && arbitrage.platform2.name === 'kalshi'
                                        ? 'text-red-400 animate-pulse'
                                        : 'text-red-400'
                                }`}>
                                    {(kalshi.noPrice * 100).toFixed(1)}¢
                                </span>
                                {parseFloat(priceDiffNo) !== 0 && (
                                    <span className={`text-xs ${parseFloat(priceDiffNo) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {parseFloat(priceDiffNo) > 0 ? '▲' : '▼'} {Math.abs(parseFloat(priceDiffNo))}¢
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="pt-2 border-t border-slate-700/50 space-y-1">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>24h Vol</span>
                                <span className="text-slate-300">{formatVolume(kalshi.volume24h)}</span>
                            </div>
                            {kalshi.url && (
                                <a
                                    href={kalshi.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-xs text-blue-400/70 hover:text-blue-400 truncate transition-colors"
                                    title={kalshi.url}
                                >
                                    🔗 {kalshi.url.replace('https://', '')}
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Arbitrage Strategy */}
            {arbitrage && (
                <div className="p-4 bg-green-500/5 border-t border-green-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-green-400 font-semibold mb-1">
                                📋 Arbitrage Strategy
                            </div>
                            <div className="text-sm text-slate-300">
                                {arbitrage.strategy === 'buy-yes-a-no-b' ? (
                                    <>
                                        Buy <span className="text-green-400 font-semibold">YES</span> on {arbitrage.platform1.name === 'polymarket' ? 'Polymarket' : 'Kalshi'} @ {(arbitrage.platform1.yesPrice * 100).toFixed(1)}¢
                                        {' + '}
                                        Buy <span className="text-red-400 font-semibold">NO</span> on {arbitrage.platform2.name === 'polymarket' ? 'Polymarket' : 'Kalshi'} @ {(arbitrage.platform2.noPrice * 100).toFixed(1)}¢
                                    </>
                                ) : (
                                    <>
                                        Buy <span className="text-red-400 font-semibold">NO</span> on {arbitrage.platform1.name === 'polymarket' ? 'Polymarket' : 'Kalshi'} @ {(arbitrage.platform1.noPrice * 100).toFixed(1)}¢
                                        {' + '}
                                        Buy <span className="text-green-400 font-semibold">YES</span> on {arbitrage.platform2.name === 'polymarket' ? 'Polymarket' : 'Kalshi'} @ {(arbitrage.platform2.yesPrice * 100).toFixed(1)}¢
                                    </>
                                )}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                                Cost: ${arbitrage.totalCost.toFixed(4)} → Payout: $1.00 = <span className="text-green-400">${arbitrage.guaranteedProfit.toFixed(4)} profit</span>
                            </div>
                        </div>
                        {onExecuteArbitrage && (
                            <button
                                onClick={() => onExecuteArbitrage(arbitrage)}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-black font-semibold rounded-lg transition-colors text-sm whitespace-nowrap"
                            >
                                Execute
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Single platform market card (unmatched)
interface SingleMarketCardProps {
    market: NormalizedMarket;
    platform: 'polymarket' | 'kalshi';
}

export function SingleMarketCard({ market, platform }: SingleMarketCardProps) {
    const formatVolume = (volume: number) => {
        if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
        if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
        return `$${volume.toFixed(0)}`;
    };

    const isPoly = platform === 'polymarket';

    return (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${
                        isPoly ? 'bg-purple-500/20' : 'bg-blue-500/20'
                    }`}>
                        <span className={`font-bold text-xs ${isPoly ? 'text-purple-400' : 'text-blue-400'}`}>
                            {isPoly ? 'P' : 'K'}
                        </span>
                    </div>
                    <span className={`text-xs font-medium ${isPoly ? 'text-purple-400' : 'text-blue-400'}`}>
                        {isPoly ? 'Polymarket' : 'Kalshi'}
                    </span>
                </div>
                {market.url && (
                    <a
                        href={market.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity ${
                            isPoly ? 'text-purple-400 hover:text-purple-300' : 'text-blue-400 hover:text-blue-300'
                        }`}
                        title={`Open on ${isPoly ? 'Polymarket' : 'Kalshi'}`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                )}
            </div>

            <h4 className="text-sm font-medium text-white mb-3 line-clamp-2">
                {market.question}
            </h4>

            <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="text-center p-2 bg-green-500/10 rounded-lg">
                    <div className="text-xs text-green-400">Yes</div>
                    <div className="text-sm font-bold text-green-400">
                        {(market.yesPrice * 100).toFixed(1)}¢
                    </div>
                </div>
                <div className="text-center p-2 bg-red-500/10 rounded-lg">
                    <div className="text-xs text-red-400">No</div>
                    <div className="text-sm font-bold text-red-400">
                        {(market.noPrice * 100).toFixed(1)}¢
                    </div>
                </div>
            </div>

            <div className="text-xs text-slate-500 text-center mb-2">
                Vol: {formatVolume(market.volume24h)}
            </div>

            {market.url && (
                <a
                    href={market.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block text-xs truncate text-center transition-colors ${
                        isPoly 
                            ? 'text-purple-400/60 hover:text-purple-400' 
                            : 'text-blue-400/60 hover:text-blue-400'
                    }`}
                    title={market.url}
                >
                    🔗 {market.url.replace('https://', '')}
                </a>
            )}
        </div>
    );
}

export function MarketCompareCardSkeleton() {
    return (
        <div className="bg-slate-800/50 rounded-2xl animate-pulse">
            <div className="p-5 border-b border-slate-700/50">
                <div className="h-6 bg-slate-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-slate-700 rounded w-1/4"></div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-700/50">
                <div className="p-4">
                    <div className="h-8 bg-slate-700 rounded w-24 mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-6 bg-slate-700/50 rounded"></div>
                        <div className="h-6 bg-slate-700/50 rounded"></div>
                    </div>
                </div>
                <div className="p-4">
                    <div className="h-8 bg-slate-700 rounded w-24 mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-6 bg-slate-700/50 rounded"></div>
                        <div className="h-6 bg-slate-700/50 rounded"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
