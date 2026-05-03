'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine, PieChart, Pie
} from 'recharts';

// ── Types ────────────────────────────────────────────────────
interface ChiSquareResult {
  threshold: number;
  n_low_trust: number;
  n_high_trust: number;
  risk_rate_low: number;
  risk_rate_high: number;
  lift_ratio: number;
  chi2: number;
  p_value: number;
  is_significant: boolean;
}

interface MLMetrics {
  model_type: string;
  n_samples: number;
  n_risky: number;
  risk_rate: number;
  auc_roc: number;
  auc_roc_cal: number;
  brier_uncal: number;
  brier_cal: number;
  logloss_uncal: number;
  logloss_cal: number;
  top_features: Array<{ feature: string; importance: number }>;
}

interface PnLStrategy {
  strategy: string;
  n_accepted: number;
  n_risky: number;
  n_safe: number;
  risk_rate: number;
  pnl: number;
  pnl_per_trade: number;
}

interface AlphaSignal {
  type: string;
  severity: string;
  market_id: string;
  question: string;
  yes_price: number;
  trust_score: number;
  volume_usd: number;
  signal_text: string;
  action: string;
}

interface BacktestData {
  timestamp: string;
  model: string;
  n_markets: number;
  chi_square: Record<string, ChiSquareResult>;
  ml_metrics: MLMetrics;
  pnl_simulation: PnLStrategy[];
}

interface APIResponse {
  status: string;
  dataExists: boolean;
  backtest: BacktestData | null;
  signals: { signals: AlphaSignal[]; summary: Record<string, number> } | null;
  ivSurface: {
    currency: string;
    indexPrice: number;
    fetchedAt: string;
    nExpiries: number;
    nInstruments: number;
  } | null;
}

// ── Stat Card ────────────────────────────────────────────────
function Stat({ label, value, sub, color = '#f1f5f9' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-xl border border-[#1e2a45] bg-[#0a1020] p-4">
      <p className="text-[10px] text-[#64748b] font-bold tracking-widest uppercase">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-[#475569] mt-1">{sub}</p>}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────
export default function BacktestPage() {
  const [data, setData]       = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tab, setTab]         = useState<'overview' | 'ml' | 'signals' | 'options'>('overview');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/backtest/results');
      if (!res.ok) throw new Error('Failed to load backtest data');
      const json = await res.json();
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingSkeleton />;
  if (error)   return <ErrorState message={error} />;
  if (!data?.dataExists) return <EmptyState />;

  const bt = data.backtest!;
  const ml = bt.ml_metrics;
  const chiResults = Object.values(bt.chi_square ?? {});
  const pnl = bt.pnl_simulation ?? [];
  const signals = data.signals?.signals ?? [];

  return (
    <div className="min-h-screen bg-[#060c14] text-white">
      {/* Header */}
      <div className="border-b border-[#1e2a45] bg-[#08101c]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d2518] border border-[#166534] text-[#34d399] text-[10px] font-bold tracking-[0.2em] mb-3">
                BACKTEST LAB v2.0 — ML ENHANCED
              </div>
              <h1 className="text-2xl font-bold text-white">
                Resolution Confidence Backtest
              </h1>
              <p className="text-[#64748b] text-sm mt-1 max-w-xl">
                {bt.n_markets.toLocaleString()} Polymarket markets · Trust Score + ML validation ·{' '}
                Walk-forward {ml.model_type.toUpperCase()} with isotonic calibration
              </p>
            </div>
            <div className="flex gap-2">
              {data.ivSurface && (
                <div className="text-right text-xs">
                  <div className="text-[#64748b]">BTC Index</div>
                  <div className="text-white font-bold">${data.ivSurface.indexPrice.toLocaleString()}</div>
                  <div className="text-[#475569]">{data.ivSurface.nInstruments} options</div>
                </div>
              )}
              <button
                onClick={fetchData}
                className="px-3 py-1 rounded-lg border border-[#1e2a45] text-[#64748b] hover:text-white text-xs transition-colors"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {(['overview', 'ml', 'signals', 'options'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-t-lg text-xs font-medium transition-colors ${
                  tab === t
                    ? 'bg-[#060c14] text-[#34d399] border-x border-t border-[#1e2a45]'
                    : 'text-[#64748b] hover:text-white'
                }`}
              >
                {t === 'overview' ? '📊 Overview' :
                 t === 'ml' ? '🤖 ML Model' :
                 t === 'signals' ? `🔔 Signals (${signals.length})` :
                 '📈 Options Bridge'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {tab === 'overview' && <OverviewTab chi={chiResults} ml={ml} pnl={pnl} n={bt.n_markets} />}
        {tab === 'ml'       && <MLTab ml={ml} />}
        {tab === 'signals'  && <SignalsTab signals={signals} summary={data.signals?.summary} />}
        {tab === 'options'  && <OptionsTab iv={data.ivSurface} />}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB: Overview
// ═══════════════════════════════════════════════════════════════

function OverviewTab({ chi, ml, pnl, n }: {
  chi: ChiSquareResult[]; ml: MLMetrics; pnl: PnLStrategy[]; n: number;
}) {
  // Find best chi-square threshold
  const bestChi = chi.reduce((a, b) => (a.lift_ratio > b.lift_ratio && a.is_significant) ? a : b, chi[0]);

  return (
    <div className="space-y-6">
      {/* Hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Stat label="Markets Tested" value={n.toLocaleString()} sub="Polymarket resolved" />
        <Stat label="ML AUC-ROC" value={ml.auc_roc.toFixed(3)} sub="Walk-forward OOS" color="#34d399" />
        <Stat label="Brier Score" value={ml.brier_cal.toFixed(4)} sub="Calibrated" color="#a78bfa" />
        <Stat label="Risk Rate" value={`${(ml.risk_rate * 100).toFixed(1)}%`} sub={`${ml.n_risky} risky markets`} color="#fbbf24" />
        <Stat label="Best Lift" value={`${bestChi?.lift_ratio?.toFixed(2) ?? '-'}×`} sub={`Threshold=${bestChi?.threshold ?? '-'}`} color="#34d399" />
        <Stat label="Best p-value" value={bestChi?.p_value < 0.001 ? '<0.001' : bestChi?.p_value?.toFixed(4) ?? '-'} sub={bestChi?.is_significant ? '✅ Significant' : '❌ Not sig.'} color={bestChi?.is_significant ? '#34d399' : '#f87171'} />
      </div>

      {/* Chi-square bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[#1e2a45] bg-[#060c14] p-5">
          <h3 className="text-sm font-bold text-white mb-1">Trust Score vs Resolution Risk</h3>
          <p className="text-xs text-[#475569] mb-4">Chi-square test at different thresholds</p>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chi.map(c => ({
                label: `< ${c.threshold}`,
                low:   +(c.risk_rate_low * 100).toFixed(1),
                high:  +(c.risk_rate_high * 100).toFixed(1),
                lift:  c.lift_ratio,
                sig:   c.is_significant,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a45" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#1e2a45' }} />
                <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} />
                <Tooltip contentStyle={{ background: '#0d1220', border: '1px solid #1e2a45', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="low" name="Low Trust Risk%" fill="#f87171" radius={[4,4,0,0]} maxBarSize={35} />
                <Bar dataKey="high" name="High Trust Risk%" fill="#34d399" radius={[4,4,0,0]} maxBarSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* P&L simulation */}
        <div className="rounded-xl border border-[#1e2a45] bg-[#060c14] p-5">
          <h3 className="text-sm font-bold text-white mb-1">Strategy P&L Comparison</h3>
          <p className="text-xs text-[#475569] mb-4">Hypothetical $100/trade across {n} markets</p>
          <div className="space-y-3">
            {pnl.map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-[#0d1220] last:border-0">
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">{s.strategy}</div>
                  <div className="text-xs text-[#475569]">
                    {s.n_accepted} trades · {(s.risk_rate * 100).toFixed(1)}% risk
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${s.pnl >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                    ${s.pnl.toLocaleString()}
                  </div>
                  <div className="text-xs text-[#475569]">
                    ${s.pnl_per_trade.toFixed(2)}/trade
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB: ML Model
// ═══════════════════════════════════════════════════════════════

function MLTab({ ml }: { ml: MLMetrics }) {
  const features = ml.top_features ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Model" value={ml.model_type.toUpperCase()} sub="Walk-forward validated" />
        <Stat label="AUC-ROC" value={ml.auc_roc.toFixed(4)} color="#34d399" sub="Uncalibrated" />
        <Stat label="AUC-ROC (Cal)" value={ml.auc_roc_cal.toFixed(4)} color="#6ee7b7" sub="Isotonic calibration" />
        <Stat label="Brier Score" value={ml.brier_cal.toFixed(6)} color="#a78bfa" sub={`Uncal: ${ml.brier_uncal.toFixed(6)}`} />
      </div>

      {/* Feature importance chart */}
      <div className="rounded-xl border border-[#1e2a45] bg-[#060c14] p-5">
        <h3 className="text-sm font-bold text-white mb-1">Feature Importance (Top 15)</h3>
        <p className="text-xs text-[#475569] mb-4">
          What drives resolution risk prediction — ranked by split gain
        </p>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={features} layout="vertical" margin={{ left: 160 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a45" />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} />
              <YAxis type="category" dataKey="feature" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} width={155} />
              <Tooltip contentStyle={{ background: '#0d1220', border: '1px solid #1e2a45', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="importance" radius={[0,4,4,0]} maxBarSize={18}>
                {features.map((f, i) => (
                  <Cell key={i} fill={i === 0 ? '#34d399' : i < 3 ? '#22d3ee' : '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Calibration metrics */}
      <div className="rounded-xl border border-[#1e2a45] bg-[#060c14] p-5">
        <h3 className="text-sm font-bold text-white mb-4">Calibration Metrics</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <h4 className="text-xs text-[#64748b] font-medium mb-2">Log-Loss</h4>
            <div className="flex gap-4">
              <div><span className="text-xs text-[#475569]">Uncal:</span> <span className="text-sm text-white font-mono">{ml.logloss_uncal.toFixed(6)}</span></div>
              <div><span className="text-xs text-[#475569]">Cal:</span> <span className="text-sm text-[#34d399] font-mono">{ml.logloss_cal.toFixed(6)}</span></div>
            </div>
          </div>
          <div>
            <h4 className="text-xs text-[#64748b] font-medium mb-2">Improvement</h4>
            <div className="text-lg font-bold text-[#34d399]">
              {((1 - ml.brier_cal / ml.brier_uncal) * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-[#475569]">Brier score reduction after calibration</div>
          </div>
          <div>
            <h4 className="text-xs text-[#64748b] font-medium mb-2">Class Balance</h4>
            <div className="text-sm text-white">
              {ml.n_risky} risky / {ml.n_samples - ml.n_risky} safe
            </div>
            <div className="text-xs text-[#475569]">{(ml.risk_rate * 100).toFixed(1)}% base rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB: Signals
// ═══════════════════════════════════════════════════════════════

function SignalsTab({ signals, summary }: {
  signals: AlphaSignal[]; summary?: Record<string, number>;
}) {
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? signals : signals.filter(s => s.type === filter);

  const typeColors: Record<string, string> = {
    TRUST_TRAP:  '#f87171',
    TRUST_VALUE: '#34d399',
    THIN_MARKET: '#fbbf24',
    OPTIONS_ARB: '#a78bfa',
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[#1e2a45] bg-[#0a1020]">
        <div className="text-sm font-bold text-white">{signals.length} Active Signals</div>
        {summary && (
          <div className="flex gap-3 text-xs">
            <span className="text-[#f87171]">🔴 {summary.high ?? 0} High</span>
            <span className="text-[#fbbf24]">🟡 {summary.medium ?? 0} Medium</span>
            <span className="text-[#34d399]">🟢 {summary.low ?? 0} Low</span>
          </div>
        )}
        <div className="flex-1" />
        <div className="flex gap-1">
          {['all', 'TRUST_TRAP', 'TRUST_VALUE', 'THIN_MARKET', 'OPTIONS_ARB'].map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                filter === t ? 'bg-[#0d2518] text-[#34d399] border border-[#166534]' : 'text-[#64748b] hover:text-white'
              }`}
            >
              {t === 'all' ? 'All' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Signal cards */}
      <div className="space-y-3">
        {filtered.slice(0, 25).map((s, i) => (
          <div key={i} className="rounded-xl border border-[#1e2a45] bg-[#0a1020] p-4 hover:bg-[#0d1528] transition-colors">
            <div className="flex items-start gap-3">
              <div className="text-lg">
                {s.severity === 'HIGH' ? '🔴' : s.severity === 'MEDIUM' ? '🟡' : '🟢'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold"
                    style={{ color: typeColors[s.type] ?? '#64748b', background: `${typeColors[s.type] ?? '#64748b'}18`, border: `1px solid ${typeColors[s.type] ?? '#64748b'}40` }}
                  >
                    {s.type.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-[#475569]">
                    Trust: {s.trust_score}/100 · Price: {(s.yes_price * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm text-white mb-1">{s.question}</p>
                <p className="text-xs text-[#64748b]">{s.signal_text}</p>
              </div>
              <div className="text-right">
                <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                  s.action.includes('AVOID') ? 'text-[#f87171] bg-[#f8717118]' :
                  s.action.includes('SHORT') ? 'text-[#fbbf24] bg-[#fbbf2418]' :
                  s.action.includes('BUY') ? 'text-[#34d399] bg-[#34d39918]' :
                  'text-[#64748b] bg-[#64748b18]'
                }`}>
                  {s.action}
                </span>
                {s.volume_usd > 0 && (
                  <div className="text-[10px] text-[#475569] mt-1">
                    Vol: ${s.volume_usd.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB: Options Bridge
// ═══════════════════════════════════════════════════════════════

function OptionsTab({ iv }: { iv: APIResponse['ivSurface'] }) {
  return (
    <div className="space-y-6">
      {iv ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Currency" value={iv.currency} />
            <Stat label="Index Price" value={`$${iv.indexPrice.toLocaleString()}`} color="#fbbf24" />
            <Stat label="Options Analyzed" value={String(iv.nInstruments)} />
            <Stat label="Expiry Dates" value={String(iv.nExpiries)} />
          </div>

          <div className="rounded-xl border border-[#1e2a45] bg-[#060c14] p-6">
            <h3 className="text-sm font-bold text-white mb-2">Deribit ↔ Polymarket Cross-Pricing</h3>
            <p className="text-xs text-[#475569] mb-4">
              Compares options-implied probability N(d2) with prediction market prices.
              Differences &gt;5% are flagged as potential arbitrage.
            </p>
            <div className="p-8 text-center border border-dashed border-[#1e2a45] rounded-lg">
              <div className="text-3xl mb-3">📈</div>
              <p className="text-sm text-[#94a3b8] mb-2">
                IV surface fetched: {new Date(iv.fetchedAt).toLocaleString()}
              </p>
              <p className="text-xs text-[#475569]">
                Run <code className="text-[#34d399]">python3 src_file/scripts/deribit_iv_surface.py</code> to refresh,
                then <code className="text-[#34d399]">python3 src_file/scripts/alpha_scanner.py</code> for new signals
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-[#1e2a45] bg-[#060c14] p-12 text-center">
          <div className="text-4xl mb-4">📉</div>
          <h3 className="text-lg font-bold text-white mb-2">No Options Data</h3>
          <p className="text-sm text-[#64748b] max-w-md mx-auto mb-4">
            Run the Deribit IV surface fetcher to enable options-vs-prediction-market arbitrage detection.
          </p>
          <code className="text-xs text-[#34d399] bg-[#0d1220] px-3 py-1 rounded">
            python3 src_file/scripts/deribit_iv_surface.py --currency BTC
          </code>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// Utility States
// ═══════════════════════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#060c14] p-8 space-y-4 animate-pulse">
      <div className="h-16 rounded-xl bg-[#0d1220]" />
      <div className="grid grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl bg-[#0d1220]" />)}
      </div>
      <div className="h-64 rounded-xl bg-[#0d1220]" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#060c14] p-8 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-bold text-white mb-2">Error Loading Data</h2>
        <p className="text-sm text-[#f87171]">{message}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="min-h-screen bg-[#060c14] p-8 flex items-center justify-center">
      <div className="text-center max-w-lg">
        <div className="text-5xl mb-4">🧪</div>
        <h2 className="text-xl font-bold text-white mb-3">Backtest Lab — Ready to Initialize</h2>
        <p className="text-sm text-[#64748b] mb-6">
          Run the data pipeline to populate the backtest results.
          This will fetch 5,000+ Polymarket markets, compute trust scores,
          train an ML model, and generate alpha signals.
        </p>
        <div className="text-left bg-[#0d1220] rounded-xl p-4 text-xs font-mono text-[#34d399] space-y-1">
          <p># Step 1: Fetch historical markets</p>
          <p>python3 src_file/scripts/fetch_historical_markets.py --limit 5000</p>
          <p># Step 2: Score trust</p>
          <p>python3 src_file/scripts/compute_historical_trust.py</p>
          <p># Step 3: ML backtest</p>
          <p>python3 src_file/scripts/ml_enhanced_backtest.py</p>
          <p># Step 4: Alpha scan</p>
          <p>python3 src_file/scripts/alpha_scanner.py</p>
          <p># Step 5: Options bridge</p>
          <p>python3 src_file/scripts/deribit_iv_surface.py</p>
        </div>
      </div>
    </div>
  );
}
