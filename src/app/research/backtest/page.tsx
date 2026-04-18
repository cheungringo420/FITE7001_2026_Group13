'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, Cell
} from 'recharts';

// Robustness payloads come in two shapes: either a scalar Sharpe or a
// { sharpe, ann_return, … } dict keyed by scenario name. `any` on that field
// was causing the rest of the render to be type-unsafe; this union captures
// the real shape.
type RobustnessEntry = number | { sharpe: number; ann_return?: number; [key: string]: number | undefined };

// Strategy-specific diagnostic blocks (hedge effectiveness, dynamic-vs-static)
// are ad-hoc numeric/bool dicts; keep a narrow-but-flexible type so downstream
// arithmetic and .toFixed() calls stay type-safe.
interface HedgeEffectiveness {
  beta_vs_spy: number;
  correlation_vs_spy: number;
  is_genuine_hedge: boolean;
  [key: string]: number | boolean;
}
interface DynamicVsStatic {
  dynamic_sharpe: number;
  static_sharpe: number;
  carry_cost_saved_pct: number;
  drawdown_improvement: number;
  [key: string]: number;
}

interface StrategyResult {
  strategy: string;
  train_metrics: Record<string, number>;
  test_metrics: Record<string, number>;
  equity_curve: { date: string; value: number }[];
  monotonicity: number[];
  factor_regression: { alpha: number; alpha_tstat: number; r_squared: number; betas: Record<string, { beta: number; tstat: number }> };
  event_study: { day: number; car: number; n_events: number }[];
  risk_metrics: { train: Record<string, number>; test: Record<string, number> };
  overfit_check: { train_sharpe: number; test_sharpe: number; ratio: number | null; flagged: boolean };
  robustness: Record<string, RobustnessEntry>;
  trade_log: { entry: string; exit: string; pnl: number }[];
  novel_contribution?: { name: string; full_name: string; description: string; formula: string };
  predictive_regression?: Record<string, { beta: number; tstat: number; r2: number }>;
  honest_finding?: string;
  caveat?: string;
  hedge_effectiveness?: HedgeEffectiveness;
  dynamic_vs_static?: DynamicVsStatic;
  sensitivity?: {
    sharpe_grid: number[][];
    param_x: { name: string; values: number[]; label?: string; fmt?: 'pct' | 'float' | 'int' };
    param_y: { name: string; values: number[]; label?: string; fmt?: 'pct' | 'float' | 'int' };
    max_cell: { row: number; col: number };
    stability_score: number;
  };
  regime_sizing?: {
    static: { sharpe: number; ann_return: number; ann_vol: number; max_drawdown: number };
    regime: { sharpe: number; ann_return: number; ann_vol: number; max_drawdown: number };
    multipliers: Record<string, number>;
    regime_labels: Array<{ date: string; label: number | null }>;
    regime_pct: Record<string, number>;
    equity: {
      static: Array<{ date: string; value: number }>;
      regime: Array<{ date: string; value: number }>;
    };
    improvement: { sharpe_delta: number; max_drawdown_delta: number };
  };
  walk_forward?: {
    folds: Array<{
      fold: number;
      train_start: string;
      train_end: string;
      test_start: string;
      test_end: string;
      train_sharpe: number;
      test_sharpe: number;
      n_train: number;
      n_test: number;
    }>;
    summary: {
      n_folds: number;
      mean_train_sharpe: number;
      mean_test_sharpe: number;
      sharpe_decay: number;
      anchored: boolean;
      train_window: number;
      test_window: number;
      step: number;
    };
  };
  rigor?: {
    monte_carlo: {
      sharpe: { point_estimate: number; ci_lower: number; ci_upper: number; std_error: number };
      max_drawdown: { point_estimate: number; ci_lower: number; ci_upper: number; std_error: number };
      ann_return: { point_estimate: number; ci_lower: number; ci_upper: number; std_error: number };
      n_simulations: number;
      method: string;
      block_size: number | null;
    };
    deflated_sharpe: {
      psr: number | null;
      dsr: number | null;
      n_trials: number;
      trial_sharpe_variance: number;
    };
    regime_analysis: {
      regime_names: Record<string, string>;
      table: Array<{
        regime: string;
        label: number;
        n_days: number;
        sharpe: number;
        ann_return: number;
        ann_vol: number;
        max_drawdown: number;
      }>;
    };
  };
}

const STRATEGY_NAMES: Record<string, string> = {
  cross_platform_arb: 'Cross-Platform Arbitrage',
  lead_lag_vol: 'Volatility Timing (Lead-Lag)',
  insurance_overlay: 'Event Insurance Overlay',
  dynamic_hedge: 'Dynamic Hedge Calibration',
  mean_reversion: 'Mean Reversion',
  market_making: 'Market Making (Simulation)',
};

const STRATEGY_IDS = Object.keys(STRATEGY_NAMES);

function MetricRow({ label, train, test, fmt }: { label: string; train: number; test: number; fmt?: (n: number) => string }) {
  const format = fmt || ((n: number) => n.toFixed(4));
  const isNeg = test < 0;
  return (
    <tr className="border-b border-slate-700/10">
      <td className="py-2 px-3 text-slate-400 text-sm">{label}</td>
      <td className="py-2 px-3 text-sm text-right font-mono text-slate-300">{format(train)}</td>
      <td className={`py-2 px-3 text-sm text-right font-mono ${isNeg ? 'text-red-400' : 'text-white'}`}>{format(test)}</td>
    </tr>
  );
}

function SharpeColor({ value }: { value: number }) {
  const color = value >= 1.5 ? 'text-green-400' : value >= 1 ? 'text-brand-300' : value >= 0.5 ? 'text-yellow-400' : value >= 0 ? 'text-orange-400' : 'text-red-400';
  return <span className={`font-bold ${color}`}>{value.toFixed(2)}</span>;
}

function formatAxisValue(v: number, fmt?: 'pct' | 'float' | 'int') {
  if (fmt === 'pct') return `${(v * 100).toFixed(v < 0.01 ? 2 : 1)}%`;
  if (fmt === 'int') return v.toFixed(0);
  return v.toFixed(2);
}

function heatmapCellColor(v: number, min: number, max: number): string {
  // Linear interpolation: red (low) → amber (mid) → green (high).
  if (max === min) return 'rgb(100, 116, 139)';
  const t = (v - min) / (max - min);
  if (t < 0.5) {
    const a = t * 2; // 0 → 1
    const r = 239, g = Math.round(68 + (191 - 68) * a), b = Math.round(68 + (36 - 68) * a);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const a = (t - 0.5) * 2; // 0 → 1
  const r = Math.round(239 + (34 - 239) * a), g = Math.round(191 + (197 - 191) * a), b = Math.round(36 + (94 - 36) * a);
  return `rgb(${r}, ${g}, ${b})`;
}

const REGIME_LABEL_NAMES: Record<number, string> = {
  0: 'low_vol',
  1: 'high_vol',
  2: 'crisis_vol',
  3: 'extreme_vol',
};

function RegimeSizingPanel({ data }: { data: NonNullable<StrategyResult['regime_sizing']> }) {
  const { static: st, regime: rg, multipliers, regime_pct, equity, improvement } = data;

  // Merge the two equity curves by date for the paired line chart.
  const mergedEquity = useMemo(() => {
    const byDate = new Map<string, { date: string; static?: number; regime?: number }>();
    equity.static.forEach(p => byDate.set(p.date, { date: p.date, static: p.value }));
    equity.regime.forEach(p => {
      const cur = byDate.get(p.date) ?? { date: p.date };
      cur.regime = p.value;
      byDate.set(p.date, cur);
    });
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [equity]);

  const ddDeltaPct = improvement.max_drawdown_delta * 100;
  const srDelta = improvement.sharpe_delta;

  const ddBadge = ddDeltaPct >= 5
    ? 'bg-green-500/15 text-green-300 border-green-500/30'
    : ddDeltaPct >= 2
    ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
    : 'bg-slate-600/15 text-slate-300 border-slate-600/30';

  return (
    <div className="glass-strong rounded-xl p-6">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-white">Regime-Conditional Position Sizing</h3>
        <span className={`px-2.5 py-1 rounded-full text-xs font-mono border ${ddBadge}`}>
          Max DD improved by {ddDeltaPct >= 0 ? '+' : ''}{ddDeltaPct.toFixed(2)}pp
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-5">
        Exposure is scaled down in high-volatility regimes to preserve capital during tail events.
        The same strategy signal drives both curves — only the position size differs.
      </p>

      {/* Metric comparison table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/30 text-slate-500">
              <th className="text-left py-2 px-3 text-xs font-medium">Configuration</th>
              <th className="text-right py-2 px-3 text-xs font-medium">Sharpe</th>
              <th className="text-right py-2 px-3 text-xs font-medium">Ann. Return</th>
              <th className="text-right py-2 px-3 text-xs font-medium">Ann. Vol</th>
              <th className="text-right py-2 px-3 text-xs font-medium">Max Drawdown</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-700/10">
              <td className="py-2.5 px-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-700/40 text-slate-300">Static</span>
                <span className="ml-2 text-slate-300 text-sm">Always-on exposure</span>
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-slate-200">{st.sharpe.toFixed(2)}</td>
              <td className={`py-2.5 px-3 text-right font-mono ${st.ann_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(st.ann_return * 100).toFixed(2)}%
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-slate-300">{(st.ann_vol * 100).toFixed(2)}%</td>
              <td className="py-2.5 px-3 text-right font-mono text-red-400">{(st.max_drawdown * 100).toFixed(2)}%</td>
            </tr>
            <tr className="bg-brand-500/5">
              <td className="py-2.5 px-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-brand-500/20 text-brand-300">Regime</span>
                <span className="ml-2 text-white text-sm font-medium">Vol-regime scaled</span>
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-slate-200">{rg.sharpe.toFixed(2)}</td>
              <td className={`py-2.5 px-3 text-right font-mono ${rg.ann_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(rg.ann_return * 100).toFixed(2)}%
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-slate-300">{(rg.ann_vol * 100).toFixed(2)}%</td>
              <td className="py-2.5 px-3 text-right font-mono text-red-400">{(rg.max_drawdown * 100).toFixed(2)}%</td>
            </tr>
            <tr>
              <td className="py-2 px-3 text-xs text-slate-500 uppercase tracking-wider">Improvement</td>
              <td className={`py-2 px-3 text-right font-mono text-xs ${srDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {srDelta >= 0 ? '+' : ''}{srDelta.toFixed(2)}
              </td>
              <td className="py-2 px-3 text-right text-xs text-slate-500">—</td>
              <td className={`py-2 px-3 text-right font-mono text-xs ${rg.ann_vol < st.ann_vol ? 'text-green-400' : 'text-slate-400'}`}>
                {((rg.ann_vol - st.ann_vol) * 100).toFixed(2)}pp
              </td>
              <td className={`py-2 px-3 text-right font-mono text-xs ${ddDeltaPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {ddDeltaPct >= 0 ? '+' : ''}{ddDeltaPct.toFixed(2)}pp
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Multipliers + regime distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-slate-800/30">
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Exposure Multipliers</div>
          <div className="space-y-1.5">
            {Object.entries(multipliers).map(([label, mult]) => {
              const name = REGIME_LABEL_NAMES[Number(label)] || `regime_${label}`;
              return (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                    name === 'low_vol' ? 'bg-green-500/10 text-green-300' :
                    name === 'high_vol' ? 'bg-red-500/10 text-red-300' :
                    'bg-slate-500/10 text-slate-300'
                  }`}>
                    {name}
                  </span>
                  <span className="font-mono text-slate-200">{(mult * 100).toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-slate-800/30">
          <div className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Time in Regime</div>
          <div className="space-y-1.5">
            {Object.entries(regime_pct).sort(([a], [b]) => Number(a) - Number(b)).map(([label, pct]) => {
              const name = REGIME_LABEL_NAMES[Number(label)] || `regime_${label}`;
              return (
                <div key={label} className="flex items-center gap-2 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono min-w-[72px] text-center ${
                    name === 'low_vol' ? 'bg-green-500/10 text-green-300' :
                    name === 'high_vol' ? 'bg-red-500/10 text-red-300' :
                    'bg-slate-500/10 text-slate-300'
                  }`}>
                    {name}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-900/50 overflow-hidden">
                    <div
                      className={`h-full ${name === 'low_vol' ? 'bg-green-500/50' : name === 'high_vol' ? 'bg-red-500/50' : 'bg-slate-500/50'}`}
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-slate-300 min-w-[48px] text-right">{(pct * 100).toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Paired equity curves */}
      <div>
        <div className="text-sm font-medium text-white mb-2">Equity Curves (synthetic 1-year stress scenario)</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedEquity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}K`}
                domain={['dataMin', 'dataMax']}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                formatter={(v: number | undefined, name) =>
                  [`$${(v ?? 0).toLocaleString()}`, String(name) === 'static' ? 'Static' : 'Regime-scaled']
                }
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Line type="monotone" dataKey="static" name="Static" stroke="#94a3b8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="regime" name="Regime-scaled" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-slate-500 mt-3 italic">
          Both curves use the same strategy signal. The regime-scaled line throttles exposure during high-vol blocks,
          preserving capital for the next low-vol window.
        </p>
      </div>
    </div>
  );
}

function WalkForwardPanel({ data }: { data: NonNullable<StrategyResult['walk_forward']> }) {
  const { folds, summary } = data;

  if (folds.length === 0) {
    return (
      <div className="mt-8 pt-6 border-t border-slate-700/30">
        <h4 className="text-md font-semibold text-white mb-2">Walk-Forward Analysis</h4>
        <p className="text-sm text-slate-400">Insufficient data for walk-forward folds.</p>
      </div>
    );
  }

  const decay = summary.sharpe_decay;
  const decayPct = decay * 100;
  // Decay below 20% = robust (green), 20–50% = caution (yellow), >50% = likely overfit (red).
  const decayColor = decayPct <= 20
    ? 'bg-green-500/15 text-green-300 border-green-500/30'
    : decayPct <= 50
    ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
    : 'bg-red-500/15 text-red-300 border-red-500/30';
  const decayVerdict = decayPct <= 20 ? 'Robust' : decayPct <= 50 ? 'Caution' : 'Likely Overfit';

  // Chart dimensions.
  const yVals = folds.flatMap(f => [f.train_sharpe, f.test_sharpe]);
  const yMin = Math.min(0, ...yVals);
  const yMax = Math.max(0, ...yVals);
  const yRange = yMax - yMin || 1;

  const chartH = 180;
  const barGroupW = 54;
  const barW = 22;
  const barGap = 4;
  const padL = 40;
  const chartW = padL + folds.length * barGroupW + 20;

  const yToPx = (v: number) => {
    const t = (v - yMin) / yRange;
    return chartH - t * chartH;
  };
  const zeroY = yToPx(0);

  return (
    <div className="mt-8 pt-6 border-t border-slate-700/30">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <h4 className="text-md font-semibold text-white">Walk-Forward Analysis (Anchored)</h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">
            train={summary.train_window}d · test={summary.test_window}d · step={summary.step}d
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-mono border ${decayColor}`}>
            Decay: {decayPct >= 0 ? '+' : ''}{decayPct.toFixed(1)}% · {decayVerdict}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-5">
        Anchored walk-forward: training window starts at origin and expands with each fold; the next {summary.test_window}-day
        window is out-of-sample. Low Sharpe decay from train to test means the strategy generalizes.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-3 rounded-lg bg-slate-800/30 text-center">
          <div className="text-xs text-slate-400 mb-1">Mean Train Sharpe</div>
          <div className="text-lg font-bold font-mono text-slate-200">{summary.mean_train_sharpe.toFixed(2)}</div>
        </div>
        <div className="p-3 rounded-lg bg-slate-800/30 text-center">
          <div className="text-xs text-slate-400 mb-1">Mean Test Sharpe</div>
          <div className={`text-lg font-bold font-mono ${summary.mean_test_sharpe >= 0 ? 'text-brand-300' : 'text-red-400'}`}>
            {summary.mean_test_sharpe.toFixed(2)}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-slate-800/30 text-center">
          <div className="text-xs text-slate-400 mb-1">Folds</div>
          <div className="text-lg font-bold font-mono text-slate-200">{summary.n_folds}</div>
        </div>
      </div>

      {/* Paired bar chart */}
      <div className="overflow-x-auto">
        <svg width={chartW} height={chartH + 50} className="block">
          {/* Y-axis zero line */}
          <line x1={padL} y1={zeroY} x2={chartW - 10} y2={zeroY} stroke="#475569" strokeDasharray="2 2" />
          <text x={padL - 6} y={zeroY + 3} fontSize="9" fill="#64748b" textAnchor="end">0</text>
          {/* Y-axis bounds */}
          <text x={padL - 6} y={yToPx(yMax) + 3} fontSize="9" fill="#64748b" textAnchor="end">{yMax.toFixed(1)}</text>
          <text x={padL - 6} y={yToPx(yMin) + 3} fontSize="9" fill="#64748b" textAnchor="end">{yMin.toFixed(1)}</text>

          {folds.map((f, i) => {
            const groupX = padL + i * barGroupW;
            const trainY = yToPx(f.train_sharpe);
            const testY = yToPx(f.test_sharpe);
            const trainH = Math.abs(trainY - zeroY);
            const testH = Math.abs(testY - zeroY);
            const trainTop = Math.min(trainY, zeroY);
            const testTop = Math.min(testY, zeroY);
            return (
              <g key={i}>
                <rect x={groupX} y={trainTop} width={barW} height={trainH}
                  fill="#64748b"
                  opacity={0.7}>
                  <title>Fold {f.fold} train {f.train_start}→{f.train_end}: Sharpe {f.train_sharpe.toFixed(3)}</title>
                </rect>
                <rect x={groupX + barW + barGap} y={testTop} width={barW} height={testH}
                  fill={f.test_sharpe >= 0 ? '#6366f1' : '#ef4444'}>
                  <title>Fold {f.fold} test {f.test_start}→{f.test_end}: Sharpe {f.test_sharpe.toFixed(3)}</title>
                </rect>
                <text x={groupX + barW} y={chartH + 14} fontSize="10" fill="#94a3b8" textAnchor="middle">
                  F{f.fold}
                </text>
                <text x={groupX + barW} y={chartH + 28} fontSize="9" fill="#64748b" textAnchor="middle">
                  {f.test_start.slice(5)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#64748b', opacity: 0.7 }} />
          Train (in-sample)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#6366f1' }} />
          Test (out-of-sample)
        </div>
      </div>

      {/* Fold table */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/30 text-slate-500">
              <th className="text-left py-2 px-2 font-medium">Fold</th>
              <th className="text-left py-2 px-2 font-medium">Train Window</th>
              <th className="text-left py-2 px-2 font-medium">Test Window</th>
              <th className="text-right py-2 px-2 font-medium">Train SR</th>
              <th className="text-right py-2 px-2 font-medium">Test SR</th>
              <th className="text-right py-2 px-2 font-medium">Δ</th>
            </tr>
          </thead>
          <tbody>
            {folds.map(f => {
              const delta = f.train_sharpe - f.test_sharpe;
              return (
                <tr key={f.fold} className="border-b border-slate-700/10">
                  <td className="py-1.5 px-2 font-mono text-slate-300">F{f.fold}</td>
                  <td className="py-1.5 px-2 font-mono text-slate-400">{f.train_start} → {f.train_end}</td>
                  <td className="py-1.5 px-2 font-mono text-slate-400">{f.test_start} → {f.test_end}</td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-200">{f.train_sharpe.toFixed(2)}</td>
                  <td className={`py-1.5 px-2 text-right font-mono font-semibold ${f.test_sharpe >= 0 ? 'text-brand-300' : 'text-red-400'}`}>
                    {f.test_sharpe.toFixed(2)}
                  </td>
                  <td className={`py-1.5 px-2 text-right font-mono ${Math.abs(delta) < 0.2 ? 'text-green-400' : delta > 0 ? 'text-yellow-400' : 'text-slate-400'}`}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SensitivityHeatmap({ data }: { data: NonNullable<StrategyResult['sensitivity']> }) {
  const { sharpe_grid, param_x, param_y, max_cell, stability_score } = data;
  const flat = sharpe_grid.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);

  const stabColor = stability_score >= 0.8
    ? 'bg-green-500/15 text-green-300 border-green-500/30'
    : stability_score >= 0.6
    ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
    : 'bg-red-500/15 text-red-300 border-red-500/30';

  return (
    <div className="mt-8 pt-6 border-t border-slate-700/30">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <h4 className="text-md font-semibold text-white">Parameter Sensitivity Surface</h4>
        <span className={`px-2.5 py-1 rounded-full text-xs font-mono border ${stabColor}`}>
          Stability: {(stability_score * 100).toFixed(1)}%
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-5">
        Sharpe across a 2D parameter grid. Green cells = high Sharpe. A flat surface (high stability) means
        the result isn&apos;t a cherry-picked threshold. The peak cell is outlined.
      </p>

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* X-axis label */}
          <div className="text-xs text-slate-500 text-center mb-2 font-medium">
            {param_x.label || param_x.name}
          </div>
          <div className="flex">
            {/* Y-axis label (rotated) */}
            <div className="flex items-center justify-center pr-2">
              <div
                className="text-xs text-slate-500 font-medium whitespace-nowrap"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                {param_y.label || param_y.name}
              </div>
            </div>

            <div>
              {/* X-axis tick labels */}
              <div className="flex">
                <div className="w-14" /> {/* spacer for y-axis tick column */}
                {param_x.values.map((v, i) => (
                  <div key={i} className="w-16 text-center text-[10px] text-slate-400 font-mono pb-1">
                    {formatAxisValue(v, param_x.fmt)}
                  </div>
                ))}
              </div>

              {/* Grid rows */}
              {sharpe_grid.map((row, i) => (
                <div key={i} className="flex">
                  <div className="w-14 pr-2 text-right text-[10px] text-slate-400 font-mono flex items-center justify-end">
                    {formatAxisValue(param_y.values[i], param_y.fmt)}
                  </div>
                  {row.map((val, j) => {
                    const isMax = max_cell.row === i && max_cell.col === j;
                    return (
                      <div
                        key={j}
                        className={`w-16 h-12 flex items-center justify-center text-xs font-mono font-semibold ${
                          isMax ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 z-10 relative' : ''
                        }`}
                        style={{
                          backgroundColor: heatmapCellColor(val, min, max),
                          color: val > (min + max) / 2 ? '#0f172a' : '#f8fafc',
                        }}
                        title={`${param_x.name}=${formatAxisValue(param_x.values[j], param_x.fmt)}, ${param_y.name}=${formatAxisValue(param_y.values[i], param_y.fmt)} → Sharpe ${val.toFixed(3)}`}
                      >
                        {val.toFixed(2)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-slate-400">
            <span className="font-mono">{min.toFixed(2)}</span>
            <div
              className="h-2 w-40 rounded"
              style={{
                background: 'linear-gradient(to right, rgb(239,68,68), rgb(239,191,36), rgb(34,197,94))',
              }}
            />
            <span className="font-mono">{max.toFixed(2)}</span>
            <span className="text-slate-500 ml-2">Sharpe</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-5">
        Peak at {param_x.name}={formatAxisValue(param_x.values[max_cell.col], param_x.fmt)},{' '}
        {param_y.name}={formatAxisValue(param_y.values[max_cell.row], param_y.fmt)}. High stability
        (&ge;80%) indicates the strategy is robust to parameter perturbations.
      </p>
    </div>
  );
}

function BacktestPageInner() {
  const searchParams = useSearchParams();
  const initialStrategy = searchParams.get('strategy') || 'cross_platform_arb';

  const [selected, setSelected] = useState(initialStrategy);
  const [data, setData] = useState<StrategyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'equity' | 'factors' | 'robustness' | 'events' | 'rigor'>('overview');

  useEffect(() => {
    // Abort stale fetches when the user switches strategy mid-flight.
    const controller = new AbortController();
    let alive = true;
    // Defer the setState(true) to a microtask so we don't trigger a cascading
    // render in the effect body itself (React hook rule: no sync setState in effects).
    Promise.resolve().then(() => { if (alive) setLoading(true); });

    fetch(`/backtest-results/${selected}.json`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch((e) => { if (alive && e?.name !== 'AbortError') setLoading(false); });

    return () => { alive = false; controller.abort(); };
  }, [selected]);

  const monoData = useMemo(() => {
    if (!data?.monotonicity) return [];
    return data.monotonicity.map((v, i) => ({
      bucket: `Q${i + 1}`,
      return: v * 100,
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-2 border-slate-700 border-t-brand-400 animate-spin" />
          <div className="text-sm text-slate-400 font-mono tracking-wide">
            loading {STRATEGY_NAMES[selected] ?? selected}…
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-strong rounded-xl p-8 max-w-md text-center">
          <div className="text-4xl mb-3">⚠</div>
          <div className="text-red-400 font-semibold mb-2">Failed to load results</div>
          <div className="text-sm text-slate-400 mb-4">
            No backtest JSON found for <span className="font-mono text-slate-300">{selected}</span>.
          </div>
          <button
            onClick={() => setSelected('cross_platform_arb')}
            className="px-4 py-2 text-sm rounded-lg bg-brand-500/10 text-brand-300 border border-brand-500/30 hover:bg-brand-500/20 transition-colors"
          >
            Back to Cross-Platform Arbitrage
          </button>
        </div>
      </div>
    );
  }

  const tm = data.train_metrics;
  const sm = data.test_metrics;
  const pctFmt = (n: number) => `${(n * 100).toFixed(2)}%`;
  const fmtN = (n: number) => n.toFixed(4);

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="border-b border-slate-800/50 bg-gradient-to-r from-brand-500/5 via-transparent to-accent-cyan/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
            <Link href="/research" className="hover:text-brand-300 transition-colors">Research</Link>
            <span>/</span>
            <span className="text-white">Backtest Results</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">{STRATEGY_NAMES[selected] || selected}</h1>

          {/* Strategy selector */}
          <div className="flex flex-wrap gap-2 mt-4">
            {STRATEGY_IDS.map(id => (
              <button
                key={id}
                onClick={() => setSelected(id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selected === id
                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {STRATEGY_NAMES[id]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Alerts */}
        {data.honest_finding && (
          <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm">
            <strong>Honest Finding:</strong> {data.honest_finding}
          </div>
        )}
        {data.caveat && (
          <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
            <strong>Caveat:</strong> {data.caveat}
          </div>
        )}
        {data.overfit_check?.flagged && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            <strong>Overfitting Warning:</strong> Test Sharpe is less than 50% of train Sharpe. Strategy may be overfit.
          </div>
        )}

        {/* Tab nav */}
        <div className="flex gap-1 mb-6 border-b border-slate-800/50">
          {(['overview', 'equity', 'factors', 'robustness', 'events', 'rigor'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-all border-b-2 ${
                activeTab === tab
                  ? 'border-brand-500 text-brand-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Table */}
            <div className="glass-strong rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
              <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full min-w-[20rem]">
                <thead>
                  <tr className="border-b border-slate-700/30">
                    <th className="text-left py-2 px-3 text-slate-500 text-xs font-medium">Metric</th>
                    <th className="text-right py-2 px-3 text-slate-500 text-xs font-medium">Train</th>
                    <th className="text-right py-2 px-3 text-slate-500 text-xs font-medium">Test (OOS)</th>
                  </tr>
                </thead>
                <tbody>
                  <MetricRow label="Sharpe Ratio" train={tm.sharpe} test={sm.sharpe} fmt={fmtN} />
                  <MetricRow label="Sortino Ratio" train={tm.sortino} test={sm.sortino} fmt={fmtN} />
                  <MetricRow label="Calmar Ratio" train={tm.calmar} test={sm.calmar} fmt={fmtN} />
                  <MetricRow label="Ann. Return" train={tm.ann_return} test={sm.ann_return} fmt={pctFmt} />
                  <MetricRow label="Ann. Volatility" train={tm.ann_vol} test={sm.ann_vol} fmt={pctFmt} />
                  <MetricRow label="Max Drawdown" train={tm.max_drawdown} test={sm.max_drawdown} fmt={pctFmt} />
                  <MetricRow label="Win Rate" train={tm.win_rate} test={sm.win_rate} fmt={pctFmt} />
                  <MetricRow label="Avg Win/Loss" train={tm.avg_win_loss || 0} test={sm.avg_win_loss || 0} fmt={fmtN} />
                  <MetricRow label="Total Trades" train={tm.total_trades} test={sm.total_trades} fmt={n => n.toString()} />
                  <MetricRow label="t-stat" train={tm.t_stat} test={sm.t_stat} fmt={fmtN} />
                </tbody>
              </table>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-700/30 flex items-center justify-between">
                <span className="text-xs text-slate-500">Overfit Ratio (Test/Train Sharpe):</span>
                <span className={`text-sm font-mono ${data.overfit_check?.flagged ? 'text-red-400' : 'text-green-400'}`}>
                  {data.overfit_check?.ratio?.toFixed(3) ?? 'N/A'}
                </span>
              </div>
            </div>

            {/* Monotonicity Chart */}
            <div className="glass-strong rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Signal Monotonicity</h3>
              <p className="text-xs text-slate-400 mb-4">Average net return by signal strength quintile. Should increase monotonically.</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monoData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="bucket" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${v.toFixed(2)}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#94a3b8' }}
                      formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(3)}%`, 'Avg Return']}
                    />
                    <Bar dataKey="return" radius={[4, 4, 0, 0]}>
                      {monoData.map((entry, i) => (
                        <Cell key={i} fill={entry.return >= 0 ? '#22c55e' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Novel Contribution */}
            {data.novel_contribution && (
              <div className="glass-strong rounded-xl p-6 lg:col-span-2 border border-brand-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-3 py-1 bg-brand-500/10 text-brand-300 rounded-full text-sm font-mono font-bold">{data.novel_contribution.name}</span>
                  <h3 className="text-lg font-semibold text-white">{data.novel_contribution.full_name}</h3>
                </div>
                <p className="text-sm text-slate-300 mb-3">{data.novel_contribution.description}</p>
                <div className="bg-slate-900/50 rounded-lg p-3 font-mono text-sm text-accent-cyan">
                  {data.novel_contribution.formula}
                </div>
              </div>
            )}

            {/* Predictive Regression (for lead-lag) */}
            {data.predictive_regression && (
              <div className="glass-strong rounded-xl p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-white mb-4">Predictive Regression: ΔVIX(t+k) = α + β·ΔP(t) + ε</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/30">
                        <th className="py-2 px-3 text-left text-slate-500">Horizon</th>
                        <th className="py-2 px-3 text-right text-slate-500">β</th>
                        <th className="py-2 px-3 text-right text-slate-500">t-stat</th>
                        <th className="py-2 px-3 text-right text-slate-500">R²</th>
                        <th className="py-2 px-3 text-center text-slate-500">Significant?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.predictive_regression).map(([h, v]) => (
                        <tr key={h} className="border-b border-slate-700/10">
                          <td className="py-2 px-3 text-white font-mono">{h.replace('h', 't+')}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">{v.beta.toFixed(4)}</td>
                          <td className={`py-2 px-3 text-right font-mono ${Math.abs(v.tstat) >= 3 ? 'text-green-400 font-bold' : 'text-slate-300'}`}>{v.tstat.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">{(v.r2 * 100).toFixed(1)}%</td>
                          <td className="py-2 px-3 text-center">{Math.abs(v.tstat) >= 3 ? <span className="text-green-400">Yes</span> : <span className="text-slate-500">No</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Equity Curve Tab */}
        {activeTab === 'equity' && (
          <div className="glass-strong rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Equity Curve (Out-of-Sample)</h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.equity_curve}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} domain={['dataMin', 'dataMax']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(v: number | undefined) => [`$${(v ?? 0).toLocaleString()}`, 'Portfolio Value']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#eqGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-slate-800/30">
                <div className="text-xs text-slate-400">Start</div>
                <div className="text-sm font-mono text-white">${data.equity_curve[0]?.value.toLocaleString()}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-800/30">
                <div className="text-xs text-slate-400">End</div>
                <div className="text-sm font-mono text-white">${data.equity_curve[data.equity_curve.length - 1]?.value.toLocaleString()}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-800/30">
                <div className="text-xs text-slate-400">Test Sharpe</div>
                <div className="text-sm font-mono"><SharpeColor value={sm.sharpe} /></div>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-800/30">
                <div className="text-xs text-slate-400">Max Drawdown</div>
                <div className="text-sm font-mono text-red-400">{(sm.max_drawdown * 100).toFixed(2)}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Factor Regression Tab */}
        {activeTab === 'factors' && (
          <div className="glass-strong rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Factor Regression</h3>
            <p className="text-sm text-slate-400 mb-6">R_strategy(t) = α + β_mkt·R_SPY + β_vix·R_VIX + β_gld·R_GLD + ε</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="p-4 rounded-xl bg-slate-800/30 text-center">
                <div className="text-xs text-slate-400 mb-1">Alpha (daily)</div>
                <div className={`text-2xl font-bold font-mono ${data.factor_regression.alpha > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(data.factor_regression.alpha * 10000).toFixed(2)} bps
                </div>
                <div className={`text-sm mt-1 ${Math.abs(data.factor_regression.alpha_tstat) >= 3 ? 'text-green-400' : 'text-slate-400'}`}>
                  t = {data.factor_regression.alpha_tstat.toFixed(2)} {Math.abs(data.factor_regression.alpha_tstat) >= 3 ? '(Significant)' : '(Not significant)'}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/30 text-center">
                <div className="text-xs text-slate-400 mb-1">R²</div>
                <div className="text-2xl font-bold font-mono text-white">
                  {(data.factor_regression.r_squared * 100).toFixed(1)}%
                </div>
                <div className="text-sm mt-1 text-slate-400">
                  {data.factor_regression.r_squared < 0.15 ? 'Low factor exposure (good for alpha)' : 'Notable factor exposure'}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/30 text-center">
                <div className="text-xs text-slate-400 mb-1">Interpretation</div>
                <div className="text-sm text-slate-300 mt-2">
                  {Math.abs(data.factor_regression.alpha_tstat) >= 3
                    ? 'Strategy generates genuine alpha independent of traditional factors.'
                    : 'Alpha is not statistically significant after controlling for factors.'
                  }
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[28rem]">
                <thead>
                  <tr className="border-b border-slate-700/30">
                    <th className="py-2 px-3 text-left text-slate-500">Factor</th>
                    <th className="py-2 px-3 text-right text-slate-500">Beta</th>
                    <th className="py-2 px-3 text-right text-slate-500">t-stat</th>
                    <th className="py-2 px-3 text-center text-slate-500">Significant?</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.factor_regression.betas || {}).map(([factor, v]) => (
                    <tr key={factor} className="border-b border-slate-700/10">
                      <td className="py-2 px-3 text-white">{factor}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-300">{v.beta.toFixed(4)}</td>
                      <td className={`py-2 px-3 text-right font-mono ${Math.abs(v.tstat) >= 2 ? 'text-white font-bold' : 'text-slate-400'}`}>{v.tstat.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center">{Math.abs(v.tstat) >= 2 ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Robustness Tab */}
        {activeTab === 'robustness' && (
          <div className="glass-strong rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Robustness Checks</h3>
            <p className="text-sm text-slate-400 mb-6">Strategy tested under different cost assumptions, liquidity thresholds, and parameter values.</p>
            {Object.keys(data.robustness).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(data.robustness).map(([key, val]) => {
                  const sharpe = typeof val === 'object' && val !== null ? val.sharpe : (val as number);
                  const annReturn = typeof val === 'object' && val !== null ? val.ann_return : undefined;
                  return (
                    <div key={key} className="p-4 rounded-lg bg-slate-800/30">
                      <div className="text-xs text-slate-400 mb-2">{key.replace(/_/g, ' ')}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">Sharpe:</span>
                        <SharpeColor value={sharpe} />
                      </div>
                      {annReturn !== undefined && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm text-slate-300">Return:</span>
                          <span className={`font-mono text-sm ${annReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(annReturn * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-400">No robustness data available for this strategy.</p>
            )}

            {/* Risk metrics comparison */}
            <h4 className="text-md font-semibold text-white mt-8 mb-4">Risk Metrics</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(['var_95', 'cvar_95', 'tail_ratio', 'max_consecutive_losses'] as const).map(metric => (
                <div key={metric} className="p-3 rounded-lg bg-slate-800/30 text-center">
                  <div className="text-xs text-slate-400 mb-1">{metric.replace(/_/g, ' ').toUpperCase()}</div>
                  <div className="text-sm font-mono text-white">
                    {metric.includes('var') ? `${(data.risk_metrics.test[metric] * 100).toFixed(2)}%` : data.risk_metrics.test[metric]}
                  </div>
                  <div className="text-xs text-slate-500">Test</div>
                </div>
              ))}
            </div>

            {/* Walk-Forward Analysis */}
            {data.walk_forward && <WalkForwardPanel data={data.walk_forward} />}

            {/* Parameter Sensitivity Heatmap */}
            {data.sensitivity && <SensitivityHeatmap data={data.sensitivity} />}
          </div>
        )}

        {/* Rigor Tab — Monte Carlo, DSR, regime analysis */}
        {activeTab === 'rigor' && (
          <div className="space-y-6">
            {!data.rigor ? (
              <div className="glass-strong rounded-xl p-6">
                <p className="text-slate-400 text-sm">
                  Rigor metrics not available for this strategy. Re-run{' '}
                  <code className="text-brand-300">python -m backtest.generate_sample_results</code>{' '}
                  to include Monte Carlo CIs, Deflated Sharpe Ratio, and regime analysis.
                </p>
              </div>
            ) : (
              <>
                {/* Monte Carlo Bootstrap */}
                <div className="glass-strong rounded-xl p-6">
                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className="text-lg font-semibold text-white">Monte Carlo Bootstrap (95% CI)</h3>
                    <span className="text-xs text-slate-500 font-mono">
                      {data.rigor.monte_carlo.n_simulations} sims · {data.rigor.monte_carlo.method}
                      {data.rigor.monte_carlo.block_size ? ` · block=${data.rigor.monte_carlo.block_size}` : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-5">
                    Resampled performance distribution from the out-of-sample returns. CI widths indicate the precision of each point estimate.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {([
                      ['Sharpe', data.rigor.monte_carlo.sharpe, (v: number) => v.toFixed(2)],
                      ['Max Drawdown', data.rigor.monte_carlo.max_drawdown, (v: number) => `${(v * 100).toFixed(2)}%`],
                      ['Ann. Return', data.rigor.monte_carlo.ann_return, (v: number) => `${(v * 100).toFixed(2)}%`],
                    ] as const).map(([label, m, fmt]) => (
                      <div key={label} className="p-4 rounded-xl bg-slate-800/30">
                        <div className="text-xs text-slate-400 mb-1">{label}</div>
                        <div className="text-2xl font-bold font-mono text-white">{fmt(m.point_estimate)}</div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-slate-500">95% CI</span>
                          <span className="font-mono text-slate-300">
                            [{fmt(m.ci_lower)}, {fmt(m.ci_upper)}]
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="text-slate-500">Std Error</span>
                          <span className="font-mono text-slate-400">{fmt(m.std_error)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deflated Sharpe Ratio */}
                <div className="glass-strong rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-1">Deflated Sharpe Ratio</h3>
                  <p className="text-xs text-slate-400 mb-5">
                    Bailey &amp; López de Prado (2014). PSR corrects for non-normal returns; DSR additionally deflates for
                    multiple testing across the {data.rigor.deflated_sharpe.n_trials} evaluated strategies.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-800/30 text-center">
                      <div className="text-xs text-slate-400 mb-1">PSR (vs SR = 0)</div>
                      <div className={`text-3xl font-bold font-mono ${
                        (data.rigor.deflated_sharpe.psr ?? 0) >= 0.95 ? 'text-green-400' :
                        (data.rigor.deflated_sharpe.psr ?? 0) >= 0.80 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {data.rigor.deflated_sharpe.psr !== null ? (data.rigor.deflated_sharpe.psr * 100).toFixed(1) + '%' : 'N/A'}
                      </div>
                      <div className="text-xs text-slate-500 mt-2">Prob. true Sharpe &gt; 0</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/30 text-center">
                      <div className="text-xs text-slate-400 mb-1">DSR (multi-test deflated)</div>
                      <div className={`text-3xl font-bold font-mono ${
                        (data.rigor.deflated_sharpe.dsr ?? 0) >= 0.95 ? 'text-green-400' :
                        (data.rigor.deflated_sharpe.dsr ?? 0) >= 0.80 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {data.rigor.deflated_sharpe.dsr !== null ? (data.rigor.deflated_sharpe.dsr * 100).toFixed(1) + '%' : 'N/A'}
                      </div>
                      <div className="text-xs text-slate-500 mt-2">
                        Prob. beats max-of-{data.rigor.deflated_sharpe.n_trials} null Sharpe
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-slate-500">
                    Trial-Sharpe variance across all {data.rigor.deflated_sharpe.n_trials} strategies:{' '}
                    <span className="font-mono text-slate-400">
                      {data.rigor.deflated_sharpe.trial_sharpe_variance.toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* Regime Analysis */}
                <div className="glass-strong rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-1">Performance by Volatility Regime</h3>
                  <p className="text-xs text-slate-400 mb-5">
                    Rolling-vol quantile regimes. Reveals whether strategy performance is regime-dependent or robust across conditions.
                  </p>
                  {data.rigor.regime_analysis.table.length === 0 ? (
                    <p className="text-sm text-slate-400">Insufficient data for regime analysis.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/30">
                          <th className="py-2 px-3 text-left text-slate-500 text-xs">Regime</th>
                          <th className="py-2 px-3 text-right text-slate-500 text-xs">Days</th>
                          <th className="py-2 px-3 text-right text-slate-500 text-xs">Sharpe</th>
                          <th className="py-2 px-3 text-right text-slate-500 text-xs">Ann. Return</th>
                          <th className="py-2 px-3 text-right text-slate-500 text-xs">Ann. Vol</th>
                          <th className="py-2 px-3 text-right text-slate-500 text-xs">Max DD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.rigor.regime_analysis.table.map(row => (
                          <tr key={row.label} className="border-b border-slate-700/10">
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                                row.regime === 'low_vol' ? 'bg-green-500/10 text-green-300' :
                                row.regime === 'high_vol' ? 'bg-red-500/10 text-red-300' :
                                'bg-slate-500/10 text-slate-300'
                              }`}>
                                {row.regime}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-300">{row.n_days}</td>
                            <td className="py-2 px-3 text-right"><SharpeColor value={row.sharpe} /></td>
                            <td className={`py-2 px-3 text-right font-mono ${row.ann_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {(row.ann_return * 100).toFixed(2)}%
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-300">{(row.ann_vol * 100).toFixed(2)}%</td>
                            <td className="py-2 px-3 text-right font-mono text-red-400">{(row.max_drawdown * 100).toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Regime-conditional position sizing */}
                {data.regime_sizing && <RegimeSizingPanel data={data.regime_sizing} />}
              </>
            )}
          </div>
        )}

        {/* Event Study Tab */}
        {activeTab === 'events' && (
          <div className="glass-strong rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Event Study</h3>
            <p className="text-sm text-slate-400 mb-6">Cumulative abnormal return around strategy entry events. Day 0 = event trigger.</p>
            {data.event_study && data.event_study.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.event_study}>
                    <defs>
                      <linearGradient id="carGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} label={{ value: 'Days from Event', position: 'insideBottom', offset: -5, fill: '#64748b' }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `${(v * 100).toFixed(1)}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(v: number | undefined) => [`${((v ?? 0) * 100).toFixed(3)}%`, 'CAR']}
                    />
                    <Area type="monotone" dataKey="car" stroke="#22d3ee" fill="url(#carGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-slate-400">No event study data available for this strategy.</p>
            )}

            {/* Hedge effectiveness for S3 */}
            {data.hedge_effectiveness && (
              <div className="mt-8 p-4 rounded-xl bg-slate-800/30">
                <h4 className="text-md font-semibold text-white mb-3">Hedge Effectiveness</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-slate-400">Beta vs SPY</div>
                    <div className={`text-lg font-bold font-mono ${data.hedge_effectiveness.beta_vs_spy < 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {data.hedge_effectiveness.beta_vs_spy.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400">Correlation</div>
                    <div className="text-lg font-bold font-mono text-slate-300">{data.hedge_effectiveness.correlation_vs_spy.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400">Genuine Hedge?</div>
                    <div className={`text-lg font-bold ${data.hedge_effectiveness.is_genuine_hedge ? 'text-green-400' : 'text-red-400'}`}>
                      {data.hedge_effectiveness.is_genuine_hedge ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic vs Static for S4 */}
            {data.dynamic_vs_static && (
              <div className="mt-8 p-4 rounded-xl bg-slate-800/30">
                <h4 className="text-md font-semibold text-white mb-3">Dynamic vs Static Hedge</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-slate-400">Dynamic Sharpe</div>
                    <div className="text-lg font-bold font-mono text-brand-300">{data.dynamic_vs_static.dynamic_sharpe.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400">Static Sharpe</div>
                    <div className="text-lg font-bold font-mono text-slate-400">{data.dynamic_vs_static.static_sharpe.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400">Carry Cost Saved</div>
                    <div className="text-lg font-bold font-mono text-green-400">{(data.dynamic_vs_static.carry_cost_saved_pct * 100).toFixed(1)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400">DD Improvement</div>
                    <div className="text-lg font-bold font-mono text-green-400">{(data.dynamic_vs_static.drawdown_improvement * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BacktestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-slate-400">Loading...</div></div>}>
      <BacktestPageInner />
    </Suspense>
  );
}
