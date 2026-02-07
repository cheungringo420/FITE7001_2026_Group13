'use client';

import { useState } from 'react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { TrustBadge } from '@/components';
import { Position, Trade } from '@/lib/portfolio/types';
import { useMarketStream } from '@/hooks/useMarketStream';

// Stats card component
function StatCard({
    title,
    value,
    subtitle,
    trend,
    color = 'default'
}: {
    title: string;
    value: string;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
    color?: 'default' | 'green' | 'red' | 'purple' | 'blue';
}) {
    const colorClasses = {
        default: 'bg-slate-800/50',
        green: 'bg-green-500/10 border-green-500/20',
        red: 'bg-red-500/10 border-red-500/20',
        purple: 'bg-brand-500/10 border-brand-500/20',
        blue: 'bg-accent-cyan/10 border-accent-cyan/20',
    };

    const trendColors = {
        up: 'text-green-400',
        down: 'text-red-400',
        neutral: 'text-slate-400',
    };

    return (
        <div className={`rounded-xl border border-slate-700/50 ${colorClasses[color]} p-4`}>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{title}</p>
            <p className={`text-2xl font-bold ${trend ? trendColors[trend] : 'text-white'}`}>
                {value}
            </p>
            {subtitle && (
                <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
            )}
        </div>
    );
}

// Position row component
function PositionRow({ position, onClose }: { position: Position; onClose: (id: string) => void }) {
    const pnl = position.unrealizedPnL || 0;
    const pnlPercent = position.unrealizedPnLPercent || 0;
    const isProfitable = pnl >= 0;

    return (
        <tr className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
            <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${position.platform === 'polymarket' ? 'bg-brand-500' : 'bg-accent-cyan'}`} />
                    <span className="text-xs text-slate-500 uppercase">{position.platform}</span>
                </div>
            </td>
            <td className="py-3 px-4">
                <p className="text-white font-medium line-clamp-1">{position.marketTitle}</p>
                <p className="text-xs text-slate-500">{position.side.toUpperCase()}</p>
            </td>
            <td className="py-3 px-4 text-right">
                <p className="text-white">{position.quantity}</p>
            </td>
            <td className="py-3 px-4 text-right">
                <p className="text-white">${position.entryPrice.toFixed(2)}</p>
            </td>
            <td className="py-3 px-4 text-right">
                <p className="text-white">${(position.currentPrice || position.entryPrice).toFixed(2)}</p>
            </td>
            <td className="py-3 px-4 text-right">
                <p className={isProfitable ? 'text-green-400' : 'text-red-400'}>
                    {isProfitable ? '+' : ''}{pnl.toFixed(2)}
                </p>
                <p className={`text-xs ${isProfitable ? 'text-green-400/70' : 'text-red-400/70'}`}>
                    {isProfitable ? '+' : ''}{pnlPercent.toFixed(2)}%
                </p>
            </td>
            <td className="py-3 px-4 text-right">
                {position.status === 'open' && (
                    <button
                        onClick={() => onClose(position.id)}
                        className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                    >
                        Close
                    </button>
                )}
                {position.status === 'closed' && (
                    <span className="text-xs text-slate-500">Closed</span>
                )}
            </td>
        </tr>
    );
}

// Trade row component
function TradeRow({ trade }: { trade: Trade }) {
    const isBuy = trade.type === 'buy';

    return (
        <tr className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
            <td className="py-3 px-4">
                <p className="text-xs text-slate-500">
                    {new Date(trade.timestamp).toLocaleDateString()}
                </p>
                <p className="text-xs text-slate-600">
                    {new Date(trade.timestamp).toLocaleTimeString()}
                </p>
            </td>
            <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${trade.platform === 'polymarket' ? 'bg-brand-500' : 'bg-accent-cyan'}`} />
                    <span className="text-white font-medium line-clamp-1">{trade.marketTitle}</span>
                </div>
            </td>
            <td className="py-3 px-4">
                <span className={`px-2 py-0.5 text-xs rounded ${isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {trade.type.toUpperCase()}
                </span>
            </td>
            <td className="py-3 px-4 text-right text-white">
                {trade.quantity} @ ${trade.price.toFixed(2)}
            </td>
            <td className="py-3 px-4 text-right">
                <p className={isBuy ? 'text-red-400' : 'text-green-400'}>
                    {isBuy ? '-' : '+'}${trade.total.toFixed(2)}
                </p>
            </td>
            <td className="py-3 px-4 text-right">
                <span className={`text-xs ${trade.status === 'completed' ? 'text-green-400' : trade.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {trade.status}
                </span>
            </td>
        </tr>
    );
}

// Empty state component
function EmptyState({ title, description }: { title: string; description: string }) {
    return (
        <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto">{description}</p>
        </div>
    );
}

export default function PortfolioPage() {
    const {
        positions,
        trades,
        arbitrageTrades,
        stats,
        isLoading,
        closePosition,
        clearPortfolio
    } = usePortfolio();

    const [activeTab, setActiveTab] = useState<'positions' | 'trades' | 'arbitrage'>('positions');
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const { snapshot, isConnected: streamConnected } = useMarketStream();

    const handleClosePosition = (id: string) => {
        // For demo, close at current price (in real app, this would execute a trade)
        const position = positions.find(p => p.id === id);
        if (position) {
            closePosition(id, position.currentPrice || position.entryPrice);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading portfolio...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen terminal-bg py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white text-gradient-brand">Portfolio</h1>
                        <p className="text-slate-400 mt-1">Track your positions and trading performance</p>
                    </div>

                    <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
                        <span className={`chip ${streamConnected ? 'chip-active' : ''}`}>
                            Stream {streamConnected ? 'Connected' : 'Offline'}
                        </span>
                        {snapshot?.updatedAt && (
                            <span className="chip">Last snapshot {new Date(snapshot.updatedAt).toLocaleTimeString()}</span>
                        )}
                    </div>

                    {positions.length > 0 && (
                        <div className="flex items-center gap-3">
                            {showClearConfirm ? (
                                <>
                                    <span className="text-sm text-slate-400">Clear all data?</span>
                                    <button
                                        onClick={() => { clearPortfolio(); setShowClearConfirm(false); }}
                                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition-colors"
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        onClick={() => setShowClearConfirm(false)}
                                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setShowClearConfirm(true)}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm transition-colors"
                                >
                                    Clear Portfolio
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                    <StatCard
                        title="Total Value"
                        value={`$${stats.totalValue.toFixed(2)}`}
                        color="default"
                    />
                    <StatCard
                        title="Total P&L"
                        value={`${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)}`}
                        subtitle={`${stats.totalPnLPercent >= 0 ? '+' : ''}${stats.totalPnLPercent.toFixed(2)}%`}
                        trend={stats.totalPnL > 0 ? 'up' : stats.totalPnL < 0 ? 'down' : 'neutral'}
                        color={stats.totalPnL >= 0 ? 'green' : 'red'}
                    />
                    <StatCard
                        title="Today"
                        value={`${stats.todayPnL >= 0 ? '+' : ''}$${stats.todayPnL.toFixed(2)}`}
                        trend={stats.todayPnL > 0 ? 'up' : stats.todayPnL < 0 ? 'down' : 'neutral'}
                    />
                    <StatCard
                        title="Open Positions"
                        value={stats.openPositions.toString()}
                        subtitle={`${stats.closedPositions} closed`}
                    />
                    <StatCard
                        title="Win Rate"
                        value={`${stats.winRate.toFixed(1)}%`}
                        subtitle={`${stats.winningTrades}W / ${stats.losingTrades}L`}
                        color={stats.winRate >= 50 ? 'green' : 'red'}
                    />
                    <StatCard
                        title="Total Trades"
                        value={stats.totalTrades.toString()}
                    />
                </div>

                {/* Platform breakdown */}
                {stats.openPositions > 0 && (
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-3 h-3 rounded-full bg-brand-500" />
                                <span className="text-brand-300 font-medium">Polymarket</span>
                            </div>
                            <p className="text-2xl font-bold text-white">${stats.polymarketValue.toFixed(2)}</p>
                            <p className="text-sm text-slate-400">{stats.polymarketPositions} positions</p>
                        </div>
                        <div className="rounded-xl border border-accent-cyan/20 bg-accent-cyan/5 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-3 h-3 rounded-full bg-accent-cyan" />
                                <span className="text-accent-cyan font-medium">Kalshi</span>
                            </div>
                            <p className="text-2xl font-bold text-white">${stats.kalshiValue.toFixed(2)}</p>
                            <p className="text-sm text-slate-400">{stats.kalshiPositions} positions</p>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-lg p-1 w-fit glass">
                    {(['positions', 'trades', 'arbitrage'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab
                                    ? 'bg-gradient-to-r from-brand-500 to-accent-cyan text-white shadow-glow-sm'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            {tab === 'positions' && positions.length > 0 && (
                                <span className="ml-2 px-1.5 py-0.5 text-xs bg-white/20 rounded">
                                    {positions.filter(p => p.status === 'open').length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="bg-slate-900/50 rounded-xl border border-slate-800/50 overflow-hidden">
                    {activeTab === 'positions' && (
                        positions.length === 0 ? (
                            <EmptyState
                                title="No positions yet"
                                description="Your open and closed positions will appear here once you start trading. Execute an arbitrage trade to get started."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-800">
                                            <th className="text-left py-3 px-4 text-xs text-slate-500 font-medium uppercase">Platform</th>
                                            <th className="text-left py-3 px-4 text-xs text-slate-500 font-medium uppercase">Market</th>
                                            <th className="text-right py-3 px-4 text-xs text-slate-500 font-medium uppercase">Qty</th>
                                            <th className="text-right py-3 px-4 text-xs text-slate-500 font-medium uppercase">Entry</th>
                                            <th className="text-right py-3 px-4 text-xs text-slate-500 font-medium uppercase">Current</th>
                                            <th className="text-right py-3 px-4 text-xs text-slate-500 font-medium uppercase">P&L</th>
                                            <th className="text-right py-3 px-4 text-xs text-slate-500 font-medium uppercase">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {positions.map(position => (
                                            <PositionRow
                                                key={position.id}
                                                position={position}
                                                onClose={handleClosePosition}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}

                    {activeTab === 'trades' && (
                        trades.length === 0 ? (
                            <EmptyState
                                title="No trades yet"
                                description="Your trade history will appear here. Each buy and sell transaction will be recorded."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-800">
                                            <th className="text-left py-3 px-4 text-xs text-slate-500 font-medium uppercase">Date</th>
                                            <th className="text-left py-3 px-4 text-xs text-slate-500 font-medium uppercase">Market</th>
                                            <th className="text-left py-3 px-4 text-xs text-slate-500 font-medium uppercase">Type</th>
                                            <th className="text-right py-3 px-4 text-xs text-slate-500 font-medium uppercase">Details</th>
                                            <th className="text-right py-3 px-4 text-xs text-slate-500 font-medium uppercase">Total</th>
                                            <th className="text-right py-3 px-4 text-xs text-slate-500 font-medium uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trades.slice().reverse().map(trade => (
                                            <TradeRow key={trade.id} trade={trade} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}

                    {activeTab === 'arbitrage' && (
                        arbitrageTrades.length === 0 ? (
                            <EmptyState
                                title="No arbitrage trades yet"
                                description="When you execute arbitrage trades between Polymarket and Kalshi, they'll be tracked here with detailed P&L analysis."
                            />
                        ) : (
                            <div className="p-4 space-y-4">
                                {arbitrageTrades.slice().reverse().map(arb => (
                                    <div key={arb.id} className="bg-slate-800/50 rounded-lg p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h4 className="font-medium text-white">{arb.matchedQuestion}</h4>
                                                <p className="text-xs text-slate-500">
                                                    {new Date(arb.timestamp).toLocaleString()} • {Math.round(arb.similarity * 100)}% match
                                                </p>
                                                {arb.trustSnapshot?.legs?.length ? (
                                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                                        {arb.trustSnapshot.legs.map((leg) => (
                                                            <div key={`${arb.id}-${leg.platform}`} className="flex items-center gap-1">
                                                                <span className={leg.platform === 'polymarket' ? 'text-brand-300' : 'text-accent-cyan'}>
                                                                    {leg.platform === 'polymarket' ? 'Poly' : 'Kalshi'}
                                                                </span>
                                                                <TrustBadge score={leg.trustScore} compact />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold ${arb.actualProfit !== undefined ? (arb.actualProfit >= 0 ? 'text-green-400' : 'text-red-400') : 'text-yellow-400'}`}>
                                                    {arb.actualProfit !== undefined
                                                        ? `${arb.actualProfit >= 0 ? '+' : ''}$${arb.actualProfit.toFixed(2)}`
                                                        : `Est. +$${arb.expectedProfit.toFixed(2)}`
                                                    }
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {arb.status}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-brand-500" />
                                                <span className="text-slate-400">Polymarket:</span>
                                                <span className="text-white">${arb.polymarketTrade.total.toFixed(2)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-accent-cyan" />
                                                <span className="text-slate-400">Kalshi:</span>
                                                <span className="text-white">${arb.kalshiTrade.total.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
