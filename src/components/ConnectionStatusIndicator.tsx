'use client';

import React from 'react';
import { useWebSocketStatus } from '@/contexts/PriceContext';

type Status = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

function StatusDot({ status, label }: { status: Status; label: string }) {
    const getColor = () => {
        switch (status) {
            case 'connected':
                return 'bg-green-500';
            case 'connecting':
            case 'reconnecting':
                return 'bg-yellow-500 animate-pulse';
            case 'error':
                return 'bg-red-500';
            default:
                return 'bg-slate-500';
        }
    };

    return (
        <div className="flex items-center gap-1" title={`${label}: ${status}`}>
            <span className={`w-2 h-2 rounded-full ${getColor()}`} />
            <span className="text-xs text-slate-400">{label}</span>
        </div>
    );
}

export function ConnectionStatusIndicator() {
    const { polymarket, kalshi, connect, disconnect, isFullyConnected, hasAnyConnection } = useWebSocketStatus();

    const isDemo = !hasAnyConnection && polymarket === 'disconnected' && kalshi === 'disconnected';

    return (
        <div className="flex items-center gap-3 p-1">
            {/* Connection dots */}
            <div className="flex items-center gap-2">
                <StatusDot status={polymarket} label="Poly" />
                <StatusDot status={kalshi} label="Kalshi" />
            </div>

            {/* Live / Partial / Demo pill — passive status, no CTA */}
            {isFullyConnected ? (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded-full">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-xs text-green-400 font-medium">LIVE</span>
                </div>
            ) : hasAnyConnection ? (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    <span className="text-xs text-yellow-400 font-medium">PARTIAL</span>
                </div>
            ) : (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-700/30 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="text-xs text-slate-400 font-medium">DEMO</span>
                </div>
            )}

            {/* Demo Mode toggle — for offline presentations / rate-limit safety */}
            <button
                onClick={isDemo ? connect : disconnect}
                className="px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500
                           hover:text-slate-300 border border-slate-700/50 hover:border-slate-600
                           rounded transition-colors"
                title={isDemo ? 'Resume live feeds' : 'Switch to demo mode (freeze prices)'}
                style={{ fontFamily: 'var(--font-jetbrains-mono)' }}
            >
                {isDemo ? 'Resume' : 'Demo'}
            </button>
        </div>
    );
}

// Compact version for mobile
export function ConnectionStatusCompact() {
    const { isFullyConnected, hasAnyConnection } = useWebSocketStatus();

    if (isFullyConnected) {
        return (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded-full">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs text-green-400">LIVE</span>
            </div>
        );
    }

    if (hasAnyConnection) {
        return (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 rounded-full">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-xs text-yellow-400">PARTIAL</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-700/30 rounded-full">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-xs text-slate-400">DEMO</span>
        </div>
    );
}
