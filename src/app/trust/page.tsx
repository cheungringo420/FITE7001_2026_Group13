'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TrustBadge } from '@/components';
import { TrustAnalysis, TrustSummaryItem } from '@/lib/trust/types';

type PlatformFilter = 'all' | 'polymarket' | 'kalshi';

export default function TrustCenterPage() {
  const [summary, setSummary] = useState<TrustSummaryItem[]>([]);
  const [selected, setSelected] = useState<TrustSummaryItem | null>(null);
  const [analysis, setAnalysis] = useState<TrustAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [minTrust, setMinTrust] = useState(0);
  const [sources, setSources] = useState<Array<{ id: string; name: string }>>([]);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [serverScheduler, setServerScheduler] = useState<{ running: boolean; intervalMs: number; lastRun: string | null } | null>(null);
  const [evidenceView, setEvidenceView] = useState<'list' | 'timeline'>('list');

  const fetchSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/trust/summary?platform=all&limit=200&minTrust=0`);
      if (!response.ok) {
        throw new Error('Failed to load trust summary');
      }
      const data = await response.json();
      setSummary(data.items || []);
      if (data.items?.length) {
        setSelected((prev) => prev ?? data.items[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trust summary');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAnalysis = useCallback(async (target: TrustSummaryItem | null) => {
    if (!target) return;
    try {
      const response = await fetch(`/api/trust/market?platform=${target.platform}&id=${target.marketId}`);
      if (!response.ok) return;
      const data = await response.json();
      setAnalysis(data.analysis || null);
    } catch {
      setAnalysis(null);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchAnalysis(selected);
  }, [fetchAnalysis, selected]);

  useEffect(() => {
    let active = true;
    const loadSources = async () => {
      try {
        const response = await fetch('/api/trust/sources');
        if (!response.ok) return;
        const data = await response.json();
        if (active) {
          setSources(data.sources || []);
        }
      } catch {
        if (active) setSources([]);
      }
    };

    loadSources();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchScheduler = async () => {
      try {
        const response = await fetch('/api/trust/scheduler');
        if (!response.ok) return;
        const data = await response.json();
        if (active) setServerScheduler(data);
      } catch {
        if (active) setServerScheduler(null);
      }
    };

    fetchScheduler();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(async () => {
      await fetch('/api/trust/refresh', { method: 'POST' });
      await fetchSummary();
      await fetchAnalysis(selected);
    }, 60000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchAnalysis, fetchSummary, selected]);

  const filteredSummary = useMemo(() => {
    return summary
      .filter((item) => {
        if (platformFilter === 'all') return true;
        return item.platform === platformFilter;
      })
      .filter((item) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return item.question.toLowerCase().includes(query);
      })
      .filter((item) => item.trustScore >= minTrust);
  }, [summary, platformFilter, searchQuery, minTrust]);

  const sourceMap = useMemo(() => {
    return sources.reduce<Record<string, string>>((acc, source) => {
      acc[source.id] = source.name;
      return acc;
    }, {});
  }, [sources]);

  const filteredEvidence = useMemo(() => {
    if (!analysis) return [];
    if (sourceFilter === 'all') return analysis.evidence;
    return analysis.evidence.filter((item) => item.sourceId === sourceFilter);
  }, [analysis, sourceFilter]);

  const groupedEvidence = useMemo(() => {
    if (evidenceView !== 'timeline') return [];
    return filteredEvidence.reduce<Record<string, typeof filteredEvidence>>((acc, item) => {
      const key = item.publishedAt || 'Unknown date';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [evidenceView, filteredEvidence]);

  const handleExportCsv = () => {
    const headers = ['platform', 'marketId', 'question', 'trustScore', 'resolutionConfidence', 'disputeRisk', 'integrityRisk', 'evidenceCount'];
    const rows = filteredSummary.map((item) => [
      item.platform,
      item.marketId,
      `"${item.question.replace(/\"/g, '""')}"`,
      item.trustScore,
      item.resolutionConfidence,
      item.disputeRisk,
      item.integrityRisk,
      item.evidenceCount,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trust-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleToggleServerScheduler = async () => {
    try {
      const response = serverScheduler?.running
        ? await fetch('/api/trust/scheduler', { method: 'DELETE' })
        : await fetch('/api/trust/scheduler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intervalMs: 60000 }) });

      if (!response.ok) return;
      const data = await response.json();
      setServerScheduler(data);
    } catch {
      setServerScheduler((prev) => prev ?? null);
    }
  };

  const handleExportEvidenceCsv = () => {
    if (!analysis) return;
    const headers = ['id', 'publishedAt', 'source', 'stance', 'title', 'summary', 'similarity', 'reliability'];
    const rows = filteredEvidence.map((item) => [
      item.id,
      item.publishedAt,
      `"${(sourceMap[item.sourceId] || item.sourceId).replace(/\"/g, '""')}"`,
      item.stance,
      `"${item.title.replace(/\"/g, '""')}"`,
      `"${item.summary.replace(/\"/g, '""')}"`,
      item.similarity?.toFixed(2) ?? '',
      item.reliability?.toFixed(2) ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trust-evidence-${selected?.marketId || 'market'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen terminal-bg py-10">
      <section className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 text-xs uppercase tracking-[0.3em] text-brand-300 bg-brand-500/10">
            Trust Center
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mt-4" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            Resolution Confidence & Evidence Explorer
          </h1>
          <p className="text-slate-400 mt-2 max-w-2xl">
            Audit market clarity, evidence consensus, and dispute risk before committing capital.
          </p>
          <a href="/learn#trust-scoring" className="inline-flex items-center gap-1.5 mt-2 text-xs text-brand-300 hover:text-brand-200 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            How is trust score calculated? →
          </a>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
              />
              Auto refresh trust cache (60s)
            </label>
            <button
              onClick={handleToggleServerScheduler}
              className="px-3 py-1.5 rounded-full border border-slate-700/60 text-slate-200 hover:border-slate-600 transition-colors"
            >
              {serverScheduler?.running ? 'Stop Server Scheduler' : 'Start Server Scheduler'}
            </button>
            {serverScheduler && (
              <span className="text-slate-500">
                Server {serverScheduler.running ? 'ON' : 'OFF'} · {Math.round((serverScheduler.intervalMs || 0) / 1000)}s · Last {serverScheduler.lastRun ? new Date(serverScheduler.lastRun).toLocaleTimeString() : '—'}
              </span>
            )}
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-full border border-slate-700/60 text-slate-200 hover:border-slate-600 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Left panel */}
          <div className="surface rounded-2xl p-4 h-[72vh] flex flex-col">
            <div className="space-y-3 mb-4">
              <input
                type="text"
                placeholder="Search markets"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
              <div className="flex items-center gap-2">
                {(['all', 'polymarket', 'kalshi'] as PlatformFilter[]).map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setPlatformFilter(platform)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${platformFilter === platform
                        ? 'bg-white/10 text-white'
                        : 'text-slate-500 hover:text-white'
                      }`}
                  >
                    {platform === 'all' ? 'All' : platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Min Trust</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={minTrust}
                  onChange={(e) => setMinTrust(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
                <span className="text-slate-300">{minTrust}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {isLoading ? (
                <div className="text-slate-500 text-sm">Loading trust data...</div>
              ) : filteredSummary.length === 0 ? (
                <div className="text-slate-500 text-sm">No markets match the filters.</div>
              ) : (
                filteredSummary.map((item) => (
                  <button
                    key={`${item.platform}-${item.marketId}`}
                    onClick={() => setSelected(item)}
                    className={`w-full text-left rounded-lg p-3 border transition-all ${selected?.marketId === item.marketId && selected?.platform === item.platform
                        ? 'border-brand-500/40 bg-brand-500/10'
                        : 'border-slate-700/50 hover:border-slate-600/80'
                      }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className={item.platform === 'polymarket' ? 'text-brand-300' : 'text-accent-cyan'}>
                        {item.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                      </span>
                      <span>Dispute {item.disputeRisk}%</span>
                    </div>
                    <div className="text-sm text-white line-clamp-2">{item.question}</div>
                    <div className="mt-2">
                      <TrustBadge score={item.trustScore} compact />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-6">
            <div className="surface rounded-2xl p-6">
              {selected ? (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-xs text-slate-500">Selected Market</div>
                      <h2 className="text-xl font-semibold text-white mt-1">{selected.question}</h2>
                      <p className="text-sm text-slate-400 mt-2">
                        {selected.category || 'General'} • {selected.platform}
                      </p>
                    </div>
                    <TrustBadge score={selected.trustScore} />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="surface-strong rounded-xl p-3">
                      <div className="text-xs text-slate-500">Resolution</div>
                      <div className="text-lg font-semibold text-white">{selected.resolutionConfidence}%</div>
                    </div>
                    <div className="surface-strong rounded-xl p-3">
                      <div className="text-xs text-slate-500">Dispute Risk</div>
                      <div className="text-lg font-semibold text-white">{selected.disputeRisk}%</div>
                    </div>
                    <div className="surface-strong rounded-xl p-3">
                      <div className="text-xs text-slate-500">Integrity Risk</div>
                      <div className="text-lg font-semibold text-white">{selected.integrityRisk}%</div>
                    </div>
                    <div className="surface-strong rounded-xl p-3">
                      <div className="text-xs text-slate-500">Evidence</div>
                      <div className="text-lg font-semibold text-white">{selected.evidenceCount}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-slate-500">Select a market to view trust details.</div>
              )}
            </div>

            <div className="surface rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Dispute Risk Breakdown</h3>
              {analysis ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Criteria Clarity</span>
                    <span>{(analysis.criteria.clarityScore * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full">
                    <div className="h-2 bg-emerald-500/70 rounded-full" style={{ width: `${analysis.criteria.clarityScore * 100}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Evidence Consensus</span>
                    <span>{(analysis.consensusScore * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full">
                    <div className="h-2 bg-sky-500/70 rounded-full" style={{ width: `${analysis.consensusScore * 100}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Integrity Risk</span>
                    <span>{analysis.integrityRisk}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full">
                    <div className="h-2 bg-rose-500/70 rounded-full" style={{ width: `${analysis.integrityRisk}%` }} />
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-sm">Select a market to view breakdown.</div>
              )}
            </div>

            <div className="surface rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4 gap-3">
                <h3 className="text-lg font-semibold text-white">Evidence Explorer</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setEvidenceView('list')}
                      className={`px-3 py-1 text-xs ${evidenceView === 'list' ? 'bg-brand-500/20 text-brand-200' : 'text-slate-400'}`}
                    >
                      List
                    </button>
                    <button
                      onClick={() => setEvidenceView('timeline')}
                      className={`px-3 py-1 text-xs ${evidenceView === 'timeline' ? 'bg-brand-500/20 text-brand-200' : 'text-slate-400'}`}
                    >
                      Timeline
                    </button>
                  </div>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-200"
                  >
                    <option value="all">All Sources</option>
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>{source.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleExportEvidenceCsv}
                    disabled={!analysis}
                    className="px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs text-slate-200 hover:border-slate-600 transition-colors disabled:opacity-50"
                  >
                    Export Evidence
                  </button>
                </div>
              </div>
              {filteredEvidence.length ? (
                evidenceView === 'list' ? (
                  <div className="space-y-3">
                    {filteredEvidence.map((item) => (
                      <div key={item.id} className="border border-slate-700/50 rounded-xl p-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span>{item.publishedAt}</span>
                          <span className={`font-medium ${item.stance === 'support'
                              ? 'text-green-400'
                              : item.stance === 'contradict'
                                ? 'text-red-400'
                                : 'text-slate-400'
                            }`}>
                            {item.stance.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-white mb-1">{item.title}</div>
                        <div className="text-xs text-slate-500 mb-2">
                          {sourceMap[item.sourceId] || item.sourceId}
                        </div>
                        <div className="text-xs text-slate-400">{item.summary}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedEvidence)
                      .sort(([a], [b]) => b.localeCompare(a))
                      .map(([date, items]) => (
                        <div key={date}>
                          <div className="text-xs text-slate-500 mb-2">{date}</div>
                          <div className="space-y-3">
                            {items.map((item) => (
                              <div key={item.id} className="border border-slate-700/50 rounded-xl p-3">
                                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                  <span>{sourceMap[item.sourceId] || item.sourceId}</span>
                                  <span className={`font-medium ${item.stance === 'support'
                                      ? 'text-green-400'
                                      : item.stance === 'contradict'
                                        ? 'text-red-400'
                                        : 'text-slate-400'
                                    }`}>
                                    {item.stance.toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-sm text-white mb-1">{item.title}</div>
                                <div className="text-xs text-slate-400">{item.summary}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )
              ) : (
                <div className="text-slate-500 text-sm">No evidence linked to this market yet.</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
