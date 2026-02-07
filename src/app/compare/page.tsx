'use client';

import { useEffect, useState, useCallback } from 'react';
import { MarketCompareCard, MarketCompareCardSkeleton, SingleMarketCard } from '@/components/MarketCompareCard';
import { ExecuteArbitrageModal } from '@/components';
import { NormalizedMarket, ArbitrageOpportunity } from '@/lib/kalshi/types';
import { useMarketStream } from '@/hooks/useMarketStream';
import { buildTrustMap, fetchTrustSummary, trustKey } from '@/lib/trust/client';
import { TrustSummaryItem, ResolutionAlignmentBreakdown } from '@/lib/trust/types';

interface MatchedMarketPair {
    id: string;
    polymarket: NormalizedMarket;
    kalshi: NormalizedMarket;
    similarity: number;
    arbitrage: ArbitrageOpportunity | null;
    alignmentBreakdown: ResolutionAlignmentBreakdown;
    flagged?: boolean;
}

interface CompareResponse {
    matchedPairs: MatchedMarketPair[];
    unmatchedPolymarket: NormalizedMarket[];
    unmatchedKalshi: NormalizedMarket[];
    polymarketCount: number;
    kalshiCount: number;
    fetchedAt: string;
    matchingMethod?: 'semantic' | 'text';  // Indicates which matching algorithm was used
}

type ViewMode = 'matched' | 'all';

export default function ComparePage() {
    const [data, setData] = useState<CompareResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('matched');
    const [showOnlyArbitrage, setShowOnlyArbitrage] = useState(false);
    const [highConfidenceOnly, setHighConfidenceOnly] = useState(false);
    const [selectedArbitrage, setSelectedArbitrage] = useState<ArbitrageOpportunity | null>(null);
    const [similarityThreshold, setSimilarityThreshold] = useState(0.40); // Default 40%, user can adjust
    const [trustMap, setTrustMap] = useState<Record<string, TrustSummaryItem>>({});
    const [minTrust, setMinTrust] = useState(0);
    const [strictMode, setStrictMode] = useState(false);
    const [alignmentThreshold, setAlignmentThreshold] = useState(0.4);
    const [sortBy, setSortBy] = useState<'similarity' | 'alignment' | 'arbitrage'>('similarity');
    const [flaggedPairs, setFlaggedPairs] = useState<Record<string, boolean>>({});
    const [flaggingPairId, setFlaggingPairId] = useState<string | null>(null);
    const { snapshot, isConnected: streamConnected } = useMarketStream();

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [response, trustItems] = await Promise.all([
                fetch(strictMode ? '/api/markets/compare?strict=true' : '/api/markets/compare'),
                fetchTrustSummary({ platform: 'all', limit: 200 }),
            ]);

            if (!response.ok) {
                throw new Error('Failed to fetch market comparison');
            }

            const result = await response.json();
            setData(result);

            if (trustItems.length > 0) {
                setTrustMap(buildTrustMap(trustItems));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [strictMode]);

    const handleFlagMismatch = useCallback(async (pair: MatchedMarketPair) => {
        if (flaggedPairs[pair.id]) return;
        try {
            setFlaggingPairId(pair.id);
            const response = await fetch('/api/feedback/match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    polymarketId: pair.polymarket.id,
                    kalshiId: pair.kalshi.id,
                    status: 'mismatch',
                    reason: 'user-flag',
                }),
            });
            if (!response.ok) {
                throw new Error('Failed to flag mismatch');
            }
            setFlaggedPairs((prev) => ({ ...prev, [pair.id]: true }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to flag mismatch');
        } finally {
            setFlaggingPairId(null);
        }
    }, [flaggedPairs]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!snapshot?.updatedAt) return;
        fetchData();
    }, [snapshot?.updatedAt, fetchData]);

    // Auto-refresh every 30 seconds if enabled
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchData]);

    // Filter pairs by user-selected similarity threshold
    const visiblePairs = data?.matchedPairs.filter((pair) => !flaggedPairs[pair.id]) || [];
    const thresholdFilteredPairs = visiblePairs.filter(p => p.similarity >= similarityThreshold);
    const confidenceFilteredPairs = highConfidenceOnly
        ? thresholdFilteredPairs.filter(p => p.similarity >= 0.7)
        : thresholdFilteredPairs;
    const alignmentFilteredPairs = alignmentThreshold > 0
        ? confidenceFilteredPairs.filter((pair) => (pair.alignmentBreakdown?.score ?? 0) >= alignmentThreshold)
        : confidenceFilteredPairs;
    const trustFilteredPairs = minTrust > 0
        ? alignmentFilteredPairs.filter((pair) => {
            const polyTrust = trustMap[trustKey('polymarket', pair.polymarket.id)];
            const kalshiTrust = trustMap[trustKey('kalshi', pair.kalshi.id)];
            return Boolean(polyTrust && kalshiTrust && polyTrust.trustScore >= minTrust && kalshiTrust.trustScore >= minTrust);
        })
        : alignmentFilteredPairs;
    const arbitrageCount = trustFilteredPairs.filter(p => p.arbitrage).length;
    const filteredPairs = showOnlyArbitrage
        ? trustFilteredPairs.filter(p => p.arbitrage)
        : trustFilteredPairs;
    const sortedPairs = [...filteredPairs].sort((a, b) => {
        if (sortBy === 'arbitrage') {
            const aProfit = a.arbitrage?.profitPercentage ?? -1;
            const bProfit = b.arbitrage?.profitPercentage ?? -1;
            return bProfit - aProfit;
        }
        if (sortBy === 'alignment') {
            return (b.alignmentBreakdown?.score ?? 0) - (a.alignmentBreakdown?.score ?? 0);
        }
        return b.similarity - a.similarity;
    });
    const alignmentAvg = sortedPairs.length
        ? Math.round(
            (sortedPairs.reduce((sum, pair) => sum + (pair.alignmentBreakdown?.score ?? 0), 0) / sortedPairs.length) * 100
        )
        : 0;
    const lowAlignmentCount = sortedPairs.filter((pair) => (pair.alignmentBreakdown?.score ?? 0) < 0.5).length;
    const unmatchedPolymarket = data?.unmatchedPolymarket || [];
    const unmatchedKalshi = data?.unmatchedKalshi || [];
    const filteredUnmatchedPolymarket = minTrust > 0
        ? unmatchedPolymarket.filter((market) => {
            const trust = trustMap[trustKey('polymarket', market.id)];
            return trust ? trust.trustScore >= minTrust : false;
        })
        : unmatchedPolymarket;
    const filteredUnmatchedKalshi = minTrust > 0
        ? unmatchedKalshi.filter((market) => {
            const trust = trustMap[trustKey('kalshi', market.id)];
            return trust ? trust.trustScore >= minTrust : false;
        })
        : unmatchedKalshi;

    return (
        <div className="min-h-screen terminal-bg">
            {/* Hero Section */}
            <section className="relative overflow-hidden py-16 px-4">
                {/* Background gradient */}
                <div className="absolute inset-0 grid-overlay opacity-30"></div>
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-cyan/10 rounded-full blur-3xl"></div>

                <div className="relative max-w-7xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex -space-x-2">
                            <div className="w-10 h-10 rounded-full bg-brand-500/20 border-2 border-slate-900 flex items-center justify-center">
                                <span className="text-brand-300 font-bold text-sm">P</span>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-accent-cyan/20 border-2 border-slate-900 flex items-center justify-center">
                                <span className="text-accent-cyan font-bold text-sm">K</span>
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                            <span className="bg-gradient-to-r from-brand-300 via-accent-cyan to-brand-200 bg-clip-text text-transparent">
                                Market Comparison
                            </span>
                        </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mb-6 text-xs text-slate-500">
                        <span className={`chip ${streamConnected ? 'chip-active' : ''}`}>
                            Stream {streamConnected ? 'Connected' : 'Offline'}
                        </span>
                        {snapshot?.updatedAt && (
                            <span className="chip">Last snapshot {new Date(snapshot.updatedAt).toLocaleTimeString()}</span>
                        )}
                    </div>
                    <p className="text-lg text-slate-400 max-w-2xl mb-8">
                        Side-by-side comparison of Polymarket and Kalshi markets.
                        Discover price discrepancies and arbitrage opportunities in real-time.
                    </p>

                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-4">
                        <button
                            onClick={fetchData}
                            disabled={isLoading}
                            className="px-6 py-3 bg-gradient-to-r from-brand-500 to-accent-cyan hover:from-brand-600 hover:to-accent-cyan text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-glow-sm"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Refresh
                                </>
                            )}
                        </button>

                        <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
                            />
                            Auto-refresh (30s)
                        </label>

                        <label className="flex items-center gap-2 text-amber-200 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={strictMode}
                                onChange={(e) => setStrictMode(e.target.checked)}
                                className="w-4 h-4 rounded border-amber-400/50 bg-slate-800 text-amber-400 focus:ring-amber-400"
                            />
                            Strict matching (resolution aligned)
                        </label>
                    </div>

                    {/* Similarity Threshold Slider */}
                    <div className="mt-6 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                                <span className="text-white font-medium">Similarity Threshold</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-2xl font-bold ${similarityThreshold >= 0.7 ? 'text-green-400' :
                                    similarityThreshold >= 0.5 ? 'text-yellow-400' :
                                        'text-orange-400'
                                    }`}>
                                    {Math.round(similarityThreshold * 100)}%
                                </span>
                                <span className="text-slate-500 text-sm">
                                    ({trustFilteredPairs.length} pairs)
                                </span>
                            </div>
                        </div>

                        <div className="relative">
                            <input
                                type="range"
                                min="20"
                                max="90"
                                step="5"
                                value={similarityThreshold * 100}
                                onChange={(e) => setSimilarityThreshold(parseInt(e.target.value) / 100)}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                                style={{
                                    background: `linear-gradient(to right, 
                                        rgb(249 115 22) 0%, 
                                        rgb(234 179 8) 40%, 
                                        rgb(34 197 94) 80%, 
                                        rgb(34 197 94) 100%)`
                                }}
                            />
                            <div className="flex justify-between text-xs text-slate-500 mt-2">
                                <span>20% (More matches)</span>
                                <span>90% (Exact matches only)</span>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                            {[
                                { value: 0.30, label: '30%', desc: 'Loose' },
                                { value: 0.40, label: '40%', desc: 'Related' },
                                { value: 0.50, label: '50%', desc: 'Similar' },
                                { value: 0.60, label: '60%', desc: 'Strong' },
                                { value: 0.70, label: '70%', desc: 'Very Similar' },
                                { value: 0.80, label: '80%', desc: 'Near Exact' },
                            ].map((preset) => (
                                <button
                                    key={preset.value}
                                    onClick={() => setSimilarityThreshold(preset.value)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${Math.abs(similarityThreshold - preset.value) < 0.05
                                        ? 'bg-brand-500 text-white'
                                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                                        }`}
                                >
                                    {preset.label}
                                    <span className="ml-1 opacity-70">{preset.desc}</span>
                                </button>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white font-medium">Minimum Trust</span>
                                <span className="text-slate-400 text-sm">{minTrust}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={minTrust}
                                onChange={(e) => setMinTrust(parseInt(e.target.value, 10))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                style={{
                                    background: `linear-gradient(to right, rgb(34 197 94) 0%, rgb(34 197 94) ${minTrust}%, rgb(51 65 85) ${minTrust}%, rgb(51 65 85) 100%)`
                                }}
                            />
                            <div className="flex justify-between text-xs text-slate-500 mt-2">
                                <span>0 (All)</span>
                                <span>100 (Highest)</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-700/50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white font-medium">Resolution Alignment</span>
                                <span className="text-slate-400 text-sm">{Math.round(alignmentThreshold * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="90"
                                step="5"
                                value={Math.round(alignmentThreshold * 100)}
                                onChange={(e) => setAlignmentThreshold(parseInt(e.target.value, 10) / 100)}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                style={{
                                    background: `linear-gradient(to right, rgb(34 197 94) 0%, rgb(34 197 94) ${alignmentThreshold * 100}%, rgb(51 65 85) ${alignmentThreshold * 100}%, rgb(51 65 85) 100%)`
                                }}
                            />
                            <div className="flex justify-between text-xs text-slate-500 mt-2">
                                <span>0% (All)</span>
                                <span>90% (Strict)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            {data && (
                <section className="max-w-7xl mx-auto px-4 py-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 glass">
                            <div className="text-sm text-slate-400 mb-1">Related Pairs</div>
                            <div className="text-2xl font-bold text-white">
                                {trustFilteredPairs.length}
                                <span className="text-sm text-slate-500 font-normal ml-1">
                                    / {data.matchedPairs.length}
                                </span>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-500/20 to-brand-500/20 rounded-xl p-4 border border-emerald-500/30 web3-glow">
                            <div className="text-sm text-emerald-400 mb-1">Arbitrage Found</div>
                            <div className="text-2xl font-bold text-emerald-400 neon-text-green">{arbitrageCount}</div>
                        </div>
                        <div className="bg-brand-500/10 rounded-xl p-4 border border-brand-500/30 web3-glow">
                            <div className="text-sm text-brand-300 mb-1">Polymarket</div>
                            <div className="text-2xl font-bold text-brand-300">{data.polymarketCount}</div>
                        </div>
                        <div className="bg-accent-cyan/10 rounded-xl p-4 border border-accent-cyan/30 web3-glow">
                            <div className="text-sm text-accent-cyan mb-1">Kalshi</div>
                            <div className="text-2xl font-bold text-accent-cyan">{data.kalshiCount}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 glass">
                            <div className="text-sm text-slate-400 mb-1">Last Update</div>
                            <div className="text-lg font-bold text-white">
                                {new Date(data.fetchedAt).toLocaleTimeString()}
                            </div>
                            {/* Matching Method Badge */}
                            <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${data.matchingMethod === 'semantic'
                                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                                    : 'bg-slate-600/20 text-slate-400 border border-slate-500/30'
                                }`}>
                                {data.matchingMethod === 'semantic' ? (
                                    <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                        AI Semantic
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Text Match
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Error */}
            {error && (
                <div className="max-w-7xl mx-auto px-4 mb-6">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                        {error}
                        <button onClick={fetchData} className="ml-4 underline hover:no-underline">
                            Retry
                        </button>
                    </div>
                </div>
            )}

            {/* View Mode Toggle */}
            <section className="max-w-7xl mx-auto px-4 mb-6">
                <div className="sticky top-16 z-20 -mx-4 px-4 py-3 bg-slate-900/85 backdrop-blur border-b border-slate-800/60">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('matched')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'matched'
                                ? 'bg-slate-700 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Related Markets
                        </button>
                        <button
                            onClick={() => setViewMode('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'all'
                                ? 'bg-slate-700 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            All Markets
                        </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={highConfidenceOnly}
                                    onChange={(e) => setHighConfidenceOnly(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
                                />
                                <span className="text-brand-200">High-confidence only (≥ 70%)</span>
                            </label>

                            {viewMode === 'matched' && arbitrageCount > 0 && (
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showOnlyArbitrage}
                                        onChange={(e) => setShowOnlyArbitrage(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500"
                                    />
                                    <span className="text-green-400">Show only arbitrage opportunities</span>
                                </label>
                            )}

                            {viewMode === 'matched' && (
                                <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${lowAlignmentCount > 0
                                        ? 'bg-rose-500/10 text-rose-200 border-rose-500/40'
                                        : 'bg-emerald-500/10 text-emerald-200 border-emerald-500/40'
                                    }`}>
                                    Alignment avg {alignmentAvg}% • Low {lowAlignmentCount}
                                </div>
                            )}

                            {viewMode === 'matched' && (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <span>Sort by</span>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as 'similarity' | 'alignment' | 'arbitrage')}
                                        className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-slate-200"
                                    >
                                        <option value="similarity">Similarity</option>
                                        <option value="alignment">Alignment</option>
                                        <option value="arbitrage">Arbitrage</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Content */}
            <section className="max-w-7xl mx-auto px-4 pb-16">
                {viewMode === 'matched' ? (
                    <>
                        <h2 className="text-2xl font-bold text-white mb-6">
                            {showOnlyArbitrage ? 'Arbitrage Opportunities' : 'Related Market Pairs'}
                            <span className="text-slate-500 font-normal text-lg ml-2">
                                ({filteredPairs.length})
                            </span>
                        </h2>

                        {!showOnlyArbitrage && filteredPairs.length > 0 && (
                            <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm">
                                <div className="flex items-start gap-2">
                                    <span className="text-amber-400">⚠️</span>
                                    <div className="text-amber-200">
                                        <strong>Note:</strong> These are <em>related</em> markets on similar topics, not identical markets.
                                        The two platforms have different resolution criteria and timeframes.
                                        True arbitrage requires markets with the <em>exact same</em> resolution conditions.
                                        {strictMode && (
                                            <span className="ml-2 text-amber-200">
                                                Strict mode filters to higher-resolution alignment.
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {isLoading && !data ? (
                            <div className="space-y-6">
                                {[...Array(4)].map((_, i) => (
                                    <MarketCompareCardSkeleton key={i} />
                                ))}
                            </div>
                        ) : filteredPairs.length > 0 ? (
                            <div className="space-y-6">
                                {sortedPairs.map((pair) => (
                                    <MarketCompareCard
                                        key={pair.id}
                                        polymarket={pair.polymarket}
                                        kalshi={pair.kalshi}
                                        similarity={pair.similarity}
                                        arbitrage={pair.arbitrage}
                                        onExecuteArbitrage={setSelectedArbitrage}
                                        onFlagMismatch={() => handleFlagMismatch(pair)}
                                        flagged={Boolean(pair.flagged || flaggedPairs[pair.id])}
                                        flagging={flaggingPairId === pair.id}
                                        alignmentBreakdown={pair.alignmentBreakdown}
                                        matchingMethod={data?.matchingMethod}
                                        trust={{
                                            polymarket: trustMap[trustKey('polymarket', pair.polymarket.id)],
                                            kalshi: trustMap[trustKey('kalshi', pair.kalshi.id)],
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-slate-800/30 rounded-2xl p-12 text-center border border-slate-700/50">
                                <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">
                                    {showOnlyArbitrage ? 'No Arbitrage Found' : 'No Related Markets Found'}
                                </h3>
                                <p className="text-slate-400 max-w-md mx-auto">
                                    {showOnlyArbitrage
                                        ? 'Markets are currently efficient. Keep scanning - opportunities can appear at any time.'
                                        : 'No topically related markets found between platforms. Browse "All Markets" to see each platform\'s offerings.'}
                                </p>
                            </div>
                        )}
                    </>
                ) : (
                    /* All Markets View */
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Polymarket Column */}
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center">
                                    <span className="text-brand-300 font-bold">P</span>
                                </div>
                                <h2 className="text-xl font-bold text-brand-300">
                                    Polymarket Markets
                                </h2>
                                <span className="text-slate-500">
                                    ({filteredUnmatchedPolymarket.length} unmatched)
                                </span>
                            </div>

                            {isLoading && !data ? (
                                <div className="space-y-4">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="bg-slate-800/50 rounded-xl p-4 animate-pulse">
                                            <div className="h-4 bg-slate-700 rounded w-3/4 mb-3"></div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="h-12 bg-slate-700/50 rounded-lg"></div>
                                                <div className="h-12 bg-slate-700/50 rounded-lg"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredUnmatchedPolymarket.map((market) => (
                                        <SingleMarketCard
                                            key={market.id}
                                            market={market}
                                            platform="polymarket"
                                            trust={trustMap[trustKey('polymarket', market.id)]}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Kalshi Column */}
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
                                    <span className="text-accent-cyan font-bold">K</span>
                                </div>
                                <h2 className="text-xl font-bold text-accent-cyan">
                                    Kalshi Markets
                                </h2>
                                <span className="text-slate-500">
                                    ({filteredUnmatchedKalshi.length} unmatched)
                                </span>
                            </div>

                            {isLoading && !data ? (
                                <div className="space-y-4">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="bg-slate-800/50 rounded-xl p-4 animate-pulse">
                                            <div className="h-4 bg-slate-700 rounded w-3/4 mb-3"></div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="h-12 bg-slate-700/50 rounded-lg"></div>
                                                <div className="h-12 bg-slate-700/50 rounded-lg"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredUnmatchedKalshi.map((market) => (
                                        <SingleMarketCard
                                            key={market.id}
                                            market={market}
                                            platform="kalshi"
                                            trust={trustMap[trustKey('kalshi', market.id)]}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* How It Works */}
            <section className="max-w-7xl mx-auto px-4 pb-16">
                <h2 className="text-2xl font-bold text-white mb-6">How Cross-Platform Comparison Works</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50">
                        <div className="w-10 h-10 bg-brand-500/20 rounded-xl flex items-center justify-center mb-3">
                            <span className="text-brand-300 font-bold">1</span>
                        </div>
                        <h3 className="font-semibold text-white mb-2">Fetch Markets</h3>
                        <p className="text-slate-400 text-sm">
                            Real-time data from Polymarket & Kalshi APIs
                        </p>
                    </div>
                    <div className="bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50">
                        <div className="w-10 h-10 bg-accent-cyan/20 rounded-xl flex items-center justify-center mb-3">
                            <span className="text-accent-cyan font-bold">2</span>
                        </div>
                        <h3 className="font-semibold text-white mb-2">Match Markets</h3>
                        <p className="text-slate-400 text-sm">
                            AI-powered matching using question similarity
                        </p>
                    </div>
                    <div className="bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50">
                        <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center mb-3">
                            <span className="text-green-400 font-bold">3</span>
                        </div>
                        <h3 className="font-semibold text-white mb-2">Find Arbitrage</h3>
                        <p className="text-slate-400 text-sm">
                            Detect when Yes + No costs &lt; $1 across platforms
                        </p>
                    </div>
                    <div className="bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-3">
                            <span className="text-emerald-400 font-bold">4</span>
                        </div>
                        <h3 className="font-semibold text-white mb-2">Execute Trades</h3>
                        <p className="text-slate-400 text-sm">
                            Lock in guaranteed profits by buying both sides
                        </p>
                    </div>
                </div>
            </section>

            {/* Execute Modal */}
            {selectedArbitrage && (
                <ExecuteArbitrageModal
                    opportunity={selectedArbitrage}
                    isOpen={!!selectedArbitrage}
                    onClose={() => setSelectedArbitrage(null)}
                />
            )}
        </div>
    );
}
