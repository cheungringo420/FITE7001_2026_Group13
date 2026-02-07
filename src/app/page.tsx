'use client';

import { useEffect, useState, useCallback } from 'react';
import { MarketCard, MarketCardSkeleton, TrustBadge } from '@/components';
import { Market, parseMarket, ParsedMarket } from '@/lib/polymarket';
import { NormalizedMarket } from '@/lib/kalshi/types';
import { buildTrustMap, fetchTrustSummary, trustKey } from '@/lib/trust/client';
import { TrustSummaryItem } from '@/lib/trust/types';

type PlatformFilter = 'all' | 'polymarket' | 'kalshi';
type CategoryFilter = string; // 'all' or category name

// Define category icons and colors
const CATEGORY_CONFIG: Record<string, { icon: string; color: string }> = {
  'Crypto': { icon: '₿', color: 'from-orange-500 to-yellow-500' },
  'Bitcoin': { icon: '₿', color: 'from-orange-500 to-yellow-500' },
  'Politics': { icon: '🏛️', color: 'from-blue-500 to-indigo-500' },
  'US Politics': { icon: '🇺🇸', color: 'from-blue-500 to-red-500' },
  'Sports': { icon: '⚽', color: 'from-green-500 to-emerald-500' },
  'NBA': { icon: '🏀', color: 'from-orange-500 to-red-500' },
  'NFL': { icon: '🏈', color: 'from-green-600 to-yellow-600' },
  'Soccer': { icon: '⚽', color: 'from-green-500 to-emerald-500' },
  'Pop Culture': { icon: '🎬', color: 'from-pink-500 to-purple-500' },
  'Entertainment': { icon: '🎭', color: 'from-pink-500 to-purple-500' },
  'Science': { icon: '🔬', color: 'from-cyan-500 to-blue-500' },
  'Tech': { icon: '💻', color: 'from-violet-500 to-purple-500' },
  'AI': { icon: '🤖', color: 'from-violet-500 to-purple-500' },
  'Economy': { icon: '📈', color: 'from-emerald-500 to-teal-500' },
  'Finance': { icon: '💰', color: 'from-emerald-500 to-teal-500' },
  'World': { icon: '🌍', color: 'from-blue-500 to-cyan-500' },
  'Weather': { icon: '🌤️', color: 'from-sky-500 to-blue-500' },
  'Climate': { icon: '🌡️', color: 'from-red-500 to-orange-500' },
  'Elections': { icon: '🗳️', color: 'from-purple-500 to-pink-500' },
  'default': { icon: '📊', color: 'from-slate-500 to-slate-600' },
};

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
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [trustMap, setTrustMap] = useState<Record<string, TrustSummaryItem>>({});
  const [minTrust, setMinTrust] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch from both platforms + trust summary in parallel
      // No limits - show all available markets
       const [polyRes, kalshiRes, trustItems] = await Promise.all([
         fetch('/api/markets?limit=100&order=volume24hr&ascending=false'),
         fetch('/api/kalshi/markets?limit=100'),
         fetchTrustSummary({ platform: 'all', limit: 200 }),
       ]);

      if (polyRes.ok) {
        const polyData: Market[] = await polyRes.json();
        setPolymarketData(polyData.map(parseMarket));
        setLastUpdated(Date.now());
      }

      if (kalshiRes.ok) {
        const kalshiJson = await kalshiRes.json();
        setKalshiData(kalshiJson.markets || []);
        setLastUpdated(Date.now());
      }

      if (trustItems.length > 0) {
        setTrustMap(buildTrustMap(trustItems));
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
      if (categoryFilter === 'all') return true;
      const marketCategory = m.category?.toLowerCase() || '';
      const filterCategory = categoryFilter.toLowerCase();
      return marketCategory.includes(filterCategory) || filterCategory.includes(marketCategory);
    })
    .filter(m => {
      if (minTrust <= 0) return true;
      const trust = trustMap[trustKey(m.platform, m.id)];
      return trust ? trust.trustScore >= minTrust : false;
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

  const topOpportunities = filteredMarkets
    .filter(m => m.active)
    .map(m => {
      const volumeBase = m.volume24h || m.volume || 0;
      const conviction = Math.min(Math.abs(m.yesPrice - 0.5) * 2, 1);
      const volumeScore = Math.log10(volumeBase + 10);
      return {
        ...m,
        opportunityScore: conviction * volumeScore,
      };
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 6);

  // Derive unique categories from all markets
  const allCategories = Array.from(
    new Set(
      allMarkets
        .map(m => m.category)
        .filter((c): c is string => !!c && c.trim() !== '')
    )
  ).sort();

  const polyCount = polymarketData.length;
  const kalshiCount = kalshiData.length;

  return (
    <div className="min-h-screen terminal-bg">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="absolute inset-0 grid-overlay opacity-35" />
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent-cyan/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto">
          <div className="flex flex-col gap-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 text-xs uppercase tracking-[0.3em] text-brand-300 bg-brand-500/10">
                Market Intelligence
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mt-4 leading-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                <span className="text-gradient-brand">Prediction Market</span>
                <span className="block text-white">Arbitrage Terminal</span>
              </h1>
              <p className="text-lg text-slate-400 max-w-2xl mt-4">
                Real-time order book data and cross-platform spreads in a professional-grade market terminal.
                Monitor Polymarket and Kalshi side-by-side and surface actionable price discrepancies.
              </p>
            </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="/compare"
              className="px-6 py-3 bg-gradient-to-r from-brand-500 to-accent-cyan hover:from-brand-600 hover:to-accent-cyan text-white font-semibold rounded-xl transition-all flex items-center gap-2 shadow-glow-sm"
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
              className="px-6 py-3 bg-gradient-to-r from-emerald-500/80 to-brand-500/80 hover:from-emerald-500 hover:to-brand-500 text-white font-semibold rounded-xl transition-all flex items-center gap-2 border border-emerald-500/30"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Scan Arbitrage
            </a>
          </div>

          {/* Search */}
          <div className="max-w-xl">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search markets... (e.g., Bitcoin, Trump, Election)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full glass border border-slate-700/60 rounded-xl py-4 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:shadow-glow-sm transition-all"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-500">
              <span className="chip">Results {filteredMarkets.length}</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="chip chip-active"
                >
                  Clear search ×
                </button>
              )}
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Markets Grid */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        {/* Header with Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl font-bold text-white">
            {searchQuery
              ? `Search Results (${filteredMarkets.length})`
              : categoryFilter !== 'all'
                ? `${categoryFilter} Markets (${filteredMarkets.length})`
                : 'Trending Markets'}
          </h2>

          {/* Unified Filter Bar */}
          <div className="flex items-center gap-3">
            {/* Platform Pills */}
            <div className="flex items-center surface rounded-full p-1">
              <button
                onClick={() => setPlatformFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${platformFilter === 'all'
                  ? 'bg-white/10 text-white'
                  : 'text-slate-500 hover:text-white'
                  }`}
              >
                All
              </button>
              <button
                onClick={() => setPlatformFilter('polymarket')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${platformFilter === 'polymarket'
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'text-slate-500 hover:text-white'
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                Polymarket
              </button>
              <button
                onClick={() => setPlatformFilter('kalshi')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${platformFilter === 'kalshi'
                  ? 'bg-accent-cyan/20 text-accent-cyan'
                  : 'text-slate-500 hover:text-white'
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-accent-cyan"></span>
                Kalshi
              </button>
            </div>

            {/* Trust Filter */}
            <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-full px-3 py-1">
              <span className="text-xs text-slate-500">Min Trust</span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={minTrust}
                onChange={(e) => setMinTrust(Number(e.target.value))}
                className="w-24 accent-brand-500"
                aria-label="Minimum trust score"
              />
              <span className="text-xs text-slate-300">{minTrust}</span>
            </div>

            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live
            </div>
          </div>
        </div>

        {/* Category Filter - Horizontal Scroll */}
        {allCategories.length > 0 && (
          <div className="mb-8 -mx-4 px-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`flex-shrink-0 chip ${categoryFilter === 'all'
                    ? 'chip-active'
                    : 'hover:text-white'
                  }`}
              >
                All Markets
              </button>
              {allCategories.slice(0, 10).map((cat) => {
                const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG['default'];
                const isActive = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`flex-shrink-0 chip ${isActive
                        ? 'chip-active'
                        : 'hover:text-white'
                      }`}
                  >
                    <span>{config.icon}</span>
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Info Banner - Collapsible/Minimal */}
        <div className="mb-6 flex items-center gap-2 text-xs text-slate-500">
          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Data via official APIs • {polyCount + kalshiCount} markets</span>
          {lastUpdated && (
            <span className="text-slate-600">• Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
          )}
          {categoryFilter !== 'all' && (
            <button
              onClick={() => setCategoryFilter('all')}
              className="text-brand-300 hover:text-brand-200 ml-2"
            >
              Clear filter ×
            </button>
          )}
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

        {topOpportunities.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Top Opportunities</h3>
              <span className="text-xs text-slate-500">High conviction + liquidity</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topOpportunities.map((market) => (
                <div
                  key={`top-${market.id}`}
                  className="bg-slate-800/40 rounded-xl border border-slate-700/50 p-4 hover:border-brand-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full ${market.platform === 'polymarket'
                        ? 'bg-brand-500/20 text-brand-300'
                        : 'bg-accent-cyan/20 text-accent-cyan'
                      }`}>
                      {market.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                    </span>
                    <span className="text-slate-500">Vol {Math.round(market.volume24h || market.volume).toLocaleString()}</span>
                  </div>
                  {trustMap[trustKey(market.platform, market.id)] && (
                    <div className="mb-2">
                      <TrustBadge score={trustMap[trustKey(market.platform, market.id)]!.trustScore} compact />
                    </div>
                  )}
                  <div className="text-sm text-white font-medium line-clamp-2 mb-3">
                    {market.question}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-400">Yes {(market.yesPrice * 100).toFixed(1)}¢</span>
                    <span className="text-slate-500">Conviction {(Math.abs(market.yesPrice - 0.5) * 200).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
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
                  trust={trustMap[trustKey('polymarket', market.id)]}
                />
              ) : (
                <KalshiMarketCard
                  key={market.id}
                  market={market}
                  trust={trustMap[trustKey('kalshi', market.id)]}
                />
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
          <a href="/compare" className="bg-gradient-to-br from-brand-500/10 to-accent-cyan/10 rounded-2xl p-6 border border-brand-500/30 hover:border-brand-500/50 transition-all group">
            <div className="w-12 h-12 bg-gradient-to-br from-brand-500/20 to-accent-cyan/20 rounded-xl flex items-center justify-center mb-4">
              <div className="flex items-center gap-0.5">
                <span className="w-4 h-4 rounded bg-brand-500/30 text-brand-300 text-xs flex items-center justify-center font-bold">P</span>
                <span className="w-4 h-4 rounded bg-accent-cyan/30 text-accent-cyan text-xs flex items-center justify-center font-bold">K</span>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-brand-200 transition-colors">
              Cross-Platform Comparison
              <span className="ml-2 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">LIVE</span>
            </h3>
            <p className="text-slate-400 text-sm">Side-by-side comparison of Polymarket and Kalshi markets with real-time prices.</p>
          </a>

          <a href="/arbitrage" className="bg-gradient-to-br from-emerald-500/10 to-brand-500/10 rounded-2xl p-6 border border-emerald-500/30 hover:border-emerald-500/50 transition-all group">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-300 transition-colors">
              Arbitrage Scanner
              <span className="ml-2 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">LIVE</span>
            </h3>
            <p className="text-slate-400 text-sm">Automatically detect when Yes + No &lt; $1 across platforms for guaranteed profits.</p>
          </a>

          <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 opacity-75">
            <div className="w-12 h-12 bg-brand-500/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Auto-Trading
              <span className="ml-2 px-2 py-0.5 text-xs bg-slate-600 text-slate-300 rounded">SOON</span>
            </h3>
            <p className="text-slate-400 text-sm">Automated arbitrage execution when profitable opportunities are detected.</p>
          </div>

          <a href="/trust" className="bg-gradient-to-br from-sky-500/10 to-emerald-500/10 rounded-2xl p-6 border border-sky-500/30 hover:border-sky-400/60 transition-all group">
            <div className="w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm0 0v6m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-sky-200 transition-colors">
              Trust Center
              <span className="ml-2 px-2 py-0.5 text-xs bg-sky-500/20 text-sky-200 rounded">NEW</span>
            </h3>
            <p className="text-slate-400 text-sm">Evidence-backed resolution confidence and dispute risk for every market.</p>
          </a>
        </div>
      </section>
    </div>
  );
}

// Kalshi Market Card Component
function KalshiMarketCard({ market, trust }: { market: DisplayMarket; trust?: TrustSummaryItem }) {
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  return (
    <a href={market.url} target="_blank" rel="noopener noreferrer">
      <div className="market-card group relative web3-card rounded-2xl p-5 hover:shadow-xl hover:shadow-brand-500/10 cursor-pointer">
        {/* Platform Badge + Live indicator - Always visible */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-accent-cyan/15 border border-accent-cyan/30">
            <span className="w-4 h-4 rounded bg-accent-cyan/30 text-accent-cyan text-[10px] flex items-center justify-center font-bold">K</span>
            <span className="text-xs text-accent-cyan font-medium">Kalshi</span>
          </span>
          {market.active && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-green-400 font-medium">LIVE</span>
            </div>
          )}
        </div>

        {/* Placeholder for image alignment */}
        <div className="w-12 h-12 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 mb-4 flex items-center justify-center">
          <span className="text-accent-cyan text-lg font-bold">K</span>
        </div>

        {/* Trust Snapshot */}
        {trust && (
          <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
            <TrustBadge score={trust.trustScore} />
            <span className="text-slate-500">
              Dispute {trust.disputeRisk}%
            </span>
          </div>
        )}

        {/* Question */}
        <h3 className="text-white font-semibold text-lg mb-4 line-clamp-2 group-hover:text-brand-200 transition-colors">
          {market.question}
        </h3>

        {/* Yes/No Prices */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20">
            <div className="text-xs text-green-400 mb-1 font-medium">Yes</div>
            <div className="text-2xl font-bold text-green-400">
              {(market.yesPrice * 100).toFixed(1)}¢
            </div>
          </div>
          <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20">
            <div className="text-xs text-red-400 mb-1 font-medium">No</div>
            <div className="text-2xl font-bold text-red-400">
              {(market.noPrice * 100).toFixed(1)}¢
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
          <span className="text-accent-cyan flex items-center gap-1">
            Kalshi
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </span>
        </div>

        {/* Category Badge */}
        {market.category && (
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <span className="px-2 py-1 rounded-full text-xs bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">
              {market.category}
            </span>
          </div>
        )}
      </div>
    </a>
  );
}
