'use client';

import React from 'react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';

interface VolumeChartProps {
    data: Array<{
        time: string;
        volume: number;
        platform?: 'polymarket' | 'kalshi' | 'both';
        polymarketVolume?: number;
        kalshiVolume?: number;
    }>;
    height?: number;
    showComparison?: boolean;
    className?: string;
}

export function VolumeChart({
    data,
    height = 200,
    showComparison = false,
    className = '',
}: VolumeChartProps) {
    const formatVolume = (value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
        return `$${value.toFixed(0)}`;
    };

    if (showComparison) {
        return (
            <div className={`bg-slate-800/30 rounded-xl p-4 ${className}`}>
                <ResponsiveContainer width="100%" height={height}>
                    <BarChart data={data} barGap={0}>
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
                            tickFormatter={formatVolume}
                            axisLine={{ stroke: 'rgba(51, 65, 85, 0.5)' }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid rgba(51, 65, 85, 0.5)',
                                borderRadius: '8px',
                            }}
                            labelStyle={{ color: '#94a3b8' }}
                            formatter={(value) => {
                                if (value === undefined) return ['-', ''];
                                const v = value as number;
                                const name = 'polymarketVolume';
                                return [
                                    formatVolume(v),
                                    name === 'polymarketVolume' ? 'Polymarket' : 'Kalshi'
                                ];
                            }}
                        />
                        <Bar
                            dataKey="polymarketVolume"
                            fill="#a855f7"
                            radius={[4, 4, 0, 0]}
                            name="Polymarket"
                        />
                        <Bar
                            dataKey="kalshiVolume"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                            name="Kalshi"
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    }

    return (
        <div className={`bg-slate-800/30 rounded-xl p-4 ${className}`}>
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={data}>
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
                        tickFormatter={formatVolume}
                        axisLine={{ stroke: 'rgba(51, 65, 85, 0.5)' }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(51, 65, 85, 0.5)',
                            borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#94a3b8' }}
                        formatter={(value) => {
                            if (value === undefined) return ['-', 'Volume'];
                            return [formatVolume(value as number), 'Volume'];
                        }}
                    />
                    <Bar
                        dataKey="volume"
                        fill="url(#volumeGradient)"
                        radius={[4, 4, 0, 0]}
                    />
                    <defs>
                        <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        </linearGradient>
                    </defs>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// Spread chart showing bid-ask spread over time
interface SpreadChartProps {
    data: Array<{
        time: string;
        spread: number;
        bestBid?: number;
        bestAsk?: number;
    }>;
    height?: number;
    className?: string;
}

export function SpreadChart({
    data,
    height = 150,
    className = '',
}: SpreadChartProps) {
    return (
        <div className={`bg-slate-800/30 rounded-xl p-4 ${className}`}>
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.3)" />
                    <XAxis
                        dataKey="time"
                        stroke="#64748b"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                    />
                    <YAxis
                        stroke="#64748b"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(51, 65, 85, 0.5)',
                            borderRadius: '8px',
                        }}
                        formatter={(value) => {
                            if (value === undefined) return ['-', 'Spread'];
                            return [`${((value as number) * 100).toFixed(2)}%`, 'Spread'];
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="spread"
                        stroke="#f59e0b"
                        fill="url(#spreadGradient)"
                        strokeWidth={2}
                    />
                    <defs>
                        <linearGradient id="spreadGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
