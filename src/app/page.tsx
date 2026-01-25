'use client';

import { useEffect, useState, useCallback } from 'react';
import { MarketCard, MarketCardSkeleton } from '@/components';
import { Market, parseMarket, ParsedMarket } from '@/lib/polymarket';
import { NormalizedMarket } from '@/lib/kalshi/types';

type PlatformFilter = 'all' | 'polymarket' | 'kalshi';

// Combined market type for display
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
  image?: string;
  url?: string;
  active: boolean;
  // Polymarket specific
  conditionId?: string;
  slug?: string;
}

export default function HomePage() {
  const [polymarketData, setPolymarketData] = useState<ParsedMarket[]>([]);
  const [kalshiData, setKalshiData] = useState<NormalizedMarket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch from both platforms in parallel
      // Increased limits to show more markets
      const [polyRes, kalshiRes] = await Promise.all([
        fetch('/api/markets?limit=100&order=volume24hr&ascending=false'),
        fetch('/api/kalshi/markets?limit=200'),
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Convert to unified display format
  const allMarkets: DisplayMarket[] = [
    // Polymarket markets
    ...polymarketData.map((m): DisplayMarket => ({
      id: m.conditionId,
      platform: 'polymarket',
      question: m.question,
      description: m.description,
      category: m.category,
      yesPrice: m.outcomePrices[0] || 0.5,
      noPrice: m.outcomePrices[1] || 0.5,
      volume24h: m.volume24hr || 0,
      volume: parseFloat(m.volume) || 0,
      image: m.image,
      url: m.events?.[0]?.slug
        ? `https://polymarket.com/event/${m.events[0].slug}`
        : `https://polymarket.com/event/${m.slug}`,
      active: m.active && !m.closed,
      conditionId: m.conditionId,
      slug: m.slug,
    })),
    // Kalshi markets
    ...kalshiData.map((m): DisplayMarket => ({
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
    })),
  ];

  // Filter by platform and search
  const filteredMarkets = allMarkets
    .filter(m => {
      if (platformFilter === 'polymarket') return m.platform === 'polymarket';
      if (platformFilter === 'kalshi') return m.platform === 'kalshi';
      return true;
    })
    .filter(m => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        m.question?.toLowerCase().includes(query) ||
        m.description?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

  const polyCount = polymarketData.length;
  const kalshiCount = kalshiData.length;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-950 to-pink-900/20"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Prediction Market
            </span>
            <br />
            <span className="text-white">Arbitrage Discovery</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            Real-time orderbook data and cross-platform arbitrage opportunities.
            Compare Polymarket & Kalshi markets side-by-side and discover profitable trades.
          </p>

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <a
              href="/compare"
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
            >
              <span className="flex items-center gap-1">
                <span className="w-5 h-5 rounded bg-white/20 text-white text-xs flex items-center justify-center font-bold">P</span>
                <span className="text-white/60">vs</span>
                <span className="w-5 h-5 rounded bg-white/20 text-white text-xs flex items-center justify-center font-bold">K</span>
              </span>
              Compare Markets
            </a>
            <a
              href="/arbitrage"
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Scan Arbitrage
            </a>
          </div>

          {/* Search */}
          <div className="max-w-xl mx-auto">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search markets... (e.g., Bitcoin, Trump, Election)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-4 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Markets Grid */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        {/* Header with Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl font-bold text-white">
            {searchQuery ? `Search Results (${filteredMarkets.length})` : 'Trending Markets'}
          </h2>

          {/* Platform Filter Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800/50 rounded-xl p-1 border border-slate-700/50">
              <button
                onClick={() => setPlatformFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${platformFilter === 'all'
                    ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-white border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                All
                <span className="ml-1.5 text-xs text-slate-500">({polyCount + kalshiCount})</span>
              </button>
              <button
                onClick={() => setPlatformFilter('polymarket')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${platformFilter === 'polymarket'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                <span className="w-4 h-4 rounded bg-purple-500/30 text-purple-400 text-[10px] flex items-center justify-center font-bold">P</span>
                Polymarket
                <span className="text-xs text-slate-500">({polyCount})</span>
              </button>
              <button
                onClick={() => setPlatformFilter('kalshi')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${platformFilter === 'kalshi'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                <span className="w-4 h-4 rounded bg-blue-500/30 text-blue-400 text-[10px] flex items-center justify-center font-bold">K</span>
                Kalshi
                <span className="text-xs text-slate-500">({kalshiCount})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Status */}
        <div className="flex items-center gap-4 mb-6">
          {(platformFilter === 'all' || platformFilter === 'polymarket') && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
              <span className="text-purple-400">Polymarket</span>
            </div>
          )}
          {(platformFilter === 'all' || platformFilter === 'kalshi') && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              <span className="text-blue-400">Kalshi</span>
            </div>
          )}
          <span className="text-slate-500 text-sm">• Live data</span>
        </div>

        {/* API Data Source Info */}
        <div className="mb-6 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm">
            <span className="text-slate-300">Data fetched via official APIs</span>
            <span className="text-slate-500 ml-1">
              — External links may be geo-restricted in some regions, but API data is always accessible.
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-8 text-red-400">
            {error}
            <button
              onClick={fetchData}
              className="ml-4 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            // Loading skeletons
            [...Array(6)].map((_, i) => <MarketCardSkeleton key={i} />)
          ) : filteredMarkets.length > 0 ? (
            filteredMarkets.map((market) => (
              market.platform === 'polymarket' ? (
                <MarketCard
                  key={market.id}
                  market={polymarketData.find(m => m.conditionId === market.id)!}
                />
              ) : (
                <KalshiMarketCard key={market.id} market={market} />
              )
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-slate-500">
              {searchQuery ? 'No markets found matching your search.' : 'No markets available.'}
            </div>
          )}
        </div>
      </section>

      {/* Platform Features */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-white mb-8">Platform Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a href="/compare" className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-2xl p-6 border border-purple-500/30 hover:border-purple-500/50 transition-all group">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl flex items-center justify-center mb-4">
              <div className="flex items-center gap-0.5">
                <span className="w-4 h-4 rounded bg-purple-500/30 text-purple-400 text-xs flex items-center justify-center font-bold">P</span>
                <span className="w-4 h-4 rounded bg-blue-500/30 text-blue-400 text-xs flex items-center justify-center font-bold">K</span>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
              Cross-Platform Comparison
              <span className="ml-2 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">LIVE</span>
            </h3>
            <p className="text-slate-400 text-sm">Side-by-side comparison of Polymarket and Kalshi markets with real-time prices.</p>
          </a>

          <a href="/arbitrage" className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl p-6 border border-green-500/30 hover:border-green-500/50 transition-all group">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-green-300 transition-colors">
              Arbitrage Scanner
              <span className="ml-2 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">LIVE</span>
            </h3>
            <p className="text-slate-400 text-sm">Automatically detect when Yes + No &lt; $1 across platforms for guaranteed profits.</p>
          </a>

          <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 opacity-75">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Auto-Trading
              <span className="ml-2 px-2 py-0.5 text-xs bg-slate-600 text-slate-300 rounded">SOON</span>
            </h3>
            <p className="text-slate-400 text-sm">Automated arbitrage execution when profitable opportunities are detected.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Kalshi Market Card Component
function KalshiMarketCard({ market }: { market: DisplayMarket }) {
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  return (
    <a href={market.url} target="_blank" rel="noopener noreferrer">
      <div className="market-card group relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm rounded-2xl p-5 border border-blue-500/30 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 cursor-pointer">
        {/* Platform Badge */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-blue-500/20 text-blue-400 text-[10px] flex items-center justify-center font-bold">K</span>
          {market.active && (
            <>
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-green-400 font-medium">LIVE</span>
            </>
          )}
        </div>

        {/* Category */}
        {market.category && (
          <div className="mb-3">
            <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300">
              {market.category}
            </span>
          </div>
        )}

        {/* Question */}
        <h3 className="text-white font-semibold text-lg mb-4 line-clamp-2 group-hover:text-blue-200 transition-colors pr-16">
          {market.question}
        </h3>

        {/* Yes/No Prices */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20">
            <div className="text-xs text-green-400 mb-1 font-medium">Yes</div>
            <div className="text-2xl font-bold text-green-400">
              {(market.yesPrice * 100).toFixed(0)}¢
            </div>
          </div>
          <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
            <div className="text-xs text-red-400 mb-1 font-medium">No</div>
            <div className="text-2xl font-bold text-red-400">
              {(market.noPrice * 100).toFixed(0)}¢
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-slate-400">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-500">Vol: </span>
              <span className="text-slate-300">{formatVolume(market.volume)}</span>
            </div>
            {market.volume24h > 0 && (
              <div>
                <span className="text-slate-500">24h: </span>
                <span className="text-slate-300">{formatVolume(market.volume24h)}</span>
              </div>
            )}
          </div>
          <span className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            Kalshi
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </span>
        </div>
      </div>
    </a>
  );
}
