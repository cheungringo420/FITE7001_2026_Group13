'use client';

import type { SampleMarket } from '../types';

interface Props { markets: SampleMarket[] }

export default function MarketSampleTable({ markets }: Props) {
  if (!markets?.length) return null;

  return (
    <div className="rounded-xl border border-[#1e2a45] bg-[#060c14] p-6">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">Sample Markets</h3>
        <p className="text-xs text-[#475569] mt-1">
          Examples across the trust score spectrum — showing correctly flagged and missed cases
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2a45]">
              {['Market', 'Trust Score', 'Category', 'Resolved', 'Outcome'].map(h => (
                <th key={h} className="text-left text-xs text-[#64748b] font-medium pb-3 pr-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#0d1220]">
            {markets.map(m => (
              <tr key={m.id} className="hover:bg-[#0d1220] transition-colors">
                <td className="py-3 pr-4 max-w-xs">
                  <p className="text-white text-xs leading-snug line-clamp-2">{m.question}</p>
                </td>
                <td className="py-3 pr-4">
                  <TrustBadge score={m.compositeScore} />
                </td>
                <td className="py-3 pr-4">
                  <span className="text-[#64748b] text-xs capitalize">{m.category || '—'}</span>
                </td>
                <td className="py-3 pr-4">
                  <span className="text-[#64748b] text-xs">
                    {m.resolvedAt ? new Date(m.resolvedAt).toLocaleDateString() : '—'}
                  </span>
                </td>
                <td className="py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                    m.disputed
                      ? 'bg-red-950/40 border border-red-900/50 text-red-400'
                      : 'bg-green-950/40 border border-green-900/50 text-green-400'
                  }`}>
                    {m.disputed ? '⚠ Disputed' : '✓ Clean'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrustBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
      style={{ color, background: `${color}18`, border: `1px solid ${color}40` }}
    >
      {Math.round(score)}
    </span>
  );
}
