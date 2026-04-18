'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type MethodName = 'equal_weight' | 'risk_parity' | 'mean_variance';

interface MethodMetrics {
  weights: Record<string, number>;
  sharpe: number;
  ann_return: number;
  ann_vol: number;
  max_drawdown: number;
}

interface ConstructionComparison {
  strategy_names: string[];
  methods: Record<MethodName, MethodMetrics>;
  correlation_matrix: Record<string, Record<string, number>>;
  avg_pairwise_correlation: number;
}

interface PortfolioSummary {
  portfolio_metrics: Record<string, number>;
  strategy_summaries: Record<string, { sharpe: number; ann_return: number; max_drawdown: number; weight?: number; note?: string }>;
  correlation_matrix: Record<string, Record<string, number>>;
  diversification_benefit: { avg_pairwise_correlation: number; portfolio_vol_reduction_vs_avg?: number; note?: string };
  construction_comparison?: ConstructionComparison;
}

const STRATEGY_LABELS: Record<string, string> = {
  cross_platform_arb: 'Cross-Platform Arb',
  lead_lag_vol: 'Lead-Lag Vol',
  insurance_overlay: 'Insurance Overlay',
  dynamic_hedge: 'Dynamic Hedge',
  mean_reversion: 'Mean Reversion',
  market_making: 'Market Making',
};

const METHOD_META: Record<MethodName, { label: string; tag: string; academic: string; tooltip: string }> = {
  equal_weight: {
    label: 'Equal Weight',
    tag: '1/N',
    academic: 'DeMiguel, Garlappi & Uppal (2009)',
    tooltip: 'Allocate 1/N to each strategy. No estimation error but ignores covariance structure.',
  },
  risk_parity: {
    label: 'Risk Parity (ERC)',
    tag: 'ERC',
    academic: 'Maillard, Roncalli & Teïletche (2010)',
    tooltip: 'Equalize each strategy\'s contribution to portfolio variance. Diversifies risk, not capital.',
  },
  mean_variance: {
    label: 'Mean-Variance',
    tag: 'Tangency',
    academic: 'Markowitz (1952)',
    tooltip: 'Maximize Sharpe subject to long-only constraint. Sensitive to estimated means.',
  },
};

function pctColor(v: number): string {
  return v >= 0 ? 'text-green-400' : 'text-red-400';
}

function sharpeColor(v: number): string {
  if (v >= 2) return 'text-green-400';
  if (v >= 1) return 'text-brand-300';
  if (v >= 0.5) return 'text-yellow-400';
  if (v >= 0) return 'text-orange-400';
  return 'text-red-400';
}

function corrCellColor(r: number): string {
  // Diverging colormap: blue (neg) → slate (0) → red (pos).
  const clamped = Math.max(-1, Math.min(1, r));
  if (clamped < 0) {
    const t = Math.abs(clamped);
    const g = Math.round(116 + (160 - 116) * (1 - t));
    const b = Math.round(139 + (255 - 139) * t);
    return `rgb(${Math.round(59 + (100 - 59) * (1 - t))}, ${g}, ${b})`;
  }
  const t = clamped;
  const r2 = Math.round(100 + (220 - 100) * t);
  const g = Math.round(116 - 80 * t);
  const b = Math.round(139 - 100 * t);
  return `rgb(${r2}, ${g}, ${b})`;
}

function MetricCard({ label, value, color = 'text-white', sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="p-4 rounded-xl bg-slate-800/30">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function WeightBar({ name, weight, maxWeight }: { name: string; weight: number; maxWeight: number }) {
  const pct = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-300">{STRATEGY_LABELS[name] || name}</span>
        <span className="font-mono text-slate-400">{(weight * 100).toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800/50 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-accent-cyan transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CorrelationHeatmap({ matrix }: { matrix: Record<string, Record<string, number>> }) {
  const names = Object.keys(matrix);
  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        <div className="flex">
          <div className="w-36" /> {/* top-left spacer */}
          {names.map(n => (
            <div key={n} className="w-16 text-[10px] text-slate-400 text-center pb-2 font-medium" title={n}>
              {STRATEGY_LABELS[n]?.split(' ').map(w => w[0]).join('') || n.slice(0, 4)}
            </div>
          ))}
        </div>
        {names.map(rowName => (
          <div key={rowName} className="flex items-center">
            <div className="w-36 pr-2 text-right text-xs text-slate-300 font-medium truncate">
              {STRATEGY_LABELS[rowName] || rowName}
            </div>
            {names.map(colName => {
              const v = matrix[rowName]?.[colName] ?? 0;
              const isDiag = rowName === colName;
              return (
                <div
                  key={colName}
                  className={`w-16 h-12 flex items-center justify-center text-xs font-mono font-semibold ${
                    isDiag ? 'ring-1 ring-white/20' : ''
                  }`}
                  style={{
                    backgroundColor: corrCellColor(v),
                    color: Math.abs(v) > 0.5 ? '#0f172a' : '#f8fafc',
                  }}
                  title={`${rowName} ↔ ${colName}: ${v.toFixed(3)}`}
                >
                  {v.toFixed(2)}
                </div>
              );
            })}
          </div>
        ))}
        <div className="mt-4 flex items-center justify-center gap-3 text-[10px] text-slate-400">
          <span className="font-mono">-1.0</span>
          <div
            className="h-2 w-48 rounded"
            style={{
              background: 'linear-gradient(to right, rgb(59,116,255), rgb(100,116,139), rgb(220,36,39))',
            }}
          />
          <span className="font-mono">+1.0</span>
          <span className="text-slate-500 ml-2">Pearson correlation</span>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMethod, setActiveMethod] = useState<MethodName>('risk_parity');

  useEffect(() => {
    fetch('/backtest-results/portfolio_summary.json')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const comparison = data?.construction_comparison;
  const bestSharpeMethod = useMemo<MethodName | null>(() => {
    if (!comparison) return null;
    let best: MethodName = 'equal_weight';
    let bestVal = -Infinity;
    (Object.entries(comparison.methods) as [MethodName, MethodMetrics][]).forEach(([k, v]) => {
      if (v.sharpe > bestVal) { bestVal = v.sharpe; best = k; }
    });
    return best;
  }, [comparison]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-2 border-slate-700 border-t-brand-400 animate-spin" />
          <div className="text-sm text-slate-400 font-mono tracking-wide">loading portfolio analysis…</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-strong rounded-xl p-8 max-w-md text-center">
          <div className="text-4xl mb-3">⚠</div>
          <div className="text-red-400 font-semibold mb-2">Failed to load portfolio summary</div>
          <div className="text-sm text-slate-400 mb-4">
            Expected <span className="font-mono text-slate-300">/backtest-results/portfolio_summary.json</span>.
          </div>
          <Link
            href="/research"
            className="inline-block px-4 py-2 text-sm rounded-lg bg-brand-500/10 text-brand-300 border border-brand-500/30 hover:bg-brand-500/20 transition-colors"
          >
            Back to Research
          </Link>
        </div>
      </div>
    );
  }

  const active = comparison?.methods[activeMethod];
  const maxWeight = active ? Math.max(...Object.values(active.weights)) : 1;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="border-b border-slate-800/50 bg-gradient-to-r from-brand-500/5 via-transparent to-accent-cyan/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
            <Link href="/research" className="hover:text-brand-300 transition-colors">Research</Link>
            <span>/</span>
            <span className="text-white">Portfolio Construction</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Portfolio Construction Comparison</h1>
          <p className="text-slate-400 max-w-3xl">
            Three ways to combine the six validated strategies: equal weight (1/N), risk parity (equal risk contribution),
            and mean-variance (tangency, long-only). Side-by-side metrics and the correlation matrix that drives the diversification.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {!comparison ? (
          <div className="glass-strong rounded-xl p-6">
            <p className="text-slate-400 text-sm">
              Construction comparison data not available. Re-run{' '}
              <code className="text-brand-300">python -m backtest.generate_sample_results</code>.
            </p>
          </div>
        ) : (
          <>
            {/* Head-to-head summary */}
            <div className="glass-strong rounded-xl p-6">
              <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-white">Head-to-Head</h2>
                <span className="text-xs text-slate-500 font-mono">
                  N={comparison.strategy_names.length} strategies · ρ̄ = {comparison.avg_pairwise_correlation.toFixed(3)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/30">
                      <th className="text-left py-2 px-3 text-slate-500 text-xs font-medium">Method</th>
                      <th className="text-right py-2 px-3 text-slate-500 text-xs font-medium">Sharpe</th>
                      <th className="text-right py-2 px-3 text-slate-500 text-xs font-medium">Ann. Return</th>
                      <th className="text-right py-2 px-3 text-slate-500 text-xs font-medium">Ann. Vol</th>
                      <th className="text-right py-2 px-3 text-slate-500 text-xs font-medium">Max DD</th>
                      <th className="text-right py-2 px-3 text-slate-500 text-xs font-medium">Return / Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.entries(comparison.methods) as [MethodName, MethodMetrics][]).map(([key, m]) => {
                      const isBest = key === bestSharpeMethod;
                      const meta = METHOD_META[key];
                      return (
                        <tr key={key} className={`border-b border-slate-700/10 ${isBest ? 'bg-brand-500/5' : ''}`}>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-700/40 text-slate-300">{meta.tag}</span>
                              <span className="text-white font-medium">{meta.label}</span>
                              {isBest && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/25">Best Sharpe</span>}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{meta.academic}</div>
                          </td>
                          <td className={`py-3 px-3 text-right font-mono font-bold ${sharpeColor(m.sharpe)}`}>{m.sharpe.toFixed(2)}</td>
                          <td className={`py-3 px-3 text-right font-mono ${pctColor(m.ann_return)}`}>{(m.ann_return * 100).toFixed(2)}%</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">{(m.ann_vol * 100).toFixed(2)}%</td>
                          <td className="py-3 px-3 text-right font-mono text-red-400">{(m.max_drawdown * 100).toFixed(2)}%</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">
                            {m.ann_vol > 0 ? (m.ann_return / m.ann_vol).toFixed(2) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Method detail + weights */}
            <div className="glass-strong rounded-xl p-6">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{METHOD_META[activeMethod].label}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{METHOD_META[activeMethod].tooltip}</p>
                </div>
                <div className="flex gap-1">
                  {(Object.keys(METHOD_META) as MethodName[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setActiveMethod(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activeMethod === m
                          ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
                          : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {METHOD_META[m].label}
                    </button>
                  ))}
                </div>
              </div>

              {active && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCard label="Sharpe" value={active.sharpe.toFixed(2)} color={sharpeColor(active.sharpe)} />
                    <MetricCard label="Ann. Return" value={`${(active.ann_return * 100).toFixed(2)}%`} color={pctColor(active.ann_return)} />
                    <MetricCard label="Ann. Vol" value={`${(active.ann_vol * 100).toFixed(2)}%`} />
                    <MetricCard label="Max Drawdown" value={`${(active.max_drawdown * 100).toFixed(2)}%`} color="text-red-400" />
                  </div>

                  <h4 className="text-md font-semibold text-white mb-3">Allocation</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    {Object.entries(active.weights).map(([name, w]) => (
                      <WeightBar key={name} name={name} weight={w} maxWeight={maxWeight} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Correlation Matrix */}
            <div className="glass-strong rounded-xl p-6">
              <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-white">Correlation Matrix</h3>
                <span className="text-xs text-slate-500 font-mono">
                  Average off-diagonal: {comparison.avg_pairwise_correlation.toFixed(3)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-5">
                Pairwise Pearson correlation of daily OOS returns. Low average correlation is what lets
                the diversification math work — portfolio vol is lower than a capital-weighted average of individual vols.
              </p>
              <CorrelationHeatmap matrix={comparison.correlation_matrix} />
              {data.diversification_benefit?.note && (
                <p className="text-xs text-slate-500 mt-4 italic">{data.diversification_benefit.note}</p>
              )}
            </div>

            {/* Interpretation */}
            <div className="glass-strong rounded-xl p-6 border border-brand-500/20">
              <h3 className="text-lg font-semibold text-white mb-3">How to Read This</h3>
              <ul className="text-sm text-slate-300 space-y-2.5">
                <li className="flex items-start gap-2">
                  <span className="text-brand-400 mt-0.5 font-bold">1.</span>
                  <span>
                    <strong className="text-white">Equal-weight (1/N)</strong> is the classic no-estimation-error baseline
                    (DeMiguel et al. 2009 showed it&apos;s hard to beat out-of-sample). Any other method must earn its
                    estimation-risk cost.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-400 mt-0.5 font-bold">2.</span>
                  <span>
                    <strong className="text-white">Risk parity</strong> equalises each strategy&apos;s contribution to
                    portfolio variance (Maillard et al. 2010). It doesn&apos;t need return forecasts — which is why it
                    often produces the most stable OOS Sharpe.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-400 mt-0.5 font-bold">3.</span>
                  <span>
                    <strong className="text-white">Mean-variance tangency</strong> (long-only Markowitz) maximises
                    Sharpe given the sample mean and covariance. Highest in-sample Sharpe by construction — but most
                    exposed to estimation error in μ.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-400 mt-0.5 font-bold">4.</span>
                  <span>
                    <strong className="text-white">Correlation matters.</strong> With an average pairwise correlation
                    of <span className="font-mono text-accent-cyan">{comparison.avg_pairwise_correlation.toFixed(3)}</span>,
                    the strategies are close to orthogonal — the key condition for diversification to reduce risk meaningfully.
                  </span>
                </li>
              </ul>
            </div>
          </>
        )}

        <div className="text-center pt-4">
          <Link href="/research/backtest" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 text-slate-300 font-medium rounded-lg hover:bg-slate-800 transition-colors">
            ← Back to Strategy Detail
          </Link>
        </div>
      </div>
    </div>
  );
}
