'use client';

import { useState, useEffect, useCallback } from 'react';
import { isLabsEnabled } from '@/lib/config/features';

interface CorrelationEvent {
    marketId: string;
    question: string;
    platform: string;
    probability: number;
}

interface MispricingSignal {
    divergence: number;
    direction: string;
    confidence: string;
    suggestedAction: string;
    expectedConvergence: string;
}

interface CorrelationLink {
    eventA: CorrelationEvent;
    eventB: CorrelationEvent;
    direction: string;
    strength: number;
    mechanism: string;
    category: string;
    mispricing?: MispricingSignal;
}

interface CorrelationChain {
    id: string;
    name: string;
    region: string;
    links: CorrelationLink[];
    totalDivergence: number;
    opportunity: boolean;
}

interface ScanResult {
    chains: CorrelationChain[];
    pairs: CorrelationLink[];
    totalMarketsScanned: number;
    correlationsFound: number;
    mispricingsDetected: number;
    scannedAt: string;
}

const REGIONS = ['all', 'US', 'Japan', 'Europe', 'Asia-Pacific', 'Crypto'];

const CATEGORY_COLORS: Record<string, string> = {
    'political→economic': 'from-violet-500/20 to-blue-500/20 border-violet-500/30',
    'political→currency': 'from-violet-500/20 to-amber-500/20 border-violet-500/30',
    'economic→currency': 'from-blue-500/20 to-amber-500/20 border-blue-500/30',
    'economic→asset': 'from-blue-500/20 to-emerald-500/20 border-blue-500/30',
    'geopolitical→market': 'from-red-500/20 to-orange-500/20 border-red-500/30',
    'policy→rates': 'from-indigo-500/20 to-cyan-500/20 border-indigo-500/30',
    'rates→currency': 'from-cyan-500/20 to-amber-500/20 border-cyan-500/30',
    'same-event-variants': 'from-slate-500/20 to-slate-400/20 border-slate-500/30',
};

const DIRECTION_ICONS: Record<string, string> = {
    positive: '↗',
    negative: '↘',
    neutral: '→',
};

function StrengthBar({ strength }: { strength: number }) {
    const pct = Math.round(strength * 100);
    const color = pct >= 70 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-slate-400';
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-400 font-mono">{pct}%</span>
        </div>
    );
}

function MispricingBadge({ signal }: { signal: MispricingSignal }) {
    const color = signal.confidence === 'high'
        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
        : signal.confidence === 'medium'
            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            : 'bg-slate-500/15 text-slate-300 border-slate-500/30';

    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${color}`}>
            <span className="font-mono">{signal.divergence}pp</span>
            <span className="opacity-60">divergence</span>
            <span className="text-[10px] uppercase tracking-wider opacity-50">{signal.confidence}</span>
        </div>
    );
}

function CorrelationPairCard({ link }: { link: CorrelationLink }) {
    const [expanded, setExpanded] = useState(false);
    const catColor = CATEGORY_COLORS[link.category] || CATEGORY_COLORS['same-event-variants'];

    return (
        <div
            className={`rounded-xl border bg-gradient-to-br ${catColor} backdrop-blur-sm transition-all hover:scale-[1.005] cursor-pointer`}
            onClick={() => setExpanded(!expanded)}
        >
            <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{DIRECTION_ICONS[link.direction]}</span>
                        <span className="text-xs font-medium text-slate-300 bg-slate-800/60 px-2 py-0.5 rounded">
                            {link.category}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {link.mispricing && <MispricingBadge signal={link.mispricing} />}
                        <StrengthBar strength={link.strength} />
                    </div>
                </div>

                {/* Event pair */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Event A */}
                    <div className="bg-slate-900/40 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Event A</span>
                            <span className="text-[10px] bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded">{link.eventA.platform}</span>
                        </div>
                        <p className="text-sm text-slate-200 line-clamp-2 leading-relaxed">{link.eventA.question}</p>
                        <div className="mt-2 font-mono text-lg font-semibold text-white">
                            {(link.eventA.probability * 100).toFixed(1)}%
                        </div>
                    </div>

                    {/* Event B */}
                    <div className="bg-slate-900/40 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Event B</span>
                            <span className="text-[10px] bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded">{link.eventB.platform}</span>
                        </div>
                        <p className="text-sm text-slate-200 line-clamp-2 leading-relaxed">{link.eventB.question}</p>
                        <div className="mt-2 font-mono text-lg font-semibold text-white">
                            {(link.eventB.probability * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>

                {/* Mechanism / expanded details */}
                {expanded && (
                    <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                        <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500">Transmission Mechanism</span>
                            <p className="text-sm text-slate-300 mt-1">{link.mechanism}</p>
                        </div>
                        {link.mispricing && (
                            <div>
                                <span className="text-[10px] uppercase tracking-wider text-slate-500">Suggested Action</span>
                                <p className="text-sm text-emerald-300 mt-1">{link.mispricing.suggestedAction}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function ChainCard({ chain }: { chain: CorrelationChain }) {
    const [expanded, setExpanded] = useState(chain.opportunity);

    return (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm overflow-hidden">
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${chain.opportunity ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    <div>
                        <h3 className="text-sm font-semibold text-white" style={{ fontFamily: 'var(--font-sora)' }}>{chain.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400">{chain.region}</span>
                            <span className="text-xs text-slate-600">•</span>
                            <span className="text-xs text-slate-400">{chain.links.length} correlation{chain.links.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {chain.opportunity && (
                        <span className="text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 px-2 py-0.5 rounded-md">
                            {chain.totalDivergence}pp divergence
                        </span>
                    )}
                    <svg
                        className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {expanded && (
                <div className="px-4 pb-4 space-y-3">
                    {chain.links.map((link, i) => (
                        <CorrelationPairCard key={i} link={link} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function CorrelationPage() {
    const labsEnabled = isLabsEnabled();

    const [data, setData] = useState<ScanResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedRegion, setSelectedRegion] = useState('all');
    const [view, setView] = useState<'chains' | 'pairs'>('chains');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/correlation/scan?region=${selectedRegion}`);
            if (!res.ok) throw new Error('Failed to fetch correlations');
            const result = await res.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [selectedRegion]);

    useEffect(() => {
        if (!labsEnabled) return;
        fetchData();
    }, [fetchData, labsEnabled]);

    if (!labsEnabled) {
        return (
            <div className="min-h-screen terminal-bg flex items-center justify-center px-4">
                <div className="max-w-xl w-full bg-slate-900/70 border border-slate-700/60 rounded-2xl p-8 text-center">
                    <div className="text-2xl font-semibold text-white mb-3">Correlation Scanner is in Labs</div>
                    <p className="text-slate-400">
                        Enable <code>NEXT_PUBLIC_FEATURE_LABS=true</code> and <code>FEATURE_LABS=true</code> to access this module.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
            {/* Header */}
            <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 text-xs uppercase tracking-[0.3em] text-brand-300 bg-brand-500/10 mb-3">
                    Macro Intelligence
                </div>
                <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-sora)' }}>
                    Cross-Event Correlations
                </h1>
                <p className="text-slate-400 mt-2 max-w-2xl">
                    Detects logical linkages between prediction market events using macroeconomic
                    transmission mechanisms. Identifies mispricing when correlated events diverge
                    from expected probability relationships.
                </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                {/* Region filter */}
                <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-700/50 rounded-lg p-1">
                    {REGIONS.map(r => (
                        <button
                            key={r}
                            onClick={() => setSelectedRegion(r)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${selectedRegion === r
                                    ? 'bg-brand-500/20 text-brand-200 border border-brand-500/30'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                                }`}
                        >
                            {r === 'all' ? 'All Regions' : r}
                        </button>
                    ))}
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-700/50 rounded-lg p-1 ml-auto">
                    <button
                        onClick={() => setView('chains')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${view === 'chains' ? 'bg-brand-500/20 text-brand-200' : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        Chains
                    </button>
                    <button
                        onClick={() => setView('pairs')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${view === 'pairs' ? 'bg-brand-500/20 text-brand-200' : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        All Pairs
                    </button>
                </div>

                {/* Refresh */}
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/60 border border-slate-700/50 rounded-lg hover:bg-slate-700/40 transition-colors disabled:opacity-50"
                >
                    <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {loading ? 'Scanning...' : 'Refresh'}
                </button>
            </div>

            {/* Stats bar */}
            {data && !loading && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {[
                        { label: 'Markets Scanned', value: data.totalMarketsScanned, color: 'text-white' },
                        { label: 'Correlations Found', value: data.correlationsFound, color: 'text-brand-300' },
                        { label: 'Mispricings Detected', value: data.mispricingsDetected, color: data.mispricingsDetected > 0 ? 'text-emerald-300' : 'text-slate-400' },
                        { label: 'Active Chains', value: data.chains.length, color: 'text-amber-300' },
                    ].map(stat => (
                        <div key={stat.label} className="bg-slate-900/40 border border-slate-700/40 rounded-lg px-4 py-3">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{stat.label}</div>
                            <div className={`text-2xl font-bold font-mono mt-1 ${stat.color}`}>{stat.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm mb-6">
                    {error}
                </div>
            )}

            {/* Loading state */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-400 rounded-full animate-spin mb-4" />
                    <p className="text-slate-400 text-sm">Scanning markets for cross-event correlations...</p>
                </div>
            )}

            {/* Content */}
            {data && !loading && (
                <div className="space-y-3">
                    {view === 'chains' ? (
                        data.chains.length > 0 ? (
                            data.chains.map(chain => <ChainCard key={chain.id} chain={chain} />)
                        ) : (
                            <div className="text-center py-16">
                                <p className="text-slate-500 text-sm">No correlation chains detected for the selected region.</p>
                                <p className="text-slate-600 text-xs mt-1">Try selecting &quot;All Regions&quot; or wait for more active markets.</p>
                            </div>
                        )
                    ) : (
                        data.pairs.length > 0 ? (
                            data.pairs.map((pair, i) => <CorrelationPairCard key={i} link={pair} />)
                        ) : (
                            <div className="text-center py-16">
                                <p className="text-slate-500 text-sm">No correlation pairs found.</p>
                            </div>
                        )
                    )}
                </div>
            )}

            {/* Footer info */}
            {data && !loading && (
                <div className="mt-8 text-center text-xs text-slate-600">
                    Last scan: {new Date(data.scannedAt).toLocaleString()} · Based on FITE7001 macro correlation framework
                </div>
            )}
        </main>
    );
}
