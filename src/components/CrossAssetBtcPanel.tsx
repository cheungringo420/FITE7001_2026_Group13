'use client';

import { useEffect, useRef, useState } from 'react';

const REFRESH_INTERVAL_MS = 30_000; // matches API revalidate = 30
import type { CrossAssetBtcResponse } from '@/app/api/cross-asset/btc/route';
import type { StrategyTicket, TradeLeg } from '@/lib/options/suggest-strategy';

function formatUsd(n: number, digits = 2) {
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function LegRow({ leg }: { leg: TradeLeg }) {
    const sideColor = leg.side === 'buy' ? 'text-emerald-400' : 'text-rose-400';
    const venueLabel = leg.venue === 'polymarket' ? 'POLY' : 'DERIBIT';
    const venueColor = leg.venue === 'polymarket' ? 'text-brand-300' : 'text-orange-300';
    return (
        <div className="grid grid-cols-12 gap-2 items-center py-1.5 px-2 rounded hover:bg-white/[0.02] text-xs font-mono">
            <span className={`col-span-1 font-semibold ${sideColor}`}>{leg.side.toUpperCase()}</span>
            <span className="col-span-1 text-slate-400 text-right">{leg.size.toLocaleString()}</span>
            <span className={`col-span-2 ${venueColor}`}>{venueLabel}</span>
            <span className="col-span-5 text-slate-300 truncate" title={leg.instrument}>{leg.instrument}</span>
            <span className="col-span-3 text-right text-slate-400">@ {formatUsd(leg.pricePerContract, leg.pricePerContract < 1 ? 3 : 2)}</span>
        </div>
    );
}

function TicketCard({ ticket }: { ticket: StrategyTicket }) {
    const [expanded, setExpanded] = useState(false);
    const polyOverpriced = ticket.inputs.predictionPrice > ticket.inputs.optionsImpliedProbability;
    const direction = polyOverpriced ? 'POLY OVER' : 'POLY UNDER';
    const directionColor = polyOverpriced ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/60 hover:border-slate-600 transition-colors">
            <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wider ${directionColor}`}>
                                {direction}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono uppercase">
                                Edge {ticket.edgePercent.toFixed(2)}pp
                            </span>
                        </div>
                        <p className="text-sm text-white leading-snug">{ticket.thesis}</p>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-xs text-slate-400">Est. profit</div>
                        <div className="text-lg font-bold text-emerald-400 font-mono">
                            {formatUsd(ticket.estimatedProfit, 0)}
                        </div>
                        <div className="text-[10px] text-slate-500">on {formatUsd(ticket.estimatedCapital, 0)} capital</div>
                    </div>
                </div>

                {/* Probability bar */}
                <div className="mb-3">
                    <div className="flex justify-between text-[10px] mb-1 font-mono">
                        <span className="text-brand-300">POLY {(ticket.inputs.predictionPrice * 100).toFixed(1)}%</span>
                        <span className="text-orange-300">OPTS {(ticket.inputs.optionsImpliedProbability * 100).toFixed(1)}%</span>
                    </div>
                    <div className="relative h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                        <div className="absolute left-0 h-full bg-brand-500/60" style={{ width: `${ticket.inputs.predictionPrice * 100}%` }} />
                        <div className="absolute h-full w-0.5 bg-orange-400" style={{ left: `${ticket.inputs.optionsImpliedProbability * 100}%` }} />
                    </div>
                </div>

                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full text-[11px] text-slate-400 hover:text-white py-1.5 border-t border-slate-700/40 mt-2 flex items-center justify-center gap-1"
                >
                    {expanded ? 'Hide' : 'Show'} {ticket.legs.length} legs · {ticket.warnings.length} warnings
                    <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {expanded && (
                    <div className="mt-3 pt-3 border-t border-slate-700/40 space-y-3">
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Trade legs</div>
                            <div className="bg-slate-900/40 rounded-lg p-1">
                                {ticket.legs.map((leg, i) => <LegRow key={i} leg={leg} />)}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Rationale</div>
                            <p className="text-xs text-slate-300 leading-relaxed">{ticket.rationale}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-slate-900/40 rounded p-2 text-center">
                                <div className="text-[10px] text-slate-500">Breakeven P</div>
                                <div className="text-white font-mono">{(ticket.breakevenProbability * 100).toFixed(1)}%</div>
                            </div>
                            <div className="bg-slate-900/40 rounded p-2 text-center">
                                <div className="text-[10px] text-slate-500">Spread width</div>
                                <div className="text-white font-mono">{formatUsd(ticket.replication.spreadWidth, 0)}</div>
                            </div>
                            <div className="bg-slate-900/40 rounded p-2 text-center">
                                <div className="text-[10px] text-slate-500">Mid strike</div>
                                <div className="text-white font-mono">{formatUsd(ticket.replication.midStrike, 0)}</div>
                            </div>
                        </div>
                        {ticket.warnings.length > 0 && (
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-amber-400/80 mb-1.5">Warnings</div>
                                <ul className="text-[11px] text-amber-200/80 space-y-1 list-disc pl-4">
                                    {ticket.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export function CrossAssetBtcPanel() {
    const [data, setData] = useState<CrossAssetBtcResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(REFRESH_INTERVAL_MS / 1000);
    const inFlight = useRef(false);

    const load = async () => {
        if (inFlight.current) return; // guard against overlapping fetches
        inFlight.current = true;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/cross-asset/btc', { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body: CrossAssetBtcResponse = await res.json();
            setData(body);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
            inFlight.current = false;
            setSecondsUntilRefresh(REFRESH_INTERVAL_MS / 1000);
        }
    };

    useEffect(() => { load(); }, []);

    // Auto-poll when enabled and tab is visible.
    useEffect(() => {
        if (!autoRefresh) return;
        const tick = setInterval(() => {
            setSecondsUntilRefresh((s) => {
                if (document.visibilityState !== 'visible') return s; // pause when hidden
                if (s <= 1) {
                    load();
                    return REFRESH_INTERVAL_MS / 1000;
                }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(tick);
    }, [autoRefresh]);

    // Refresh immediately when tab becomes visible after being hidden.
    useEffect(() => {
        const onVis = () => {
            if (document.visibilityState === 'visible' && autoRefresh && data) {
                const age = Date.now() - data.fetchedAt;
                if (age > REFRESH_INTERVAL_MS) load();
            }
        };
        document.addEventListener('visibilitychange', onVis);
        return () => document.removeEventListener('visibilitychange', onVis);
    }, [autoRefresh, data]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-white">Polymarket BTC × Deribit Options</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Live cross-asset mispricing detector. Polymarket binaries replicated on Deribit via tight call spreads (Breeden–Litzenberger).
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAutoRefresh((v) => !v)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors border ${
                            autoRefresh
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-slate-700/30 text-slate-400 border-slate-600/40 hover:bg-slate-700/50'
                        }`}
                        title={autoRefresh ? 'Click to pause auto-refresh' : 'Click to resume auto-refresh'}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {autoRefresh ? `AUTO · ${secondsUntilRefresh}s` : 'PAUSED'}
                    </button>
                    <button
                        onClick={load}
                        disabled={loading}
                        className="px-3 py-1.5 bg-brand-500/20 text-brand-300 rounded-lg text-sm hover:bg-brand-500/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {loading ? 'Scanning…' : 'Rescan now'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-sm text-rose-300">
                    Failed to load: {error}
                </div>
            )}

            {data && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">BTC Spot</div>
                            <div className="text-lg font-bold text-white font-mono">{data.spotPrice ? formatUsd(data.spotPrice, 0) : '—'}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Markets scanned</div>
                            <div className="text-lg font-bold text-white font-mono">{data.scanned}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Matched</div>
                            <div className="text-lg font-bold text-white font-mono">{data.matched}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/40">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Opportunities</div>
                            <div className="text-lg font-bold text-amber-400 font-mono">{data.opportunities}</div>
                        </div>
                    </div>

                    <div className="text-[10px] text-slate-500 font-mono flex flex-wrap gap-3">
                        <span title={`Filtered out: < ${data.filters.minDaysToExpiration}d to expiration (gamma noise)`}>
                            DTE&lt;{data.filters.minDaysToExpiration}d filtered: <span className="text-amber-400">{data.filters.rejectedShortDated}</span>
                        </span>
                        <span title={`Filtered out: options-implied probability outside [${data.filters.minOptionsImpliedProb}, ${data.filters.maxOptionsImpliedProb}] (wing-distortion zone)`}>
                            wing filtered: <span className="text-amber-400">{data.filters.rejectedWing}</span>
                        </span>
                        <span title="Within the 5% no-arbitrage band">
                            in-band: <span className="text-slate-400">{data.filters.rejectedNoEdge}</span>
                        </span>
                    </div>

                    {data.tickets.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-sm">
                            {data.matched === 0
                                ? 'No matchable BTC threshold markets on Polymarket right now.'
                                : 'All matched markets either failed quality gates or are within the 5% no-arbitrage band — nothing actionable.'}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {data.tickets.map((t, i) => <TicketCard key={i} ticket={t} />)}
                        </div>
                    )}

                    {data.errors.length > 0 && (
                        <details className="text-xs text-slate-500">
                            <summary className="cursor-pointer hover:text-slate-300">{data.errors.length} non-fatal error(s)</summary>
                            <ul className="mt-2 space-y-1 list-disc pl-4">
                                {data.errors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </details>
                    )}

                    <div className="text-[10px] text-slate-600 text-right font-mono">
                        Last fetch: {new Date(data.fetchedAt).toLocaleTimeString()}
                        {autoRefresh
                            ? ` · auto-refresh in ${secondsUntilRefresh}s`
                            : ' · auto-refresh paused'}
                        {' · server cache 30s'}
                    </div>
                </>
            )}
        </div>
    );
}
