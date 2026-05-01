'use client';

import { useState } from 'react';
import type { BacktestConfig } from '../types';

interface Props {
  onRun:   (config: BacktestConfig) => void;
  loading: boolean;
}

const CATEGORIES = ['All', 'Politics', 'Elections', 'Crypto', 'Finance', 'Sports', 'Geopolitics', 'Economics'];

export default function BacktestControls({ onRun, loading }: Props) {
  const [threshold, setThreshold] = useState(50);
  const [dateFrom,  setDateFrom]  = useState('2022-07-01');
  const [dateTo,    setDateTo]    = useState('2025-12-31');
  const [category,  setCategory]  = useState('All');

  const handleRun = () => {
    onRun({
      threshold,
      dateFrom,
      dateTo,
      category: category === 'All' ? null : category.toLowerCase(),
      platform: 'polymarket',
    });
  };

  return (
    <div className="rounded-xl border border-[#1e2a45] bg-[#060c14] p-6">
      <h2 className="text-sm font-bold text-[#64748b] tracking-widest mb-5">BACKTEST CONFIGURATION</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {/* Threshold Slider */}
        <div className="lg:col-span-2">
          <label className="block text-xs text-[#64748b] mb-2 font-medium">
            Trust Score Threshold
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={10} max={90} step={5}
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              data-testid="threshold-slider"
              className="flex-1 accent-[#34d399]"
            />
            <div
              data-testid="threshold-input"
              className="w-16 text-center rounded-lg bg-[#0d1220] border border-[#1e2a45]
                         text-[#34d399] font-bold text-lg py-1"
            >
              {threshold}
            </div>
          </div>
          <p className="text-[#475569] text-xs mt-2">
            Markets with score &lt; {threshold} are &ldquo;low trust&rdquo; · ≥ {threshold} are &ldquo;high trust&rdquo;
          </p>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-xs text-[#64748b] mb-2 font-medium">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="w-full rounded-lg bg-[#0d1220] border border-[#1e2a45] text-white
                       px-3 py-2 text-sm focus:outline-none focus:border-[#34d399]"
          />
        </div>
        <div>
          <label className="block text-xs text-[#64748b] mb-2 font-medium">Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="w-full rounded-lg bg-[#0d1220] border border-[#1e2a45] text-white
                       px-3 py-2 text-sm focus:outline-none focus:border-[#34d399]"
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              category === cat
                ? 'bg-[#0d2518] border border-[#34d399] text-[#34d399]'
                : 'bg-[#0d1220] border border-[#1e2a45] text-[#64748b] hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-[#475569]">Quick presets:</span>
        {[30, 40, 50, 60, 70].map(t => (
          <button
            key={t}
            onClick={() => setThreshold(t)}
            className="px-3 py-1 rounded text-xs bg-[#0d1220] border border-[#1e2a45]
                       text-[#64748b] hover:text-white hover:border-[#64748b] transition-colors"
          >
            Threshold = {t}
          </button>
        ))}

        <button
          onClick={handleRun}
          disabled={loading}
          data-testid="run-backtest-btn"
          className="ml-auto px-6 py-2.5 rounded-lg bg-[#34d399] text-black font-bold
                     text-sm hover:bg-[#6ee7b7] disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {loading ? 'Running…' : '▶ Run Backtest'}
        </button>
      </div>
    </div>
  );
}
