'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    BotConfig,
    BotState,
    BotEvent,
    BotStrategy,
    STRATEGY_PRESETS,
    DEFAULT_BOT_CONFIG,
    INITIAL_BOT_STATE,
} from '@/lib/bot/types';
import { ArbitrageBot, initializeBot } from '@/lib/bot/engine';
import { ProbabilityBar } from '@/components/charts';
import { useMarketStream } from '@/hooks/useMarketStream';

export default function BotDashboard() {
    const [config, setConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
    const [state, setState] = useState<BotState>(INITIAL_BOT_STATE);
    const [events, setEvents] = useState<BotEvent[]>([]);
    const botRef = useRef<ArbitrageBot | null>(null);
    const initialConfigRef = useRef(DEFAULT_BOT_CONFIG);
    const { snapshot, isConnected: streamConnected } = useMarketStream();

    // Initialize bot
    useEffect(() => {
        const bot = initializeBot(initialConfigRef.current, {}, '');
        botRef.current = bot;

        const unsubState = bot.onStateChange((newState) => {
            setState(newState);
        });

        const unsubEvent = bot.onEvent((event) => {
            setEvents(prev => [event, ...prev].slice(0, 50));
        });

        return () => {
            unsubState();
            unsubEvent();
            bot.stop();
        };
    }, []);

    // Update config
    const handleConfigChange = useCallback(<K extends keyof BotConfig>(
        key: K,
        value: BotConfig[K]
    ) => {
        setConfig(prev => {
            const newConfig = { ...prev, [key]: value };
            botRef.current?.updateConfig({ [key]: value });
            return newConfig;
        });
    }, []);

    // Apply strategy preset
    const handleStrategyChange = useCallback((strategy: BotStrategy) => {
        const preset = STRATEGY_PRESETS[strategy];
        setConfig(prev => ({
            ...prev,
            ...preset,
            strategy,
        }));
        botRef.current?.updateConfig({ strategy });
    }, []);

    // Bot controls
    const handleStart = useCallback(() => {
        botRef.current?.start();
    }, []);

    const handleStop = useCallback(() => {
        botRef.current?.stop();
    }, []);

    const handlePause = useCallback(() => {
        if (state.status === 'paused') {
            botRef.current?.resume();
        } else {
            botRef.current?.pause();
        }
    }, [state.status]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running':
            case 'scanning':
                return 'bg-green-500';
            case 'executing':
                return 'bg-accent-cyan animate-pulse';
            case 'paused':
                return 'bg-yellow-500';
            case 'error':
                return 'bg-red-500';
            default:
                return 'bg-slate-500';
        }
    };

    const getEventIcon = (type: BotEvent['type']) => {
        switch (type) {
            case 'started':
            case 'trade_executed':
                return '✓';
            case 'stopped':
                return '⏹';
            case 'opportunity_found':
                return '🎯';
            case 'trade_pending':
                return '⏳';
            case 'trade_failed':
            case 'error':
                return '✗';
            case 'warning':
                return '⚠';
            default:
                return '•';
        }
    };

    const getEventColor = (type: BotEvent['type']) => {
        switch (type) {
            case 'trade_executed':
            case 'started':
                return 'text-green-400';
            case 'opportunity_found':
                return 'text-brand-300';
            case 'trade_pending':
                return 'text-accent-cyan';
            case 'error':
            case 'trade_failed':
                return 'text-red-400';
            case 'warning':
                return 'text-yellow-400';
            default:
                return 'text-slate-400';
        }
    };

    return (
        <div className="min-h-screen terminal-bg py-8 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white text-gradient-brand flex items-center gap-3">
                            <span className="text-2xl">🤖</span>
                            Arbitrage Bot
                        </h1>
                        <p className="text-slate-400 mt-1">
                            Automated arbitrage detection and execution
                        </p>
                    </div>

                    <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
                        <span className={`chip ${streamConnected ? 'chip-active' : ''}`}>
                            Stream {streamConnected ? 'Connected' : 'Offline'}
                        </span>
                        {snapshot?.updatedAt && (
                            <span className="chip">Last snapshot {new Date(snapshot.updatedAt).toLocaleTimeString()}</span>
                        )}
                    </div>

                    {/* Control Buttons */}
                    <div className="flex items-center gap-3">
                        {state.status === 'stopped' ? (
                            <button
                                onClick={handleStart}
                                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                                Start Bot
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handlePause}
                                    className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-medium rounded-lg transition-all flex items-center gap-2"
                                >
                                    {state.status === 'paused' ? (
                                        <>
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                            </svg>
                                            Resume
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            Pause
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleStop}
                                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-all flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                                    </svg>
                                    Stop
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    {/* Status */}
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 glass">
                        <div className="text-sm text-slate-400 mb-2">Status</div>
                        <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${getStatusColor(state.status)}`}></span>
                            <span className="text-xl font-bold text-white capitalize">
                                {state.status}
                            </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 truncate">
                            {state.statusMessage}
                        </div>
                    </div>

                    {/* Today's P&L */}
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 glass">
                        <div className="text-sm text-slate-400 mb-2">Today&apos;s P&L</div>
                        <div className={`text-2xl font-bold ${state.profitToday >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {state.profitToday >= 0 ? '+' : ''}${state.profitToday.toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            {state.tradesCount} trades executed
                        </div>
                    </div>

                    {/* Active Positions */}
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 glass">
                        <div className="text-sm text-slate-400 mb-2">Active Positions</div>
                        <div className="text-2xl font-bold text-white">{state.activePositions.length}</div>
                        <div className="text-xs text-slate-500 mt-1">
                            Opportunities: {state.recentOpportunities.length}
                        </div>
                    </div>

                    {/* Daily Limit */}
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 glass">
                        <div className="text-sm text-slate-400 mb-2">Daily Trades</div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-white">
                                {state.tradesCount}
                            </span>
                            <span className="text-slate-500">/ {config.maxDailyTrades}</span>
                        </div>
                        <ProbabilityBar
                            value={state.tradesCount / config.maxDailyTrades}
                            showPercentage={false}
                            height={4}
                            className="mt-2"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Configuration Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 glass">
                            <h2 className="text-lg font-semibold text-white mb-4">Configuration</h2>

                            {/* Strategy Selector */}
                            <div className="mb-4">
                                <label className="block text-sm text-slate-400 mb-2">Strategy</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['conservative', 'balanced', 'aggressive'] as BotStrategy[]).map(strategy => (
                                        <button
                                            key={strategy}
                                            onClick={() => handleStrategyChange(strategy)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all capitalize ${config.strategy === strategy
                                                    ? strategy === 'conservative'
                                                        ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/50'
                                                        : strategy === 'balanced'
                                                            ? 'bg-brand-500/20 text-brand-300 border border-brand-500/50'
                                                            : 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                                                    : 'bg-slate-700/50 text-slate-400 border border-slate-600/50 hover:border-slate-500'
                                                }`}
                                        >
                                            {strategy}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Min Profit */}
                            <div className="mb-4">
                                <label className="block text-sm text-slate-400 mb-2">
                                    Min Profit: <span className="text-white font-medium">{config.minProfitPercent}%</span>
                                </label>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="5"
                                    step="0.1"
                                    value={config.minProfitPercent}
                                    onChange={(e) => handleConfigChange('minProfitPercent', parseFloat(e.target.value))}
                                    className="w-full accent-brand-500"
                                />
                            </div>

                            {/* Max Position Size */}
                            <div className="mb-4">
                                <label className="block text-sm text-slate-400 mb-2">
                                    Max Trade Size
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                    <input
                                        type="number"
                                        min="10"
                                        max="10000"
                                        value={config.maxPositionSize}
                                        onChange={(e) => handleConfigChange('maxPositionSize', parseInt(e.target.value))}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-2 pl-8 pr-4 text-white"
                                    />
                                </div>
                            </div>

                            {/* Execution Mode */}
                            <div className="mb-4">
                                <label className="block text-sm text-slate-400 mb-2">Execution Mode</label>
                                <select
                                    value={config.executionMode}
                                    onChange={(e) => handleConfigChange('executionMode', e.target.value as BotConfig['executionMode'])}
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-2 px-3 text-white"
                                >
                                    <option value="manual">Manual (notify only)</option>
                                    <option value="semi-auto">Semi-Auto (confirm trades)</option>
                                    <option value="auto">Auto (execute immediately)</option>
                                </select>
                            </div>

                            {/* Platform Toggles */}
                            <div className="mb-4">
                                <label className="block text-sm text-slate-400 mb-2">Platforms</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            const platforms = config.platforms.includes('polymarket')
                                                ? config.platforms.filter(p => p !== 'polymarket')
                                                : [...config.platforms, 'polymarket'] as ('polymarket' | 'kalshi')[];
                                            handleConfigChange('platforms', platforms);
                                        }}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${config.platforms.includes('polymarket')
                                                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/50'
                                                : 'bg-slate-700/50 text-slate-500 border border-slate-600/50'
                                            }`}
                                    >
                                        Polymarket
                                    </button>
                                    <button
                                        onClick={() => {
                                            const platforms = config.platforms.includes('kalshi')
                                                ? config.platforms.filter(p => p !== 'kalshi')
                                                : [...config.platforms, 'kalshi'] as ('polymarket' | 'kalshi')[];
                                            handleConfigChange('platforms', platforms);
                                        }}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${config.platforms.includes('kalshi')
                                                ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/50'
                                                : 'bg-slate-700/50 text-slate-500 border border-slate-600/50'
                                            }`}
                                    >
                                        Kalshi
                                    </button>
                                </div>
                            </div>

                            {/* Daily Limits */}
                            <div className="pt-4 border-t border-slate-700/50">
                                <h3 className="text-sm font-medium text-slate-300 mb-3">Safety Limits</h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-slate-500">Max Trades/Day</span>
                                        <div className="text-white font-medium">{config.maxDailyTrades}</div>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Max Daily Loss</span>
                                        <div className="text-white font-medium">${config.maxDailyLoss}</div>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Max Exposure</span>
                                        <div className="text-white font-medium">${config.maxTotalExposure}</div>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Cooldown</span>
                                        <div className="text-white font-medium">{config.cooldownPeriod}s</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Activity Feed */}
                    <div className="lg:col-span-2">
                        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 glass">
                            <div className="px-6 py-4 border-b border-slate-700/50">
                                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                    📊 Live Activity
                                    {(state.status === 'running' || state.status === 'scanning') && (
                                        <span className="relative flex h-2 w-2 ml-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                    )}
                                </h2>
                            </div>

                            <div className="divide-y divide-slate-700/30 max-h-[500px] overflow-y-auto">
                                {events.length === 0 ? (
                                    <div className="px-6 py-12 text-center text-slate-500">
                                        <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                        <p>No activity yet</p>
                                        <p className="text-sm mt-1">Start the bot to begin scanning</p>
                                    </div>
                                ) : (
                                    events.map((event, idx) => (
                                        <div key={idx} className="px-6 py-3 flex items-start gap-3 hover:bg-slate-700/20 transition-colors">
                                            <span className={`text-lg ${getEventColor(event.type)}`}>
                                                {getEventIcon(event.type)}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm ${getEventColor(event.type)}`}>
                                                    {event.message}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {new Date(event.timestamp).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Recent Opportunities */}
                        {state.recentOpportunities.length > 0 && (
                            <div className="mt-6 bg-slate-800/50 rounded-xl border border-slate-700/50 glass">
                                <div className="px-6 py-4 border-b border-slate-700/50">
                                    <h2 className="text-lg font-semibold text-white">
                                        🎯 Current Opportunities
                                    </h2>
                                </div>
                                <div className="divide-y divide-slate-700/30">
                                    {state.recentOpportunities.slice(0, 5).map((opp, idx) => (
                                        <div key={idx} className="px-6 py-4 flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-medium truncate">
                                                    {opp.polymarket?.question || opp.kalshi?.question}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {opp.type} • Similarity: {(opp.similarity * 100).toFixed(0)}%
                                                </p>
                                            </div>
                                            <div className="text-right ml-4">
                                                <div className="text-green-400 font-bold">
                                                    +{opp.profitPercent.toFixed(2)}%
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    Cost: {(opp.totalCost * 100).toFixed(1)}¢
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Warning Banner */}
                <div className="mt-8 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h3 className="text-yellow-400 font-medium">Trading involves risk</h3>
                        <p className="text-sm text-slate-400 mt-1">
                            Auto-trading is currently in <strong>demo mode</strong>. No actual trades will be executed.
                            To enable live trading, connect your wallet and configure API credentials.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
