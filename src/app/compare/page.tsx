'use client';

import { useEffect, useState, useCallback } from 'react';
import { MarketCompareCard, MarketCompareCardSkeleton, SingleMarketCard } from '@/components/MarketCompareCard';
import { ExecuteArbitrageModal } from '@/components';
import { NormalizedMarket, ArbitrageOpportunity } from '@/lib/kalshi/types';

interface MatchedMarketPair {
    id: string;
    polymarket: NormalizedMarket;
    kalshi: NormalizedMarket;
    similarity: number;
    arbitrage: ArbitrageOpportunity | null;
}

interface CompareResponse {
    matchedPairs: MatchedMarketPair[];
    unmatchedPolymarket: NormalizedMarket[];
    unmatchedKalshi: NormalizedMarket[];
    polymarketCount: number;
    kalshiCount: number;
    fetchedAt: string;
}

type ViewMode = 'matched' | 'all';

export default function ComparePage() {
    const [data, setData] = useState<CompareResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('matched');
    const [showOnlyArbitrage, setShowOnlyArbitrage] = useState(false);
    const [selectedArbitrage, setSelectedArbitrage] = useState<ArbitrageOpportunity | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch('/api/markets/compare');

            if (!response.ok) {
                throw new Error('Failed to fetch market comparison');
            }

            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Auto-refresh every 30 seconds if enabled
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchData]);

    const arbitrageCount = data?.matchedPairs.filter(p => p.arbitrage).length || 0;
    const filteredPairs = showOnlyArbitrage 
        ? data?.matchedPairs.filter(p => p.arbitrage) || []
        : data?.matchedPairs || [];

    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            <section className="relative overflow-hidden py-16 px-4">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-950 to-blue-900/20"></div>
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>

                <div className="relative max-w-7xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex -space-x-2">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 border-2 border-slate-900 flex items-center justify-center">
                                <span className="text-purple-400 font-bold text-sm">P</span>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 border-2 border-slate-900 flex items-center justify-center">
                                <span className="text-blue-400 font-bold text-sm">K</span>
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold">
                            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                                Market Comparison
                            </span>
                        </h1>
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
                            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                            />
                            Auto-refresh (30s)
                        </label>
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            {data && (
                <section className="max-w-7xl mx-auto px-4 py-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                            <div className="text-sm text-slate-400 mb-1">Related Pairs</div>
                            <div className="text-2xl font-bold text-white">{data.matchedPairs.length}</div>
                        </div>
                        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
                            <div className="text-sm text-green-400 mb-1">Arbitrage Found</div>
                            <div className="text-2xl font-bold text-green-400">{arbitrageCount}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-purple-500/30">
                            <div className="text-sm text-purple-400 mb-1">Polymarket</div>
                            <div className="text-2xl font-bold text-purple-400">{data.polymarketCount}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-blue-500/30">
                            <div className="text-sm text-blue-400 mb-1">Kalshi</div>
                            <div className="text-2xl font-bold text-blue-400">{data.kalshiCount}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                            <div className="text-sm text-slate-400 mb-1">Last Update</div>
                            <div className="text-lg font-bold text-white">
                                {new Date(data.fetchedAt).toLocaleTimeString()}
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
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('matched')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                viewMode === 'matched'
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Related Markets
                        </button>
                        <button
                            onClick={() => setViewMode('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                viewMode === 'all'
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            All Markets
                        </button>
                    </div>

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
                                {filteredPairs.map((pair) => (
                                    <MarketCompareCard
                                        key={pair.id}
                                        polymarket={pair.polymarket}
                                        kalshi={pair.kalshi}
                                        similarity={pair.similarity}
                                        arbitrage={pair.arbitrage}
                                        onExecuteArbitrage={setSelectedArbitrage}
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
                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <span className="text-purple-400 font-bold">P</span>
                                </div>
                                <h2 className="text-xl font-bold text-purple-400">
                                    Polymarket Markets
                                </h2>
                                <span className="text-slate-500">
                                    ({data?.unmatchedPolymarket.length || 0} unmatched)
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
                                    {data?.unmatchedPolymarket.map((market) => (
                                        <SingleMarketCard
                                            key={market.id}
                                            market={market}
                                            platform="polymarket"
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Kalshi Column */}
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <span className="text-blue-400 font-bold">K</span>
                                </div>
                                <h2 className="text-xl font-bold text-blue-400">
                                    Kalshi Markets
                                </h2>
                                <span className="text-slate-500">
                                    ({data?.unmatchedKalshi.length || 0} unmatched)
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
                                    {data?.unmatchedKalshi.map((market) => (
                                        <SingleMarketCard
                                            key={market.id}
                                            market={market}
                                            platform="kalshi"
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
                        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center mb-3">
                            <span className="text-purple-400 font-bold">1</span>
                        </div>
                        <h3 className="font-semibold text-white mb-2">Fetch Markets</h3>
                        <p className="text-slate-400 text-sm">
                            Real-time data from Polymarket & Kalshi APIs
                        </p>
                    </div>
                    <div className="bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center mb-3">
                            <span className="text-blue-400 font-bold">2</span>
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
