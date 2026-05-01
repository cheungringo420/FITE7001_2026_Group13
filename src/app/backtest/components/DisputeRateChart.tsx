'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import type { DecileBucket } from '../types';

interface Props {
  deciles:   DecileBucket[];
  threshold: number;
}

export default function DisputeRateChart({ deciles, threshold }: Props) {
  const data = deciles.map(d => ({
    range:        d.scoreRange,
    disputeRate:  +(d.disputeRate * 100).toFixed(2),
    n:            d.nMarkets,
    disputed:     d.nDisputed,
    lowTrust:     d.scoreRange.startsWith('0') ||
                  parseInt(d.scoreRange) < threshold,
  }));

  const avgRate = deciles.reduce((s, d) => s + d.disputeRate, 0) / Math.max(deciles.length, 1);

  return (
    <div className="rounded-xl border border-[#1e2a45] bg-[#060c14] p-6 h-[360px]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Dispute Rate by Trust Score Decile</h3>
          <p className="text-xs text-[#475569] mt-1">
            Red bars = below threshold · Green = above threshold
          </p>
        </div>
        <span className="text-xs bg-[#0d1220] border border-[#1e2a45] px-2 py-1 rounded text-[#64748b]">
          Avg: {(avgRate * 100).toFixed(2)}%
        </span>
      </div>

      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a45" />
          <XAxis
            dataKey="range"
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#1e2a45' }}
          />
          <YAxis
            tickFormatter={v => `${v}%`}
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
              fontSize: 12,
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: any, _name: any, props: any) => [
              `${value}% (${props.payload.disputed}/${props.payload.n})`,
              'Dispute Rate',
            ]) as any}
          />
          <ReferenceLine
            y={avgRate * 100}
            stroke="#fbbf24"
            strokeDasharray="4 2"
            label={{ value: 'Avg', fill: '#fbbf24', fontSize: 10 }}
          />
          <Bar dataKey="disputeRate" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.lowTrust ? '#f87171' : '#34d399'}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
