'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import type { BacktestResult } from '../types';

interface Props { result: BacktestResult }

/**
 * Simulates a "filter by trust score" equity curve.
 * Shows cumulative savings from avoiding disputed markets
 * when using the trust filter vs not using it.
 */
function buildEquityCurve(result: BacktestResult) {
  const { nLowTrust, nHighTrust, disputedLow, disputedHigh, threshold } = result;

  // Simulated: if every market costs $1 to enter and disputes return $0
  const STAKE = 100; // $100 per market

  // Without filter: trade everything
  const noFilterDisputes  = disputedLow + disputedHigh;
  const noFilterTotal     = nLowTrust   + nHighTrust;
  const noFilterLossRate  = noFilterDisputes / noFilterTotal;

  // With filter: only trade high-trust markets
  const filterDisputeRate = result.disputeRateHigh;

  // Build curve over 100 hypothetical markets
  const points = [];
  let pnlWithFilter = 0;
  let pnlWithout    = 0;

  for (let i = 1; i <= 100; i++) {
    // Each trade: without filter
    const withoutSurvivedRate = 1 - noFilterLossRate;
    pnlWithout += STAKE * withoutSurvivedRate - STAKE * noFilterLossRate;

    // Each trade: with filter (only high-trust)
    pnlWithFilter += STAKE * (1 - filterDisputeRate) - STAKE * filterDisputeRate;

    points.push({
      trade:        i,
      withFilter:   +pnlWithFilter.toFixed(0),
      withoutFilter: +pnlWithout.toFixed(0),
      alpha:        +(pnlWithFilter - pnlWithout).toFixed(0),
    });
  }
  return points;
}

export default function EquityCurve({ result }: Props) {
  const data = buildEquityCurve(result);
  const finalAlpha = data[data.length - 1]?.alpha ?? 0;

  return (
    <div className="rounded-xl border border-[#1e2a45] bg-[#060c14] p-6 h-[360px]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">
            Simulated Cumulative P&amp;L — Filter vs No Filter
          </h3>
          <p className="text-xs text-[#475569] mt-1">
            Hypothetical: $100 per trade, 100 sequential markets
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded border text-sm font-bold ${
          finalAlpha >= 0
            ? 'bg-[#022c1a] border-[#166534] text-[#34d399]'
            : 'bg-[#1a0000] border-[#7f1d1d] text-[#f87171]'
        }`}>
          α = ${finalAlpha >= 0 ? '+' : ''}{finalAlpha}
        </span>
      </div>

      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a45" />
          <XAxis
            dataKey="trade"
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#1e2a45' }}
            label={{ value: 'Trade #', fill: '#64748b', fontSize: 10, position: 'insideBottom', offset: -2 }}
          />
          <YAxis
            tickFormatter={v => `$${v}`}
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#0d1220',
              border: '1px solid #1e2a45',
              borderRadius: 8,
              color: '#f1f5f9',
              fontSize: 11,
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any, name: any) => [
              `$${v}`,
              (name ?? '') === 'withFilter' ? `With Trust Filter (≥ ${result.threshold})` : 'Without Filter',
            ] as any}
          />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
          <Line
            type="monotone"
            dataKey="withFilter"
            stroke="#34d399"
            strokeWidth={2}
            dot={false}
            name="withFilter"
          />
          <Line
            type="monotone"
            dataKey="withoutFilter"
            stroke="#f87171"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 3"
            name="withoutFilter"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
