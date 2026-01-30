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
    const { polymarket, kalshi, connect, isFullyConnected, hasAnyConnection } = useWebSocketStatus();

    return (
        <div className="flex items-center gap-3">
            {/* Connection dots */}
            <div className="flex items-center gap-2">
                <StatusDot status={polymarket} label="Poly" />
                <StatusDot status={kalshi} label="Kalshi" />
            </div>

            {/* Connect button if not connected */}
            {!hasAnyConnection && (
                <button
                    onClick={connect}
                    className="px-2 py-1 text-xs bg-purple-500/20 hover:bg-purple-500/30 
                             text-purple-400 rounded transition-colors flex items-center gap-1"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Go Live
                </button>
            )}

            {/* Live indicator if connected */}
            {isFullyConnected && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 rounded-full">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-xs text-green-400 font-medium">LIVE</span>
                </div>
            )}
        </div>
    );
}

// Compact version for mobile
export function ConnectionStatusCompact() {
    const { isFullyConnected, hasAnyConnection, connect } = useWebSocketStatus();

    if (isFullyConnected) {
        return (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 rounded-full">
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
        <button
            onClick={connect}
            className="flex items-center gap-1 px-2 py-0.5 bg-slate-700 hover:bg-slate-600 
                     text-slate-400 rounded-full text-xs transition-colors"
        >
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            OFFLINE
        </button>
    );
}
