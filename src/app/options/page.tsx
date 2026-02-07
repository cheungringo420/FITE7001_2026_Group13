'use client';

import { useState, useMemo, useEffect } from 'react';
import {
    OptionData,
    IVComparison,
} from '@/lib/options/types';
import {
    blackScholesCall,
    blackScholesPut,
    probabilityAboveStrike,
    calculateGreeks,
} from '@/lib/options/iv-calculator';
import { useMarketStream } from '@/hooks/useMarketStream';
import { buildTrustMap, fetchTrustSummary, trustKey } from '@/lib/trust/client';
import { TrustSummaryItem } from '@/lib/trust/types';
import { TrustBadge } from '@/components';

// Mock data for demonstration - In production, this would come from an API
const MOCK_OPTIONS_DATA: OptionData[] = [
    {
        symbol: 'SPY240119C500',
        underlying: 'SPY',
        strikePrice: 500,
        expirationDate: '2026-02-19',
        optionType: 'call',
        lastPrice: 12.50,
        bid: 12.30,
        ask: 12.70,
        volume: 15420,
        openInterest: 45000,
        impliedVolatility: 0.18,
        delta: 0.55,
        underlyingPrice: 498.50,
        daysToExpiration: 22,
    },
    {
        symbol: 'SPY240119P500',
        underlying: 'SPY',
        strikePrice: 500,
        expirationDate: '2026-02-19',
        optionType: 'put',
        lastPrice: 14.20,
        bid: 14.00,
        ask: 14.40,
        volume: 12300,
        openInterest: 38000,
        impliedVolatility: 0.19,
        delta: -0.45,
        underlyingPrice: 498.50,
        daysToExpiration: 22,
    },
    {
        symbol: 'QQQ240119C420',
        underlying: 'QQQ',
        strikePrice: 420,
        expirationDate: '2026-02-19',
        optionType: 'call',
        lastPrice: 8.80,
        bid: 8.60,
        ask: 9.00,
        volume: 8900,
        openInterest: 25000,
        impliedVolatility: 0.22,
        delta: 0.52,
        underlyingPrice: 415.20,
        daysToExpiration: 22,
    },
];

const MOCK_COMPARISONS: IVComparison[] = [
    {
        id: 'cmp-1',
        predictionMarket: {
            platform: 'polymarket',
            marketId: 'spy-above-500',
            question: 'Will SPY close above $500 by Feb 19?',
            yesPrice: 0.42,
            expiry: '2026-02-19',
        },
        optionsData: {
            underlying: 'SPY',
            strikePrice: 500,
            expirationDate: '2026-02-19',
            impliedVolatility: 0.18,
            impliedProbability: 0.48,
            callPrice: 12.50,
            putPrice: 14.20,
        },
        discrepancy: {
            valueDiff: -0.06,
            percentDiff: -13.3,
            direction: 'options-higher',
            opportunity: true,
        },
        matchedAt: Date.now(),
    },
    {
        id: 'cmp-2',
        predictionMarket: {
            platform: 'kalshi',
            marketId: 'qqq-above-420',
            question: 'Will QQQ trade above $420 by Feb 19?',
            yesPrice: 0.55,
            expiry: '2026-02-19',
        },
        optionsData: {
            underlying: 'QQQ',
            strikePrice: 420,
            expirationDate: '2026-02-19',
            impliedVolatility: 0.22,
            impliedProbability: 0.48,
            callPrice: 8.80,
            putPrice: 10.20,
        },
        discrepancy: {
            valueDiff: 0.07,
            percentDiff: 13.6,
            direction: 'prediction-higher',
            opportunity: true,
        },
        matchedAt: Date.now(),
    },
];

// Probability Comparison Bar
function ProbabilityBar({
    predictionProb,
    optionsProb
}: {
    predictionProb: number;
    optionsProb: number;
}) {
    const diff = predictionProb - optionsProb;

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-brand-300">Prediction: {(predictionProb * 100).toFixed(1)}%</span>
                <span className="text-accent-cyan">Options: {(optionsProb * 100).toFixed(1)}%</span>
            </div>
            <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className="absolute left-0 h-full bg-brand-500/50 transition-all"
                    style={{ width: `${predictionProb * 100}%` }}
                />
                <div
                    className="absolute left-0 h-full border-r-2 border-accent-cyan"
                    style={{ width: `${optionsProb * 100}%` }}
                />
            </div>
            <div className="text-center">
                <span className={`text-sm font-medium ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-slate-400'}`}>
                    {diff > 0 ? '+' : ''}{(diff * 100).toFixed(1)}% difference
                </span>
            </div>
        </div>
    );
}

// Comparison Card Component
function ComparisonCard({ comparison, trust }: { comparison: IVComparison; trust?: TrustSummaryItem }) {
    const [showDetails, setShowDetails] = useState(false);

    return (
        <div className={`bg-slate-800/50 rounded-xl border ${comparison.discrepancy.opportunity ? 'border-yellow-500/50' : 'border-slate-700'} p-4`}>
            {comparison.discrepancy.opportunity && (
                <div className="flex items-center gap-2 mb-3 text-yellow-400 text-sm">
                    <span>⚡</span>
                    <span className="font-medium">Potential Opportunity Detected</span>
                </div>
            )}

            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${comparison.predictionMarket.platform === 'polymarket' ? 'bg-brand-500' : 'bg-accent-cyan'}`} />
                        <span className="text-xs text-slate-400 uppercase">{comparison.predictionMarket.platform}</span>
                        {trust && <TrustBadge score={trust.trustScore} compact />}
                    </div>
                    <h3 className="text-white font-medium line-clamp-2">{comparison.predictionMarket.question}</h3>
                </div>
                <div className="text-right">
                    <div className="text-sm text-slate-400">Expires</div>
                    <div className="text-white font-mono">{comparison.optionsData.expirationDate}</div>
                </div>
            </div>

            <ProbabilityBar
                predictionProb={comparison.predictionMarket.yesPrice}
                optionsProb={comparison.optionsData.impliedProbability}
            />

            <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="text-center">
                    <div className="text-xs text-slate-400">IV</div>
                    <div className="text-white font-mono">{(comparison.optionsData.impliedVolatility * 100).toFixed(1)}%</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-slate-400">Call</div>
                    <div className="text-white font-mono">${comparison.optionsData.callPrice.toFixed(2)}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-slate-400">Put</div>
                    <div className="text-white font-mono">${comparison.optionsData.putPrice.toFixed(2)}</div>
                </div>
            </div>

            <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full mt-4 text-sm text-slate-400 hover:text-white flex items-center justify-center gap-1"
            >
                <span>{showDetails ? 'Hide' : 'Show'} Details</span>
                <svg className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {showDetails && (
                <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-400">Strike:</span>
                            <span className="text-white ml-2">${comparison.optionsData.strikePrice}</span>
                        </div>
                        <div>
                            <span className="text-slate-400">Underlying:</span>
                            <span className="text-white ml-2">{comparison.optionsData.underlying}</span>
                        </div>
                    </div>
                    <div className="text-xs text-slate-500">
                        {comparison.discrepancy.direction === 'prediction-higher'
                            ? '📈 Prediction market prices this outcome higher than options imply. Consider buying puts or selling the prediction.'
                            : comparison.discrepancy.direction === 'options-higher'
                                ? '📉 Options imply higher probability. Consider buying the prediction market or selling calls.'
                                : '⚖️ Markets are relatively aligned.'}
                    </div>
                </div>
            )}
        </div>
    );
}

// Calculator Panel
function IVCalculator() {
    const [underlying, setUnderlying] = useState(500);
    const [strike, setStrike] = useState(505);
    const [days, setDays] = useState(30);
    const [iv, setIV] = useState(0.20);
    const rate = 0.045;

    const calculations = useMemo(() => {
        const T = days / 365;
        const params = { S: underlying, K: strike, T, r: rate, sigma: iv };

        const callPrice = blackScholesCall(params);
        const putPrice = blackScholesPut(params);
        const probAbove = probabilityAboveStrike(params);
        const greeks = calculateGreeks(params, true);

        return {
            callPrice,
            putPrice,
            probAbove,
            probBelow: 1 - probAbove,
            greeks,
        };
    }, [underlying, strike, days, iv, rate]);

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-white mb-4">🧮 IV Calculator</h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="text-xs text-slate-400 block mb-1">Underlying Price ($)</label>
                    <input
                        type="number"
                        value={underlying}
                        onChange={(e) => setUnderlying(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    />
                </div>
                <div>
                    <label className="text-xs text-slate-400 block mb-1">Strike Price ($)</label>
                    <input
                        type="number"
                        value={strike}
                        onChange={(e) => setStrike(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    />
                </div>
                <div>
                    <label className="text-xs text-slate-400 block mb-1">Days to Expiry</label>
                    <input
                        type="number"
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    />
                </div>
                <div>
                    <label className="text-xs text-slate-400 block mb-1">Implied Volatility (%)</label>
                    <input
                        type="number"
                        value={(iv * 100).toFixed(0)}
                        onChange={(e) => setIV((parseFloat(e.target.value) || 0) / 100)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-400">Call Price</div>
                    <div className="text-xl font-bold text-green-400">${calculations.callPrice.toFixed(2)}</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-slate-400">Put Price</div>
                    <div className="text-xl font-bold text-red-400">${calculations.putPrice.toFixed(2)}</div>
                </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                <div className="text-sm text-slate-400 mb-2">Risk-Neutral Probability</div>
                <div className="flex justify-between items-center">
                    <span className="text-green-400">Above ${strike}: {(calculations.probAbove * 100).toFixed(1)}%</span>
                    <span className="text-red-400">Below ${strike}: {(calculations.probBelow * 100).toFixed(1)}%</span>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div className="bg-slate-900/50 rounded p-2">
                    <div className="text-xs text-slate-400">Delta</div>
                    <div className="text-white font-mono">{calculations.greeks.delta.toFixed(3)}</div>
                </div>
                <div className="bg-slate-900/50 rounded p-2">
                    <div className="text-xs text-slate-400">Gamma</div>
                    <div className="text-white font-mono">{calculations.greeks.gamma.toFixed(4)}</div>
                </div>
                <div className="bg-slate-900/50 rounded p-2">
                    <div className="text-xs text-slate-400">Theta</div>
                    <div className="text-white font-mono">{calculations.greeks.theta.toFixed(3)}</div>
                </div>
                <div className="bg-slate-900/50 rounded p-2">
                    <div className="text-xs text-slate-400">Vega</div>
                    <div className="text-white font-mono">{calculations.greeks.vega.toFixed(3)}</div>
                </div>
            </div>
        </div>
    );
}

export default function OptionsPage() {
    const [activeTab, setActiveTab] = useState<'comparisons' | 'calculator' | 'chain'>('comparisons');
    const { snapshot, isConnected: streamConnected } = useMarketStream();
    const [trustMap, setTrustMap] = useState<Record<string, TrustSummaryItem>>({});

    useEffect(() => {
        let active = true;
        fetchTrustSummary({ platform: 'all', limit: 200 }).then((items) => {
            if (!active) return;
            if (items.length > 0) {
                setTrustMap(buildTrustMap(items));
            }
        });
        return () => {
            active = false;
        };
    }, []);

    return (
        <div className="min-h-screen terminal-bg py-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <span className="text-xl">📊</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white text-gradient-brand">Options IV Analysis</h1>
                            <p className="text-slate-400 text-sm">
                                Compare prediction market probabilities with options-implied volatility
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className={`chip ${streamConnected ? 'chip-active' : ''}`}>
                            Stream {streamConnected ? 'Connected' : 'Offline'}
                        </span>
                        {snapshot?.updatedAt && (
                            <span className="chip">Last snapshot {new Date(snapshot.updatedAt).toLocaleTimeString()}</span>
                        )}
                    </div>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 glass">
                        <div className="text-sm text-slate-400">Active Comparisons</div>
                        <div className="text-2xl font-bold text-white">{MOCK_COMPARISONS.length}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 glass">
                        <div className="text-sm text-slate-400">Opportunities</div>
                        <div className="text-2xl font-bold text-yellow-400">{MOCK_COMPARISONS.filter(c => c.discrepancy.opportunity).length}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 glass">
                        <div className="text-sm text-slate-400">Avg IV</div>
                        <div className="text-2xl font-bold text-white">
                            {(MOCK_OPTIONS_DATA.reduce((sum, o) => sum + o.impliedVolatility, 0) / MOCK_OPTIONS_DATA.length * 100).toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 glass">
                        <div className="text-sm text-slate-400">Max Discrepancy</div>
                        <div className="text-2xl font-bold text-green-400 neon-text-green">
                            {Math.max(...MOCK_COMPARISONS.map(c => Math.abs(c.discrepancy.percentDiff))).toFixed(1)}%
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {(['comparisons', 'calculator', 'chain'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab
                                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/50'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                        >
                            {tab === 'comparisons' ? '🔄 Market Comparisons'
                                : tab === 'calculator' ? '🧮 Calculator'
                                    : '📈 Options Chain'}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'comparisons' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Prediction vs Options</h2>
                            <button className="px-3 py-1.5 bg-brand-500/20 text-brand-300 rounded-lg text-sm hover:bg-brand-500/30 transition-colors">
                                Refresh Data
                            </button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            {MOCK_COMPARISONS.map((comparison) => (
                                <ComparisonCard
                                    key={comparison.id}
                                    comparison={comparison}
                                    trust={trustMap[trustKey(comparison.predictionMarket.platform, comparison.predictionMarket.marketId)]}
                                />
                            ))}
                        </div>
                        {MOCK_COMPARISONS.length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                                No matching prediction markets found for current options data.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'calculator' && (
                    <div className="grid gap-6 md:grid-cols-2">
                        <IVCalculator />
                        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                            <h3 className="text-lg font-bold text-white mb-4">📚 How It Works</h3>
                            <div className="space-y-4 text-sm text-slate-300">
                                <div>
                                    <h4 className="font-medium text-white mb-1">Black-Scholes Model</h4>
                                    <p className="text-slate-400">
                                        We use the Black-Scholes formula to calculate theoretical option prices
                                        and derive implied probabilities from market prices.
                                    </p>
                                </div>
                                <div>
                                    <h4 className="font-medium text-white mb-1">N(d2) Probability</h4>
                                    <p className="text-slate-400">
                                        The risk-neutral probability that the stock expires above the strike
                                        is given by N(d2) in the Black-Scholes framework.
                                    </p>
                                </div>
                                <div>
                                    <h4 className="font-medium text-white mb-1">Arbitrage Detection</h4>
                                    <p className="text-slate-400">
                                        When prediction market prices diverge significantly from options-implied
                                        probabilities, there may be an arbitrage opportunity.
                                    </p>
                                </div>
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-400">
                                    <strong>⚠️ Disclaimer:</strong> This is for educational purposes only.
                                    Options trading involves significant risk.
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'chain' && (
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                            <h3 className="font-semibold text-white">Options Chain - SPY</h3>
                            <select className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-sm text-white">
                                <option>Feb 19, 2026</option>
                                <option>Mar 15, 2026</option>
                                <option>Apr 18, 2026</option>
                            </select>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-900/50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-slate-400">Symbol</th>
                                        <th className="px-4 py-2 text-right text-slate-400">Strike</th>
                                        <th className="px-4 py-2 text-right text-slate-400">Type</th>
                                        <th className="px-4 py-2 text-right text-slate-400">Last</th>
                                        <th className="px-4 py-2 text-right text-slate-400">Bid</th>
                                        <th className="px-4 py-2 text-right text-slate-400">Ask</th>
                                        <th className="px-4 py-2 text-right text-slate-400">IV</th>
                                        <th className="px-4 py-2 text-right text-slate-400">Volume</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MOCK_OPTIONS_DATA.map((option) => (
                                        <tr key={option.symbol} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                                            <td className="px-4 py-2 text-white font-mono">{option.symbol}</td>
                                            <td className="px-4 py-2 text-right text-white">${option.strikePrice}</td>
                                            <td className="px-4 py-2 text-right">
                                                <span className={option.optionType === 'call' ? 'text-green-400' : 'text-red-400'}>
                                                    {option.optionType.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-right text-white">${option.lastPrice.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right text-slate-400">${option.bid.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right text-slate-400">${option.ask.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right text-yellow-400">{(option.impliedVolatility * 100).toFixed(1)}%</td>
                                            <td className="px-4 py-2 text-right text-slate-400">{option.volume.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Info Footer */}
                <div className="mt-8 text-center text-sm text-slate-500">
                    <p>
                        Data sources: Mock data for demonstration. In production, this would use real-time options data
                        from providers like CBOE, Nasdaq, or broker APIs.
                    </p>
                </div>
            </div>
        </div>
    );
}
