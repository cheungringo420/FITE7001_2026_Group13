'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SignalEntry {
  id: string;
  type: 'caets' | 'raas' | 'lead_lag' | 'insurance';
  title: string;
  market: string;
  platform: string;
  score: number;
  direction: string;
  description: string;
  timestamp: string;
  strength: 'strong' | 'moderate' | 'weak';
}

// Simulated live signals — in production these would come from an API route
function generateMockSignals(): SignalEntry[] {
  return [
    {
      id: 's1',
      type: 'raas',
      title: 'Cross-Platform Arbitrage Opportunity',
      market: 'US Federal Reserve Rate Decision — June 2026',
      platform: 'Polymarket vs Kalshi',
      score: 0.034,
      direction: 'Buy YES on Poly, Sell YES on Kalshi',
      description: 'RAAS score 0.034 with alignment 0.82 and dispute risk 0.01. Net profit after costs: ~1.2%.',
      timestamp: new Date().toISOString(),
      strength: 'moderate',
    },
    {
      id: 's2',
      type: 'lead_lag',
      title: 'VIX Lead-Lag Signal Detected',
      market: 'China-Taiwan Conflict Escalation',
      platform: 'Polymarket',
      score: 0.12,
      direction: 'Long VIX — ΔP = +12pp in 24h',
      description: 'Event probability jumped from 18% to 30%. CAETS model predicts VIX response at t+3 with β=0.178.',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      strength: 'strong',
    },
    {
      id: 's3',
      type: 'insurance',
      title: 'Insurance Hedge Suggestion',
      market: 'OPEC Production Cut Agreement',
      platform: 'Polymarket',
      score: 0.72,
      direction: 'Buy YES as USO hedge',
      description: 'Trust score 78, liquidity $185K. If you hold USO exposure, YES contract provides negative beta hedge.',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      strength: 'moderate',
    },
    {
      id: 's4',
      type: 'caets',
      title: 'Cross-Asset Transmission Alert',
      market: 'US Debt Ceiling Resolution',
      platform: 'Kalshi',
      score: 0.089,
      direction: 'TLT sensitivity elevated',
      description: 'CAETS(TLT, debt_ceiling) = 0.089. Treasury returns showing elevated sensitivity to resolution probability changes.',
      timestamp: new Date(Date.now() - 14400000).toISOString(),
      strength: 'weak',
    },
    {
      id: 's5',
      type: 'raas',
      title: 'High-Confidence Arbitrage',
      market: 'UK General Election Date',
      platform: 'Polymarket vs Kalshi',
      score: 0.051,
      direction: 'Buy NO on Poly, Sell NO on Kalshi',
      description: 'RAAS score 0.051 with alignment 0.91. Highest conviction cross-platform opportunity currently active.',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      strength: 'strong',
    },
  ];
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  raas: { label: 'RAAS', color: 'text-brand-300', bg: 'bg-brand-500/10 border-brand-500/20', icon: '⇄' },
  lead_lag: { label: 'Lead-Lag', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', icon: '⚡' },
  caets: { label: 'CAETS', color: 'text-accent-cyan', bg: 'bg-accent-cyan/10 border-accent-cyan/20', icon: '📡' },
  insurance: { label: 'Insurance', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: '🛡' },
};

const STRENGTH_CONFIG: Record<string, { label: string; color: string }> = {
  strong: { label: 'Strong', color: 'text-green-400 bg-green-500/10' },
  moderate: { label: 'Moderate', color: 'text-yellow-400 bg-yellow-500/10' },
  weak: { label: 'Weak', color: 'text-slate-400 bg-slate-500/10' },
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<SignalEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setSignals(generateMockSignals());
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const filtered = filter === 'all' ? signals : signals.filter(s => s.type === filter);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 terminal-bg opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-accent-cyan/5 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm text-amber-400 font-medium" style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>
              MODEL SIGNALS — SIMULATED DATA
            </span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Strategy Signals</h1>
          <p className="text-lg text-slate-400 max-w-2xl">
            Real-time alerts from our backtested strategies. RAAS-scored arbitrage opportunities,
            CAETS transmission alerts, and portfolio hedge suggestions.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {/* Signal type legend */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'all' ? 'bg-white/10 text-white border border-white/20' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
          >
            All Signals
          </button>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filter === key ? `${cfg.bg} ${cfg.color} border` : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
            >
              <span>{cfg.icon}</span>
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Signals grid */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-strong rounded-xl p-6 animate-pulse">
                <div className="h-4 bg-slate-700/50 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-700/30 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-700/30 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-400 text-sm font-medium mb-1">No signals for this filter</p>
            <p className="text-slate-600 text-xs">Try selecting a different strategy type above</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(signal => {
              const typeCfg = TYPE_CONFIG[signal.type];
              const strengthCfg = STRENGTH_CONFIG[signal.strength];
              return (
                <div key={signal.id} className="glass-strong rounded-xl p-6 border border-slate-700/30 hover:border-slate-600/50 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${typeCfg.bg} ${typeCfg.color} border`}>
                        {typeCfg.icon} {typeCfg.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${strengthCfg.color}`}>
                        {strengthCfg.label}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono" title={new Date(signal.timestamp).toLocaleString()}>
                      {relativeTime(signal.timestamp)}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-1">{signal.title}</h3>
                  <p className="text-sm text-slate-400 mb-3">{signal.market} — <span className="text-slate-500">{signal.platform}</span></p>

                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Score:</span>
                      <span className={`text-sm font-mono font-bold ${typeCfg.color}`}>
                        {signal.score.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Action:</span>
                      <span className="text-sm text-white">{signal.direction}</span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300">{signal.description}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Methodology note */}
        <div className="mt-12 glass-strong rounded-xl p-6 border border-slate-700/20">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Signal Methodology</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
            <div>
              <strong className="text-brand-300">RAAS</strong> — Resolution-Aware Arbitrage Signal. Filters cross-platform opportunities by alignment quality and dispute risk. <Link href="/research/backtest?strategy=cross_platform_arb" className="text-brand-300 hover:underline">See S1 backtest →</Link>
            </div>
            <div>
              <strong className="text-yellow-400">Lead-Lag</strong> — Detects probability spikes that predict VIX movements 3-5 days ahead. <Link href="/research/backtest?strategy=lead_lag_vol" className="text-yellow-400 hover:underline">See S2 backtest →</Link>
            </div>
            <div>
              <strong className="text-accent-cyan">CAETS</strong> — Cross-Asset Event Transmission Score. Rolling beta of asset returns on lagged PM changes. <Link href="/research/backtest?strategy=lead_lag_vol" className="text-accent-cyan hover:underline">See methodology →</Link>
            </div>
            <div>
              <strong className="text-green-400">Insurance</strong> — Suggests prediction market contracts as portfolio hedges based on trust score and liquidity. <Link href="/research/backtest?strategy=insurance_overlay" className="text-green-400 hover:underline">See S3 backtest →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
