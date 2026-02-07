'use client';

import { useEffect, useMemo, useState } from 'react';
import { Market, ParsedMarket, parseMarket, OrderBook as OrderBookType } from '@/lib/polymarket';
import { NormalizedMarket } from '@/lib/kalshi/types';
import { OrderBook, TradingPanel, TrustBadge } from '@/components';
import { buildTrustMap, fetchTrustSummary, trustKey } from '@/lib/trust/client';
import { TrustSummaryItem } from '@/lib/trust/types';

interface DisplayMarket {
  id: string;
  platform: 'polymarket' | 'kalshi';
  question: string;
  description?: string;
  category?: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  volume: number;
  url?: string;
  active: boolean;
  tokenId?: string; // Polymarket CLOB token
}

export default function TerminalPage() {
  const [polymarketData, setPolymarketData] = useState<ParsedMarket[]>([]);
  const [kalshiData, setKalshiData] = useState<NormalizedMarket[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<DisplayMarket | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<'volume' | 'yes' | 'no' | 'market'>('volume');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [trustMap, setTrustMap] = useState<Record<string, TrustSummaryItem>>({});
  const [minTrust, setMinTrust] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [polyRes, kalshiRes] = await Promise.all([
          fetch('/api/markets?limit=80&order=volume24hr&ascending=false'),
          fetch('/api/kalshi/markets?limit=80'),
        ]);

        if (polyRes.ok) {
          const polyData: Market[] = await polyRes.json();
          setPolymarketData(polyData.map(parseMarket));
        }

        if (kalshiRes.ok) {
          const kalshiJson = await kalshiRes.json();
          setKalshiData(kalshiJson.markets || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let active = true;
    fetchTrustSummary({ platform: 'all', limit: 200 }).then((items) => {
      if (!active) return;
      if (items.length > 0) {
        setTrustMap(buildTrustMap(items));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const source = new EventSource('/api/stream/markets');

    const onSnapshot = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { polymarket?: Market[]; kalshi?: NormalizedMarket[] };
        if (data.polymarket) {
          setPolymarketData(data.polymarket.map(parseMarket));
        }
        if (data.kalshi) {
          setKalshiData(data.kalshi);
        }
      } catch {
        // Ignore malformed events
      }
    };

    source.addEventListener('snapshot', onSnapshot as EventListener);

    return () => {
      source.removeEventListener('snapshot', onSnapshot as EventListener);
      source.close();
    };
  }, []);

  const allMarkets: DisplayMarket[] = useMemo(() => {
    const poly = polymarketData.map((m): DisplayMarket => ({
      id: m.conditionId,
      platform: 'polymarket',
      question: m.question,
      description: m.description,
      category: m.category,
      yesPrice: m.outcomePrices[0] || 0.5,
      noPrice: m.outcomePrices[1] || 0.5,
      volume24h: m.volume24hr || 0,
      volume: parseFloat(m.volume) || 0,
      url: m.events?.[0]?.slug
        ? `https://polymarket.com/event/${m.events[0].slug}`
        : `https://polymarket.com/event/${m.slug}`,
      active: m.active && !m.closed,
      tokenId: m.clobTokenIds?.[0],
    }));

    const kalshi = kalshiData.map((m): DisplayMarket => ({
      id: m.id,
      platform: 'kalshi',
      question: m.question,
      description: m.description,
      category: m.category,
      yesPrice: m.yesPrice,
      noPrice: m.noPrice,
      volume24h: m.volume24h,
      volume: m.volume,
      url: m.url,
      active: m.status === 'active',
    }));

    return [...poly, ...kalshi].sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
  }, [polymarketData, kalshiData]);

  const filteredMarkets = useMemo(() => {
    if (!searchQuery) return allMarkets;
    const query = searchQuery.toLowerCase();
    return allMarkets.filter((m) => m.question.toLowerCase().includes(query));
  }, [allMarkets, searchQuery]);

  const sortedMarkets = useMemo(() => {
    const data = filteredMarkets.filter((market) => {
      if (minTrust <= 0) return true;
      const trust = trustMap[trustKey(market.platform, market.id)];
      return trust ? trust.trustScore >= minTrust : false;
    });
    data.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'market':
          diff = a.question.localeCompare(b.question);
          break;
        case 'yes':
          diff = a.yesPrice - b.yesPrice;
          break;
        case 'no':
          diff = a.noPrice - b.noPrice;
          break;
        case 'volume':
        default:
          diff = (a.volume24h || 0) - (b.volume24h || 0);
          break;
      }
      return sortDir === 'asc' ? diff : -diff;
    });
    return data;
  }, [filteredMarkets, minTrust, sortKey, sortDir, trustMap]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  useEffect(() => {
    if (!selectedMarket && filteredMarkets.length > 0) {
      setSelectedMarket(filteredMarkets[0]);
    }
  }, [filteredMarkets, selectedMarket]);

  useEffect(() => {
    const fetchOrderBook = async () => {
      if (!selectedMarket || selectedMarket.platform !== 'polymarket' || !selectedMarket.tokenId) {
        setOrderBook(null);
        return;
      }

      try {
        const response = await fetch(`/api/orderbook/${selectedMarket.tokenId}`);
        if (response.ok) {
          const data: OrderBookType = await response.json();
          setOrderBook(data);
        }
      } catch {
        setOrderBook(null);
      }
    };

    fetchOrderBook();
  }, [selectedMarket]);

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen terminal-bg">
      <section className="relative overflow-hidden py-8 px-4">
        <div className="absolute inset-0 grid-overlay opacity-30" />
        <div className="relative max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-brand-300">Terminal</div>
              <h1 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                Market Operations Console
              </h1>
              <p className="text-slate-400 mt-2">
                Professional split-pane view for monitoring liquidity, spreads, and execution readiness.
              </p>
            </div>
            <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
              <span className="chip">Markets: {allMarkets.length}</span>
              <span className="chip">Live stream ready</span>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-12">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_360px] gap-6">
          {/* Left: Market list */}
          <div className="surface rounded-2xl p-4 h-[70vh] flex flex-col">
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search markets"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex items-center gap-2 mb-4 text-xs text-slate-400">
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
            <div className="flex-1 overflow-y-auto space-y-2">
              {isLoading ? (
                <div className="text-slate-500 text-sm">Loading markets...</div>
              ) : (
                sortedMarkets.slice(0, 50).map((market) => (
                  <button
                    key={`${market.platform}-${market.id}`}
                    onClick={() => setSelectedMarket(market)}
                    className={`w-full text-left rounded-lg p-3 border transition-all ${
                      selectedMarket?.id === market.id && selectedMarket?.platform === market.platform
                        ? 'border-brand-500/40 bg-brand-500/10'
                        : 'border-slate-700/50 hover:border-slate-600/80'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className={market.platform === 'polymarket' ? 'text-brand-300' : 'text-accent-cyan'}>
                        {market.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                      </span>
                      <span>{formatVolume(market.volume24h)}</span>
                    </div>
                    {trustMap[trustKey(market.platform, market.id)] && (
                      <div className="mb-1">
                        <TrustBadge score={trustMap[trustKey(market.platform, market.id)]!.trustScore} compact />
                      </div>
                    )}
                    <div className="text-sm text-white line-clamp-2">{market.question}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Yes {(market.yesPrice * 100).toFixed(1)}¢ · No {(market.noPrice * 100).toFixed(1)}¢
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Center: Market table + details */}
          <div className="space-y-6">
            <div className="surface rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">Market Table</h3>
                <div className="text-xs text-slate-500">Sorted by {sortKey} ({sortDir})</div>
              </div>
              <div className="max-h-[240px] overflow-y-auto border border-slate-800 rounded-lg">
                <table className="w-full text-xs text-slate-400">
                  <thead className="sticky top-0 bg-slate-900/90 text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2 cursor-pointer" onClick={() => handleSort('market')}>Market</th>
                      <th className="text-left px-3 py-2">Platform</th>
                      <th className="text-right px-3 py-2 cursor-pointer" onClick={() => handleSort('yes')}>Yes</th>
                      <th className="text-right px-3 py-2 cursor-pointer" onClick={() => handleSort('no')}>No</th>
                      <th className="text-right px-3 py-2 cursor-pointer" onClick={() => handleSort('volume')}>24h Vol</th>
                      <th className="text-right px-3 py-2">Depth</th>
                      <th className="text-right px-3 py-2">Trust</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMarkets.slice(0, 50).map((market) => {
                      const yesPct = Math.max(0, Math.min(1, market.yesPrice)) * 100;
                      const trust = trustMap[trustKey(market.platform, market.id)];
                      return (
                        <tr
                          key={`${market.platform}-${market.id}-row`}
                          className={`border-b border-slate-800 hover:bg-slate-900/50 cursor-pointer ${
                            selectedMarket?.id === market.id && selectedMarket?.platform === market.platform ? 'bg-slate-900/70' : ''
                          }`}
                          onClick={() => setSelectedMarket(market)}
                        >
                          <td className="px-3 py-2 text-slate-200 max-w-[240px] truncate">{market.question}</td>
                          <td className={`px-3 py-2 ${market.platform === 'polymarket' ? 'text-brand-300' : 'text-accent-cyan'}`}>
                            {market.platform === 'polymarket' ? 'Poly' : 'Kalshi'}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-400">{(market.yesPrice * 100).toFixed(1)}¢</td>
                          <td className="px-3 py-2 text-right text-rose-400">{(market.noPrice * 100).toFixed(1)}¢</td>
                          <td className="px-3 py-2 text-right text-slate-300">{formatVolume(market.volume24h)}</td>
                          <td className="px-3 py-2">
                            <div className="relative h-2 w-20 bg-slate-800 rounded-full ml-auto">
                              <div className="absolute left-0 top-0 h-2 bg-emerald-400/60 rounded-full" style={{ width: `${yesPct}%` }} />
                              <div className="absolute top-0 h-2 border-r border-rose-400" style={{ left: `${yesPct}%` }} />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {trust ? (
                              <span className="text-xs text-slate-200">{trust.trustScore}</span>
                            ) : (
                              <span className="text-xs text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="surface rounded-2xl p-6">
              {selectedMarket ? (
                <>
                  {trustMap[trustKey(selectedMarket.platform, selectedMarket.id)] && (
                    <div className="mb-4 flex items-center justify-between">
                      <TrustBadge score={trustMap[trustKey(selectedMarket.platform, selectedMarket.id)]!.trustScore} />
                      <span className="text-xs text-slate-500">
                        Dispute {trustMap[trustKey(selectedMarket.platform, selectedMarket.id)]!.disputeRisk}%
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-2">Selected Market</div>
                      <h2 className="text-xl font-semibold text-white" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                        {selectedMarket.question}
                      </h2>
                      <p className="text-sm text-slate-400 mt-2">
                        {selectedMarket.description || 'No description available.'}
                      </p>
                    </div>
                    <span className={`chip ${selectedMarket.platform === 'polymarket' ? 'chip-active' : ''}`}>
                      {selectedMarket.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="surface-strong rounded-xl p-3">
                      <div className="text-xs text-slate-500">Yes</div>
                      <div className="text-lg font-semibold text-emerald-400">{(selectedMarket.yesPrice * 100).toFixed(1)}¢</div>
                    </div>
                    <div className="surface-strong rounded-xl p-3">
                      <div className="text-xs text-slate-500">No</div>
                      <div className="text-lg font-semibold text-rose-400">{(selectedMarket.noPrice * 100).toFixed(1)}¢</div>
                    </div>
                    <div className="surface-strong rounded-xl p-3">
                      <div className="text-xs text-slate-500">24h Volume</div>
                      <div className="text-lg font-semibold text-white">{formatVolume(selectedMarket.volume24h)}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-slate-500">Select a market to view details.</div>
              )}
            </div>

            <div className="surface rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                  Order Book
                </h3>
                <span className="text-xs text-slate-500">{selectedMarket?.platform === 'polymarket' ? 'CLOB' : 'Snapshot'}</span>
              </div>
              {selectedMarket?.platform === 'polymarket' ? (
                <OrderBook
                  bids={orderBook?.bids || []}
                  asks={orderBook?.asks || []}
                  isLoading={!orderBook}
                />
              ) : (
                <div className="text-sm text-slate-500">
                  Order book streaming is currently available for Polymarket markets. Kalshi depth
                  integration is planned in the execution service.
                </div>
              )}
            </div>
          </div>

          {/* Right: Execution panel */}
          <div className="space-y-6">
            <div className="surface rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                Execution Panel
              </h3>
              {selectedMarket ? (
                <TradingPanel
                  yesPrice={selectedMarket.yesPrice}
                  noPrice={selectedMarket.noPrice}
                  marketQuestion={selectedMarket.question}
                  outcomes={['Yes', 'No']}
                  disabled={false}
                  executionTarget={{
                    platform: selectedMarket.platform,
                    marketId: selectedMarket.id,
                  }}
                  trust={trustMap[trustKey(selectedMarket.platform, selectedMarket.id)]}
                />
              ) : (
                <div className="text-sm text-slate-500">Select a market to configure a trade.</div>
              )}
            </div>

            <div className="surface rounded-2xl p-6">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Execution Checklist</h4>
              <ul className="text-xs text-slate-500 space-y-2">
                <li>• Market equivalence verified</li>
                <li>• Slippage within threshold</li>
                <li>• Risk budget available</li>
                <li>• Execution service ready</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
