'use client';

import React, { memo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';

interface PriceChartProps {
    data: Array<{ time: number | string; value: number }>;
    height?: number;
    color?: string;
    showVolume?: boolean;
    volumeData?: Array<{ time: number | string; value: number; color?: string }>;
    className?: string;
    platform?: 'polymarket' | 'kalshi';
}

function PriceChartComponent({
    data,
    height = 300,
    color,
    className = '',
    platform = 'polymarket',
}: PriceChartProps) {
    const platformColor = platform === 'polymarket' ? '#a855f7' : '#3b82f6';
    const lineColor = color || platformColor;

    const formatTime = (time: number | string) => {
        if (typeof time === 'string') return time;
        const date = new Date(time * 1000);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const formatPrice = (value: number) => `${(value * 100).toFixed(1)}¢`;

    return (
        <div className={`bg-slate-800/30 rounded-xl p-4 ${className}`}>
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id={`priceGradient-${platform}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={lineColor} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={lineColor} stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.3)" />
                    <XAxis
                        dataKey="time"
                        stroke="#64748b"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickFormatter={formatTime}
                        axisLine={{ stroke: 'rgba(51, 65, 85, 0.5)' }}
                    />
                    <YAxis
                        stroke="#64748b"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickFormatter={formatPrice}
                        domain={['auto', 'auto']}
                        axisLine={{ stroke: 'rgba(51, 65, 85, 0.5)' }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(51, 65, 85, 0.5)',
                            borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#94a3b8' }}
                        labelFormatter={(label) => {
                            if (label === undefined || label === null) return '';
                            return formatTime(label as string | number);
                        }}
                        formatter={(value) => {
                            if (value === undefined) return ['-', 'Price'];
                            return [formatPrice(value as number), 'Price'];
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={lineColor}
                        fill={`url(#priceGradient-${platform})`}
                        strokeWidth={2}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export const PriceChart = memo(PriceChartComponent);

// Mini sparkline version for cards
interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
    className?: string;
}

export function Sparkline({
    data,
    width = 100,
    height = 30,
    color = '#8b5cf6',
    className = '',
}: SparklineProps) {
    if (data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    const isUp = data[data.length - 1] >= data[0];
    const lineColor = color || (isUp ? '#22c55e' : '#ef4444');

    return (
        <svg
            width={width}
            height={height}
            className={className}
            viewBox={`0 0 ${width} ${height}`}
        >
            <defs>
                <linearGradient id={`sparkline-gradient-${lineColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* Area fill */}
            <polygon
                points={`0,${height} ${points} ${width},${height}`}
                fill={`url(#sparkline-gradient-${lineColor.replace('#', '')})`}
            />
            {/* Line */}
            <polyline
                points={points}
                fill="none"
                stroke={lineColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
