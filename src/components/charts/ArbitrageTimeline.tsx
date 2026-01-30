'use client';

import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    ReferenceLine,
} from 'recharts';

interface ArbitrageEvent {
    time: string;
    timestamp: number;
    profit: number;  // Profit percentage
    duration?: number;  // Duration in minutes
    captured?: boolean;  // Whether the opportunity was captured
    platforms: string;
    market: string;
}

interface ArbitrageTimelineProps {
    data: ArbitrageEvent[];
    height?: number;
    className?: string;
}

export function ArbitrageTimeline({
    data,
    height = 200,
    className = '',
}: ArbitrageTimelineProps) {
    const maxProfit = Math.max(...data.map(d => d.profit), 5);

    return (
        <div className={`bg-slate-800/30 rounded-xl p-4 ${className}`}>
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.3)" />
                    <XAxis
                        dataKey="time"
                        stroke="#64748b"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={{ stroke: 'rgba(51, 65, 85, 0.5)' }}
                    />
                    <YAxis
                        stroke="#64748b"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickFormatter={(v) => `${v.toFixed(1)}%`}
                        domain={[0, maxProfit]}
                        axisLine={{ stroke: 'rgba(51, 65, 85, 0.5)' }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(51, 65, 85, 0.5)',
                            borderRadius: '8px',
                            padding: '12px',
                        }}
                        content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            const data = payload[0].payload as ArbitrageEvent;
                            return (
                                <div className="text-sm">
                                    <div className="text-white font-medium mb-1">{data.market}</div>
                                    <div className="text-green-400 font-bold text-lg">
                                        +{data.profit.toFixed(2)}% profit
                                    </div>
                                    <div className="text-slate-400 text-xs mt-1">
                                        {data.platforms}
                                    </div>
                                    {data.duration && (
                                        <div className="text-slate-500 text-xs">
                                            Duration: {data.duration} min
                                        </div>
                                    )}
                                    {data.captured !== undefined && (
                                        <div className={`text-xs mt-1 ${data.captured ? 'text-green-400' : 'text-slate-500'}`}>
                                            {data.captured ? '✓ Captured' : 'Missed'}
                                        </div>
                                    )}
                                </div>
                            );
                        }}
                    />
                    <ReferenceLine
                        y={1}
                        stroke="rgba(34, 197, 94, 0.3)"
                        strokeDasharray="3 3"
                        label={{ value: '1% threshold', fill: '#22c55e', fontSize: 10 }}
                    />
                    <Area
                        type="stepAfter"
                        dataKey="profit"
                        stroke="#22c55e"
                        fill="url(#arbGradient)"
                        strokeWidth={2}
                    />
                    <defs>
                        <linearGradient id="arbGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// Simple timeline dots view
interface TimelineDotProps {
    events: ArbitrageEvent[];
    className?: string;
}

export function ArbitrageTimelineDots({ events, className = '' }: TimelineDotProps) {
    if (events.length === 0) {
        return (
            <div className={`text-center py-8 text-slate-500 ${className}`}>
                No arbitrage opportunities detected yet
            </div>
        );
    }

    return (
        <div className={`space-y-3 ${className}`}>
            {events.slice(0, 10).map((event, idx) => (
                <div
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-green-500/30 transition-colors"
                >
                    {/* Time dot */}
                    <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${event.captured ? 'bg-green-500' : 'bg-slate-500'
                            }`} />
                        {idx < events.length - 1 && (
                            <div className="w-px h-6 bg-slate-700" />
                        )}
                    </div>

                    {/* Event info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-white font-medium truncate">{event.market}</span>
                            <span className="text-green-400 font-bold">+{event.profit.toFixed(1)}%</span>
                        </div>
                        <div className="text-xs text-slate-500">
                            {event.time} • {event.platforms}
                        </div>
                    </div>

                    {/* Status */}
                    <div className={`px-2 py-1 rounded text-xs font-medium ${event.captured
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-slate-600/20 text-slate-400'
                        }`}>
                        {event.captured ? 'Captured' : 'Missed'}
                    </div>
                </div>
            ))}
        </div>
    );
}
