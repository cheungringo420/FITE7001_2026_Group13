'use client';

import { NormalizedMarket, ArbitrageOpportunity } from '@/lib/kalshi/types';
import { TrustSummaryItem, ResolutionAlignmentBreakdown } from '@/lib/trust/types';
import { TrustBadge } from './TrustBadge';

interface MarketCompareCardProps {
    polymarket: NormalizedMarket;
    kalshi: NormalizedMarket;
    similarity: number;
    arbitrage: ArbitrageOpportunity | null;
    onExecuteArbitrage?: (arbitrage: ArbitrageOpportunity) => void;
    onFlagMismatch?: () => void;
    flagged?: boolean;
    flagging?: boolean;
    alignmentBreakdown?: ResolutionAlignmentBreakdown;
    matchingMethod?: 'semantic' | 'text';
    trust?: {
        polymarket?: TrustSummaryItem;
        kalshi?: TrustSummaryItem;
    };
}

export function MarketCompareCard({
    polymarket,
    kalshi,
    similarity,
    arbitrage,
    onExecuteArbitrage,
    onFlagMismatch,
    flagged,
    flagging,
    alignmentBreakdown,
    matchingMethod,
    trust,
}: MarketCompareCardProps) {
    const formatVolume = (volume: number) => {
        if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
        if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
        return `$${volume.toFixed(0)}`;
    };

    const priceDiffYes = ((polymarket.yesPrice - kalshi.yesPrice) * 100).toFixed(1);
    const priceDiffNo = ((polymarket.noPrice - kalshi.noPrice) * 100).toFixed(1);
    const matchTier = similarity >= 0.75 ? 'high' : similarity >= 0.6 ? 'medium' : 'low';
    const matchLabel = matchTier === 'high' ? 'High confidence' : matchTier === 'medium' ? 'Related' : 'Loose match';
    const alignmentScore = alignmentBreakdown?.score ?? 0;

    return (
        <div className={`relative rounded-2xl border transition-all duration-300 overflow-hidden ${arbitrage
                ? 'bg-gradient-to-br from-emerald-900/30 via-slate-900 to-brand-900/30 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                : 'bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50 hover:border-slate-600'
            }`}>
            {/* Arbitrage Badge */}
            {arbitrage && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-400 to-brand-400 text-black font-bold px-4 py-1 text-sm rounded-bl-xl">
                    💰 +{arbitrage.profitPercentage.toFixed(2)}% Arbitrage
                </div>
            )}

            {/* Header - Show both market questions */}
            <div className="p-5 border-b border-slate-700/50">
                <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                        <div className="text-xs text-brand-300 font-medium mb-1 flex items-center gap-1">
                            <span className="w-4 h-4 rounded bg-brand-500/20 flex items-center justify-center text-[10px] font-bold">P</span>
                            Polymarket
                        </div>
                        <h3 className="text-sm font-medium text-white line-clamp-2">
                            {polymarket.question}
                        </h3>
                        {trust?.polymarket && (
                            <div className="mt-2">
                                <TrustBadge score={trust.polymarket.trustScore} compact />
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="text-xs text-accent-cyan font-medium mb-1 flex items-center gap-1">
                            <span className="w-4 h-4 rounded bg-accent-cyan/20 flex items-center justify-center text-[10px] font-bold">K</span>
                            Kalshi
                        </div>
                        <h3 className="text-sm font-medium text-white line-clamp-2">
                            {kalshi.question}
                        </h3>
                        {trust?.kalshi && (
                            <div className="mt-2">
                                <TrustBadge score={trust.kalshi.trustScore} compact />
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-300">
                        {polymarket.category || 'General'}
                    </span>
                    <span className={`px-2 py-0.5 rounded border text-xs ${matchTier === 'high'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : matchTier === 'medium'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-slate-700/40 text-slate-400 border-slate-600/40'
                        }`}>
                        {matchLabel}
                    </span>
                    <span className={`px-2 py-0.5 rounded ${similarity >= 0.6 ? 'bg-green-500/20 text-green-400' :
                            similarity >= 0.45 ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-slate-600/50 text-slate-400'
                        }`}>
                        {similarity >= 0.6 ? '🎯' : similarity >= 0.45 ? '🔗' : '💡'} {(similarity * 100).toFixed(0)}% similar
                    </span>
                    {alignmentBreakdown && (
                        <span className={`px-2 py-0.5 rounded ${alignmentScore >= 0.7 ? 'bg-emerald-500/15 text-emerald-300' :
                                alignmentScore >= 0.5 ? 'bg-amber-500/15 text-amber-300' :
                                    'bg-rose-500/15 text-rose-300'
                            }`}>
                            🧭 {Math.round(alignmentScore * 100)}% aligned
                        </span>
                    )}
                    <div className="relative ml-auto text-xs text-slate-400 group">
                        <span className="underline decoration-dotted cursor-help">Why this match?</span>
                        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-700/60 bg-slate-900/95 p-3 text-[11px] text-slate-300 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                            <div className="font-semibold text-slate-200 mb-1">Match rationale</div>
                            <div>Score blends semantic/text similarity, category alignment, and resolution criteria alignment.</div>
                            {matchingMethod && (
                                <div className="mt-1 text-slate-400">
                                    Method: {matchingMethod === 'semantic' ? 'AI semantic' : 'Text match'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {onFlagMismatch && (
                    <div className="mt-3 flex justify-end">
                        <button
                            onClick={onFlagMismatch}
                            disabled={flagged || flagging}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${flagged
                                    ? 'bg-red-500/10 text-red-300 border-red-500/40 cursor-not-allowed'
                                    : 'bg-slate-800/60 text-slate-300 border-slate-600/60 hover:bg-slate-700/60 hover:text-white'
                                }`}
                        >
                            {flagging ? 'Flagging...' : flagged ? 'Flagged mismatch' : 'Flag mismatch'}
                        </button>
                    </div>
                )}
            </div>

            {alignmentBreakdown && (
                <div className="px-5 pb-5">
                    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400">Resolution Alignment Breakdown</span>
                            <span className={`text-xs font-semibold ${alignmentScore >= 0.7 ? 'text-emerald-300' :
                                    alignmentScore >= 0.5 ? 'text-amber-300' :
                                        'text-rose-300'
                                }`}>
                                {Math.round(alignmentScore * 100)}%
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            <div className={`flex items-center justify-between p-2 rounded border ${alignmentBreakdown.criteria.explicitDate.match
                                    ? 'border-emerald-500/30 bg-emerald-500/10'
                                    : 'border-slate-700/50 bg-slate-800/40'
                                }`}>
                                <span>Explicit date</span>
                                <span className="text-slate-400">
                                    {alignmentBreakdown.criteria.explicitDate.polymarket ? 'Yes' : 'No'} / {alignmentBreakdown.criteria.explicitDate.kalshi ? 'Yes' : 'No'}
                                </span>
                            </div>
                            <div className={`flex items-center justify-between p-2 rounded border ${alignmentBreakdown.criteria.objectiveThreshold.match
                                    ? 'border-emerald-500/30 bg-emerald-500/10'
                                    : 'border-slate-700/50 bg-slate-800/40'
                                }`}>
                                <span>Objective threshold</span>
                                <span className="text-slate-400">
                                    {alignmentBreakdown.criteria.objectiveThreshold.polymarket ? 'Yes' : 'No'} / {alignmentBreakdown.criteria.objectiveThreshold.kalshi ? 'Yes' : 'No'}
                                </span>
                            </div>
                            <div className={`flex items-center justify-between p-2 rounded border ${alignmentBreakdown.criteria.resolutionWording.match
                                    ? 'border-emerald-500/30 bg-emerald-500/10'
                                    : 'border-slate-700/50 bg-slate-800/40'
                                }`}>
                                <span>Resolution wording</span>
                                <span className="text-slate-400">
                                    {alignmentBreakdown.criteria.resolutionWording.polymarket ? 'Yes' : 'No'} / {alignmentBreakdown.criteria.resolutionWording.kalshi ? 'Yes' : 'No'}
                                </span>
                            </div>
                            <div className={`flex items-center justify-between p-2 rounded border ${alignmentBreakdown.criteria.timeWindow.match
                                    ? 'border-emerald-500/30 bg-emerald-500/10'
                                    : 'border-slate-700/50 bg-slate-800/40'
                                }`}>
                                <span>Time window</span>
                                <span className="text-slate-400">
                                    {alignmentBreakdown.criteria.timeWindow.polymarket || '—'} / {alignmentBreakdown.criteria.timeWindow.kalshi || '—'}
                                </span>
                            </div>
                            <div className={`flex items-center justify-between p-2 rounded border ${alignmentBreakdown.criteria.ambiguityFlags.match
                                    ? 'border-emerald-500/30 bg-emerald-500/10'
                                    : 'border-slate-700/50 bg-slate-800/40'
                                }`}>
                                <span>Ambiguity flags</span>
                                <span className="text-slate-400">
                                    {(alignmentBreakdown.criteria.ambiguityFlags.polymarket[0] || 'none')} / {(alignmentBreakdown.criteria.ambiguityFlags.kalshi[0] || 'none')}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded border border-slate-700/50 bg-slate-800/40">
                                <span>Clarity score</span>
                                <span className="text-slate-400">
                                    {Math.round(alignmentBreakdown.clarity.polymarket * 100)} / {Math.round(alignmentBreakdown.clarity.kalshi * 100)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                            <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center group-hover:bg-brand-500/30 transition-colors">
                                <span className="text-brand-300 font-bold text-sm">P</span>
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-brand-300 group-hover:text-brand-200 transition-colors flex items-center gap-1">
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
                            <span className={`text-lg font-bold ${arbitrage?.strategy === 'buy-yes-a-no-b' && arbitrage.platform1.name === 'polymarket'
                                    ? 'text-green-400 animate-pulse'
                                    : 'text-green-400'
                                }`}>
                                {(polymarket.yesPrice * 100).toFixed(1)}¢
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-400">No</span>
                            <span className={`text-lg font-bold ${arbitrage?.strategy === 'buy-no-a-yes-b' && arbitrage.platform1.name === 'polymarket'
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
                                    className="block text-xs text-brand-300/70 hover:text-brand-300 truncate transition-colors"
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
                            <div className="w-8 h-8 rounded-lg bg-accent-cyan/20 flex items-center justify-center group-hover:bg-accent-cyan/30 transition-colors">
                                <span className="text-accent-cyan font-bold text-sm">K</span>
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-accent-cyan group-hover:text-accent-cyan transition-colors flex items-center gap-1">
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
                                <span className={`text-lg font-bold ${arbitrage?.strategy === 'buy-no-a-yes-b' && arbitrage.platform2.name === 'kalshi'
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
                                <span className={`text-lg font-bold ${arbitrage?.strategy === 'buy-yes-a-no-b' && arbitrage.platform2.name === 'kalshi'
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
                                    className="block text-xs text-accent-cyan/70 hover:text-accent-cyan truncate transition-colors"
                                    title={kalshi.url}
                                >
                                    🔗 {kalshi.url.replace('https://', '')}
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Arbitrage Strategy - Always show, but dim if no opportunity */}
            <div className={`p-4 border-t ${arbitrage
                    ? 'bg-green-500/5 border-green-500/30'
                    : 'bg-slate-800/30 border-slate-700/30'
                }`}>
                <div className="flex items-center justify-between">
                    <div className={arbitrage ? '' : 'opacity-60'}>
                        <div className={`text-sm font-semibold mb-1 ${arbitrage ? 'text-green-400' : 'text-slate-400'
                            }`}>
                            {arbitrage ? '📋 Arbitrage Strategy' : '📊 Potential Arbitrage Analysis'}
                        </div>
                        {arbitrage ? (
                            <>
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
                            </>
                        ) : (
                            <>
                                <div className="text-sm text-slate-400">
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                        <span>
                                            Strategy A: <span className="text-green-400/70">YES</span>@P + <span className="text-red-400/70">NO</span>@K = {((polymarket.yesPrice + kalshi.noPrice) * 100).toFixed(1)}¢
                                            {polymarket.yesPrice + kalshi.noPrice < 1
                                                ? <span className="text-green-400 ml-1">✓</span>
                                                : <span className="text-slate-500 ml-1">({((polymarket.yesPrice + kalshi.noPrice - 1) * 100).toFixed(1)}¢ over)</span>
                                            }
                                        </span>
                                        <span>
                                            Strategy B: <span className="text-red-400/70">NO</span>@P + <span className="text-green-400/70">YES</span>@K = {((polymarket.noPrice + kalshi.yesPrice) * 100).toFixed(1)}¢
                                            {polymarket.noPrice + kalshi.yesPrice < 1
                                                ? <span className="text-green-400 ml-1">✓</span>
                                                : <span className="text-slate-500 ml-1">({((polymarket.noPrice + kalshi.yesPrice - 1) * 100).toFixed(1)}¢ over)</span>
                                            }
                                        </span>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    💡 Need total cost &lt; 100¢ for arbitrage. Watch for price changes.
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={() => arbitrage && onExecuteArbitrage && onExecuteArbitrage(arbitrage)}
                        disabled={!arbitrage}
                        className={`px-4 py-2 font-semibold rounded-lg transition-colors text-sm whitespace-nowrap ${arbitrage
                                ? 'bg-green-500 hover:bg-green-600 text-black cursor-pointer'
                                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        {arbitrage ? 'Execute' : 'No Opportunity'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Single platform market card (unmatched)
interface SingleMarketCardProps {
    market: NormalizedMarket;
    platform: 'polymarket' | 'kalshi';
    trust?: TrustSummaryItem;
}

export function SingleMarketCard({ market, platform, trust }: SingleMarketCardProps) {
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
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${isPoly ? 'bg-brand-500/20' : 'bg-accent-cyan/20'
                        }`}>
                        <span className={`font-bold text-xs ${isPoly ? 'text-brand-300' : 'text-accent-cyan'}`}>
                            {isPoly ? 'P' : 'K'}
                        </span>
                    </div>
                    <span className={`text-xs font-medium ${isPoly ? 'text-brand-300' : 'text-accent-cyan'}`}>
                        {isPoly ? 'Polymarket' : 'Kalshi'}
                    </span>
                </div>
                {trust && <TrustBadge score={trust.trustScore} compact />}
                {market.url && (
                    <a
                        href={market.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity ${isPoly ? 'text-brand-300 hover:text-brand-200' : 'text-accent-cyan hover:text-accent-cyan'
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
                    className={`block text-xs truncate text-center transition-colors ${isPoly
                            ? 'text-brand-300/60 hover:text-brand-300'
                            : 'text-accent-cyan/60 hover:text-accent-cyan'
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
