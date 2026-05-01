'use client';

import type { BacktestResult } from '../types';

interface Props { result: BacktestResult }

function StatCard({
  label, value, sub, accent, testId
}: { label: string; value: string; sub?: string; accent?: string; testId?: string }) {
  return (
    <div className="rounded-xl border border-[#1e2a45] bg-[#0d1220] p-5">
      <p className="text-xs text-[#64748b] font-medium mb-2">{label}</p>
      <p
        data-testid={testId}
        className="text-3xl font-bold"
        style={{ color: accent ?? '#f1f5f9' }}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-[#475569] mt-1">{sub}</p>}
    </div>
  );
}

export default function BacktestResultsHeader({ result }: Props) {
  const isStrong = result.isSignificant && result.liftRatio >= 2.0;
  const isWeak   = result.isSignificant && result.liftRatio < 2.0;

  return (
    <div className="space-y-4">
      {/* Significance banner */}
      <div className={`rounded-xl border p-4 flex items-center gap-4 ${
        isStrong ? 'border-[#166534] bg-[#022c1a]' :
        isWeak   ? 'border-[#92400e] bg-[#1c0f00]' :
                   'border-[#450a0a] bg-[#0d0000]'
      }`}>
        <span className="text-2xl">
          {isStrong ? '✅' : isWeak ? '➡️' : '❌'}
        </span>
        <div>
          <p className="font-bold text-white">
            {isStrong
              ? 'H₁ Supported — Trust Score is a statistically significant dispute predictor (lift ≥ 2×)'
              : isWeak
              ? 'Directional effect confirmed — significant but lift < 2× (refine methodology)'
              : 'H₀ not rejected — no significant relationship detected at α = 0.05'}
          </p>
          <p className="text-sm text-[#64748b] mt-0.5">
            {result.totalMarkets.toLocaleString()} markets analysed ·{' '}
            {(result.overallDisputeRate * 100).toFixed(2)}% overall dispute rate ·{' '}
            χ² = {result.chi2Statistic.toFixed(3)} · df = 1
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label={`Low Trust (< ${result.threshold})`}
          value={`${(result.disputeRateLow * 100).toFixed(1)}%`}
          sub={`${result.nLowTrust.toLocaleString()} markets`}
          accent="#f87171"
          testId="dispute-rate-low"
        />
        <StatCard
          label={`High Trust (≥ ${result.threshold})`}
          value={`${(result.disputeRateHigh * 100).toFixed(1)}%`}
          sub={`${result.nHighTrust.toLocaleString()} markets`}
          accent="#34d399"
          testId="dispute-rate-high"
        />
        <StatCard
          label="Lift Ratio"
          value={`${result.liftRatio.toFixed(2)}×`}
          sub="Low ÷ High dispute rate"
          accent={result.liftRatio >= 2 ? '#34d399' : '#fbbf24'}
          testId="lift-ratio"
        />
        <StatCard
          label="p-value"
          value={result.pValue < 0.001 ? '<0.001' : result.pValue.toFixed(4)}
          sub={result.isSignificant ? 'Significant (α=0.05)' : 'Not significant'}
          accent={result.isSignificant ? '#34d399' : '#f87171'}
          testId="p-value-badge"
        />
        {result.aucRoc !== undefined && (
          <StatCard
            label="AUC-ROC"
            value={result.aucRoc.toFixed(3)}
            sub="Logistic regression"
            accent="#a78bfa"
          />
        )}
        <StatCard
          label="Markets Analysed"
          value={result.totalMarkets.toLocaleString()}
          sub={`${result.dateFrom} → ${result.dateTo}`}
        />
      </div>
    </div>
  );
}
