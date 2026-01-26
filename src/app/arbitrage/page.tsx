'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArbitrageOpportunity } from '@/lib/kalshi/types';
import { ExecuteArbitrageModal } from '@/components';

interface ScanResult {
    opportunities: ArbitrageOpportunity[];
    matchedMarkets: number;
    polymarketCount: number;
    kalshiCount: number;
    scannedAt: string;
}

export default function ArbitragePage() {
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [selectedOpportunity, setSelectedOpportunity] = useState<ArbitrageOpportunity | null>(null);

    const scanForArbitrage = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch('/api/arbitrage/scan');

            if (!response.ok) {
                throw new Error('Failed to scan for arbitrage');
            }

            const data = await response.json();
            setScanResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        scanForArbitrage();
    }, [scanForArbitrage]);

    // Auto-refresh every 30 seconds if enabled
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(scanForArbitrage, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, scanForArbitrage]);

    return (
        <div className="min-h-screen">
            {/* Hero */}
            <section className="relative overflow-hidden py-16 px-4">
                <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 via-slate-950 to-emerald-900/20"></div>
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl"></div>

                <div className="relative max-w-7xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                            Arbitrage Scanner
                        </span>
                    </h1>
                    <p className="text-lg text-slate-400 max-w-2xl mb-8">
                        Real-time scanning across Polymarket and Kalshi for cross-platform arbitrage opportunities.
                        Find markets where Yes + No &lt; $1 for guaranteed profits.
                    </p>

                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-4">
                        <button
                            onClick={scanForArbitrage}
                            disabled={isLoading}
                            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Scanning...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Scan Now
                                </>
                            )}
                        </button>

                        <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500"
                            />
                            Auto-refresh (30s)
                        </label>
                    </div>
                </div>
            </section>

            {/* Stats */}
            {scanResult && (
                <section className="max-w-7xl mx-auto px-4 py-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                            <div className="text-sm text-slate-400 mb-1">Opportunities Found</div>
                            <div className="text-2xl font-bold text-green-400">{scanResult.opportunities.length}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                            <div className="text-sm text-slate-400 mb-1">Matched Markets</div>
                            <div className="text-2xl font-bold text-white">{scanResult.matchedMarkets}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                            <div className="text-sm text-slate-400 mb-1">Polymarket</div>
                            <div className="text-2xl font-bold text-purple-400">{scanResult.polymarketCount}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                            <div className="text-sm text-slate-400 mb-1">Kalshi</div>
                            <div className="text-2xl font-bold text-blue-400">{scanResult.kalshiCount}</div>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                        Last scanned: {new Date(scanResult.scannedAt).toLocaleTimeString()}
                    </p>
                </section>
            )}

            {/* Error */}
            {error && (
                <div className="max-w-7xl mx-auto px-4">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
                        {error}
                    </div>
                </div>
            )}

            {/* Opportunities */}
            <section className="max-w-7xl mx-auto px-4 pb-16">
                <h2 className="text-2xl font-bold text-white mb-6">
                    {scanResult?.opportunities.length ? 'Arbitrage Opportunities' : 'No Opportunities Found'}
                </h2>

                {isLoading && !scanResult && (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-slate-800/50 rounded-xl p-6 animate-pulse">
                                <div className="h-6 bg-slate-700 rounded w-3/4 mb-4"></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-20 bg-slate-700/50 rounded-xl"></div>
                                    <div className="h-20 bg-slate-700/50 rounded-xl"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {scanResult?.opportunities.length === 0 && !isLoading && (
                    <div className="bg-slate-800/30 rounded-2xl p-12 text-center border border-slate-700/50">
                        <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">No Arbitrage Found</h3>
                        <p className="text-slate-400 max-w-md mx-auto">
                            Markets are currently efficient. Keep scanning - opportunities can appear at any time due to price movements.
                        </p>
                    </div>
                )}

                <div className="space-y-4">
                    {scanResult?.opportunities.map((opp) => (
                        <div
                            key={opp.id}
                            className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl p-6 border border-green-500/30 hover:border-green-500/50 transition-colors"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1 pr-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${opp.type === 'cross-platform'
                                            ? 'bg-yellow-500/20 text-yellow-400'
                                            : 'bg-slate-600/50 text-slate-300'
                                            }`}>
                                            {opp.type === 'cross-platform' ? '🔀 CROSS-PLATFORM' : '📍 SINGLE PLATFORM'}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-white">
                                        {opp.question}
                                    </h3>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-green-400">
                                        +{opp.profitPercentage.toFixed(2)}%
                                    </div>
                                    <div className="text-sm text-slate-400">
                                        ${opp.guaranteedProfit.toFixed(4)} profit
                                    </div>
                                </div>
                            </div>

                            {/* Platforms */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className="bg-slate-800/50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${opp.platform1.name === 'polymarket' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {opp.platform1.name.toUpperCase()}
                                        </span>
                                        {opp.platform1.url && (
                                            <a
                                                href={opp.platform1.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700/50 rounded"
                                                title="Open Market"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-slate-400">Yes:</span>
                                            <span className="ml-2 text-green-400 font-mono">
                                                {(opp.platform1.yesPrice * 100).toFixed(1)}¢
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400">No:</span>
                                            <span className="ml-2 text-red-400 font-mono">
                                                {(opp.platform1.noPrice * 100).toFixed(1)}¢
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-800/50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${opp.platform2.name === 'polymarket' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {opp.platform2.name.toUpperCase()}
                                        </span>
                                        {opp.platform2.url && (
                                            <a
                                                href={opp.platform2.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700/50 rounded"
                                                title="Open Market"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-slate-400">Yes:</span>
                                            <span className="ml-2 text-green-400 font-mono">
                                                {(opp.platform2.yesPrice * 100).toFixed(1)}¢
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400">No:</span>
                                            <span className="ml-2 text-red-400 font-mono">
                                                {(opp.platform2.noPrice * 100).toFixed(1)}¢
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Strategy Instructions */}
                            <div className="bg-slate-900/50 rounded-xl p-4 mb-4 border border-dashed border-slate-600">
                                <div className="text-sm text-slate-400 mb-2">📋 Strategy:</div>
                                {opp.type === 'single-platform' ? (
                                    <div className="text-sm text-white">
                                        Buy <span className="text-green-400 font-semibold">YES</span> +
                                        Buy <span className="text-red-400 font-semibold">NO</span> on {opp.platform1.name.toUpperCase()}
                                    </div>
                                ) : (
                                    <div className="text-sm text-white">
                                        {opp.strategy === 'buy-yes-a-no-b' ? (
                                            <>
                                                Buy <span className="text-green-400 font-semibold">YES</span> on {opp.platform1.name.toUpperCase()} @ {(opp.platform1.yesPrice * 100).toFixed(1)}¢ +
                                                Buy <span className="text-red-400 font-semibold">NO</span> on {opp.platform2.name.toUpperCase()} @ {(opp.platform2.noPrice * 100).toFixed(1)}¢
                                            </>
                                        ) : (
                                            <>
                                                Buy <span className="text-red-400 font-semibold">NO</span> on {opp.platform1.name.toUpperCase()} @ {(opp.platform1.noPrice * 100).toFixed(1)}¢ +
                                                Buy <span className="text-green-400 font-semibold">YES</span> on {opp.platform2.name.toUpperCase()} @ {(opp.platform2.yesPrice * 100).toFixed(1)}¢
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Action */}
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-slate-400">
                                    Total cost: <span className="text-white font-mono">${opp.totalCost.toFixed(4)}</span> →
                                    Payout: <span className="text-green-400 font-mono">$1.00</span>
                                </div>
                                <button
                                    onClick={() => setSelectedOpportunity(opp)}
                                    className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-semibold transition-colors"
                                >
                                    Execute Trade
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* How It Works */}
            <section className="max-w-7xl mx-auto px-4 pb-16">
                <h2 className="text-2xl font-bold text-white mb-6">How Arbitrage Works</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                            <span className="text-purple-400 font-bold">1</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">Find Price Discrepancy</h3>
                        <p className="text-slate-400 text-sm">
                            When the same event has different prices on Polymarket and Kalshi, an arbitrage opportunity may exist.
                        </p>
                    </div>

                    <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
                        <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center mb-4">
                            <span className="text-green-400 font-bold">2</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">Buy Both Sides</h3>
                        <p className="text-slate-400 text-sm">
                            Buy YES on one platform and NO on the other. If total cost &lt; $1, you&apos;re guaranteed profit.
                        </p>
                    </div>

                    <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                            <span className="text-emerald-400 font-bold">3</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">Collect Profit</h3>
                        <p className="text-slate-400 text-sm">
                            When the event resolves, one position pays $1. Your profit = $1 - total cost paid.
                        </p>
                    </div>
                </div>
            </section>

            {/* Execute Modal */}
            {selectedOpportunity && (
                <ExecuteArbitrageModal
                    opportunity={selectedOpportunity}
                    isOpen={!!selectedOpportunity}
                    onClose={() => setSelectedOpportunity(null)}
                />
            )}
        </div>
    );
}
