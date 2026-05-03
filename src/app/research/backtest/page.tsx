'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, ScatterChart, Scatter, Cell
} from 'recharts';

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
  robustness: Record<string, any>;
  trade_log: { entry: string; exit: string; pnl: number }[];
  novel_contribution?: { name: string; full_name: string; description: string; formula: string };
  predictive_regression?: Record<string, { beta: number; tstat: number; r2: number }>;
  honest_finding?: string;
  caveat?: string;
  hedge_effectiveness?: Record<string, any>;
  dynamic_vs_static?: Record<string, any>;
}

type ActiveTab = 'overview' | 'equity' | 'factors' | 'robustness' | 'events';

interface ExplainerSection {
  label: string;
  text: string;
}

interface StrategyMethodology {
  thesis: string;
  signal: string;
  controls: string;
  interpretation: string;
  caveat: string;
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

const STRATEGY_METHODOLOGY: Record<string, StrategyMethodology> = {
  cross_platform_arb: {
    thesis: 'Tests whether the same event is priced differently on Polymarket and Kalshi after confirming that both contracts resolve on the same underlying outcome.',
    signal: 'Resolution-Aware Arbitrage Signal: gross price gap is multiplied by resolution alignment and discounted by dispute risk. A trade is only eligible when net profit clears 1%, alignment is at least 0.65, and trust score is at least 60.',
    controls: 'Uses explicit Polymarket and Kalshi spread assumptions, position caps, shifted returns to prevent look-ahead, train/test separation, and signal monotonicity checks.',
    interpretation: 'A strong result means the apparent spread survives fees and is larger for higher-quality alignment signals, not merely that two market titles look similar.',
    caveat: 'Execution still depends on order-book depth, legal access to both venues, and cross-venue settlement timing.',
  },
  lead_lag_vol: {
    thesis: 'Tests whether prediction-market probability shocks lead volatility-sensitive assets such as VIX before traditional markets fully absorb the event information.',
    signal: 'Uses changes in event probability, especially moves above the configured 8 percentage point threshold, then tests forward horizons from t+1 to t+5.',
    controls: 'Predictive regressions use Newey-West standard errors for overlapping forward returns; performance is checked out-of-sample and after transaction costs.',
    interpretation: 'The key evidence is not only Sharpe. The important question is whether beta and t-statistics peak at plausible lead-lag horizons.',
    caveat: 'Lead-lag effects can decay quickly once discovered, and small test trade counts should be treated as research evidence rather than production proof.',
  },
  insurance_overlay: {
    thesis: 'Tests whether high-trust binary prediction-market contracts can act as fixed-cost event insurance for equity portfolios.',
    signal: 'Filters for high resolution confidence, sufficient liquidity, and event categories that plausibly hedge portfolio downside rather than create standalone alpha.',
    controls: 'Evaluates beta versus SPY, correlation, carry cost, drawdown behavior, and out-of-sample performance under conservative sizing.',
    interpretation: 'Success means the contract behaves like a hedge when the event risk matters; it does not need to maximize standalone return.',
    caveat: 'Binary contracts hedge event occurrence, not severity. A $1 binary payout does not scale with how extreme the realized event becomes.',
  },
  dynamic_hedge: {
    thesis: 'Tests whether hedge exposure should scale with live prediction-market probabilities instead of staying static through time.',
    signal: 'Starts from a base hedge ratio and increases or decreases exposure as the market-implied event probability crosses configured high and low thresholds.',
    controls: 'Compares dynamic versus static hedge performance, carry-cost savings, drawdown improvement, and risk metrics after rebalancing costs.',
    interpretation: 'A good result means the overlay reduces unnecessary hedge carry while preserving downside protection when event risk rises.',
    caveat: 'The method can fail if prediction markets update after traditional markets or if rebalancing costs consume the timing benefit.',
  },
  mean_reversion: {
    thesis: 'Tests whether simple single-platform mispricings such as YES plus NO above fair value revert enough to earn profit after costs.',
    signal: 'Flags overpriced binary bundles when the combined implied price exceeds the configured threshold, then exits on convergence or timeout.',
    controls: 'Includes full spread assumptions and is intentionally kept as a negative-control strategy to prove the framework can reject weak ideas.',
    interpretation: 'A weak or negative result is valuable: it shows that apparent micro-mispricings are often not tradable once costs are charged.',
    caveat: 'This should not be presented as a failed project result; it is an honest null result that strengthens the methodology.',
  },
  market_making: {
    thesis: 'Tests whether a binary-market liquidity provider can earn spread while controlling inventory risk using an Avellaneda-Stoikov style model.',
    signal: 'Quotes are adjusted around a reservation price based on inventory and observed top-of-book conditions, then simulated as spread capture.',
    controls: 'Tracks P&L, drawdown, trade count, tail risk, and simulated robustness, but marks the strategy explicitly as non-executable evidence.',
    interpretation: 'A positive result suggests the market-making framework is worth studying, not that the exact simulated P&L can be captured live.',
    caveat: 'Without tick-level order book history and queue-position data, fills and adverse selection are approximations.',
  },
};

const TAB_EXPLAINERS: Record<ActiveTab, { title: string; summary: string; sections: ExplainerSection[] }> = {
  overview: {
    title: 'Overview Methodology',
    summary: 'This section answers the first backtesting question: did the signal produce positive risk-adjusted results out-of-sample, and did stronger signals perform better than weaker signals?',
    sections: [
      { label: 'Performance table', text: 'Compares training results with unseen out-of-sample results. Sharpe, Sortino, Calmar, drawdown, win rate, and t-stat are read together rather than as one headline number.' },
      { label: 'Monotonicity bar chart', text: 'Signals are sorted into quintiles from weakest to strongest. A credible signal should generally show higher average net returns in stronger buckets.' },
      { label: 'Overfit check', text: 'The test/train Sharpe ratio flags strategies whose out-of-sample behavior collapses relative to the training period.' },
    ],
  },
  equity: {
    title: 'Equity Curve Methodology',
    summary: 'This section shows how the strategy account value would have evolved during the out-of-sample test window after costs and position limits.',
    sections: [
      { label: 'What the line means', text: 'The curve compounds daily strategy returns from an initial capital base. It reflects the shifted position rule, so today\'s P&L comes from yesterday\'s signal.' },
      { label: 'What to inspect', text: 'A smooth upward line is better than one driven by one jump. Drawdown depth and recovery time matter as much as ending value.' },
      { label: 'Risk reading', text: 'A strategy can end positive but still be weak if it suffers large drawdowns or relies on a very small number of trades.' },
    ],
  },
  factors: {
    title: 'Factor Regression Methodology',
    summary: 'This section tests whether the strategy is genuinely producing alpha or merely taking hidden exposure to common market factors.',
    sections: [
      { label: 'Regression model', text: 'Strategy returns are regressed on SPY, VIX, GLD, or similar factors. Alpha is the leftover return after those factor exposures are controlled.' },
      { label: 'Alpha t-stat', text: 'A higher absolute t-stat means the estimated alpha is larger relative to statistical noise. The page uses a conservative threshold around 3.0 for finance research.' },
      { label: 'R-squared', text: 'Low R-squared can be good here: it means standard factors explain only a small share of the strategy returns.' },
    ],
  },
  robustness: {
    title: 'Robustness Methodology',
    summary: 'This section asks whether the result survives reasonable changes in assumptions rather than depending on one fragile parameter setting.',
    sections: [
      { label: 'Stress tests', text: 'Costs, liquidity thresholds, trust thresholds, or sizing parameters are varied to check whether the strategy remains stable.' },
      { label: 'Risk metrics', text: 'VaR, CVaR, tail ratio, and loss streaks describe downside behavior beyond average return and Sharpe.' },
      { label: 'Decision rule', text: 'If a strategy works only under one optimistic assumption, it should be treated as fragile even if the headline backtest looks attractive.' },
    ],
  },
  events: {
    title: 'Event Study Methodology',
    summary: 'This section checks what happens around the event trigger itself, where day 0 is the signal or entry event.',
    sections: [
      { label: 'CAR chart', text: 'Cumulative abnormal return measures performance from before to after the event trigger. A useful signal should show return behavior concentrated after the trigger, not before it.' },
      { label: 'Hedge diagnostics', text: 'For hedge strategies, beta, correlation, carry cost, and drawdown improvement matter more than raw return.' },
      { label: 'Interpretation limit', text: 'If there are few events, the chart is useful for intuition but should not be treated as definitive statistical proof.' },
    ],
  },
};

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

function MethodologyPanel({
  title,
  summary,
  sections,
  accent = 'brand',
}: {
  title: string;
  summary: string;
  sections: ExplainerSection[];
  accent?: 'brand' | 'cyan';
}) {
  const accentClass = accent === 'cyan' ? 'text-accent-cyan' : 'text-brand-300';

  return (
    <section className="mb-6 rounded-xl border border-slate-700/50 bg-slate-900/70 p-5 shadow-xl shadow-black/10">
      <div className="mb-4">
        <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${accentClass}`}>Methodology</p>
        <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-300">{summary}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <div key={section.label} className="border-l border-brand-500/30 pl-4">
            <h3 className="text-sm font-semibold text-slate-100">{section.label}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">{section.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StrategyMethodologyPanel({
  strategyName,
  methodology,
  contribution,
}: {
  strategyName: string;
  methodology: StrategyMethodology;
  contribution?: StrategyResult['novel_contribution'];
}) {
  const sections: ExplainerSection[] = [
    { label: 'Signal construction', text: methodology.signal },
    { label: 'Backtest controls', text: methodology.controls },
    { label: 'How to read it', text: methodology.interpretation },
  ];

  return (
    <div className="space-y-4">
      <MethodologyPanel
        title={`${strategyName}: Backtest Setup`}
        summary={methodology.thesis}
        sections={sections}
      />
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-5 py-4 text-sm leading-6 text-yellow-100">
        <span className="font-semibold text-yellow-300">Important limitation:</span> {methodology.caveat}
      </div>
      {contribution && (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/10 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-brand-500/15 px-3 py-1 font-mono text-sm font-bold text-brand-200">{contribution.name}</span>
            <h3 className="text-base font-semibold text-white">{contribution.full_name}</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{contribution.description}</p>
          <div className="mt-3 rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-xs text-accent-cyan">
            {contribution.formula}
          </div>
        </div>
      )}
    </div>
  );
}

function BacktestPageInner() {
  const searchParams = useSearchParams();
  const initialStrategy = searchParams.get('strategy') || 'cross_platform_arb';

  const [selected, setSelected] = useState(initialStrategy);
  const [data, setData] = useState<StrategyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  useEffect(() => {
    setLoading(true);
    fetch(`/backtest-results/${selected}.json`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading backtest results...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Failed to load results for {selected}</div>
      </div>
    );
  }

  const tm = data.train_metrics;
  const sm = data.test_metrics;
  const pctFmt = (n: number) => `${(n * 100).toFixed(2)}%`;
  const fmtN = (n: number) => n.toFixed(4);
  const strategyName = STRATEGY_NAMES[selected] || selected;
  const strategyMethodology = STRATEGY_METHODOLOGY[selected] || {
    thesis: 'Tests this strategy using the shared PM Arbitrage backtesting framework.',
    signal: 'Signals are generated from historical market data and then converted into capped positions.',
    controls: 'The engine applies transaction costs, train/test separation, shifted positions, and risk controls.',
    interpretation: 'Read performance, risk, and robustness together rather than relying on one metric.',
    caveat: 'This strategy does not have a custom methodology description yet.',
  };
  const tabExplainer = TAB_EXPLAINERS[activeTab];

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

        <StrategyMethodologyPanel
          strategyName={strategyName}
          methodology={strategyMethodology}
          contribution={data.novel_contribution}
        />

        {/* Tab nav */}
        <div className="mt-8 flex gap-1 mb-6 border-b border-slate-800/50">
          {(['overview', 'equity', 'factors', 'robustness', 'events'] as ActiveTab[]).map(tab => (
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

        <MethodologyPanel
          title={tabExplainer.title}
          summary={tabExplainer.summary}
          sections={tabExplainer.sections}
          accent="cyan"
        />

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Table */}
            <div className="glass-strong rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
              <table className="w-full">
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

            <table className="w-full text-sm">
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
        )}

        {/* Robustness Tab */}
        {activeTab === 'robustness' && (
          <div className="glass-strong rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Robustness Checks</h3>
            <p className="text-sm text-slate-400 mb-6">Strategy tested under different cost assumptions, liquidity thresholds, and parameter values.</p>
            {Object.keys(data.robustness).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(data.robustness).map(([key, val]: [string, any]) => (
                  <div key={key} className="p-4 rounded-lg bg-slate-800/30">
                    <div className="text-xs text-slate-400 mb-2">{key.replace(/_/g, ' ')}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Sharpe:</span>
                      <SharpeColor value={typeof val === 'object' ? val.sharpe : val} />
                    </div>
                    {typeof val === 'object' && val.ann_return !== undefined && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-slate-300">Return:</span>
                        <span className={`font-mono text-sm ${val.ann_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(val.ann_return * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
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
