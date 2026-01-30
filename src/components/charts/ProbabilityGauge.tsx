'use client';

import React, { useMemo } from 'react';

interface ProbabilityGaugeProps {
    value: number;  // 0-1
    size?: number;
    showLabel?: boolean;
    label?: string;
    color?: string;
    animated?: boolean;
    className?: string;
}

export function ProbabilityGauge({
    value,
    size = 120,
    showLabel = true,
    label,
    color,
    animated = true,
    className = '',
}: ProbabilityGaugeProps) {
    const percentage = Math.max(0, Math.min(100, value * 100));

    // Determine color based on probability
    const gaugeColor = color || (
        percentage >= 70 ? '#22c55e' :
            percentage >= 50 ? '#eab308' :
                percentage >= 30 ? '#f97316' :
                    '#ef4444'
    );

    const { circumference, dashOffset, radius, center, strokeWidth } = useMemo(() => {
        const sw = size * 0.08;
        const r = (size - sw) / 2 - 2;
        const c = r * 2 * Math.PI * 0.75; // 270 degrees (3/4 circle)
        const offset = c - (percentage / 100) * c;
        return {
            circumference: c,
            dashOffset: offset,
            radius: r,
            center: size / 2,
            strokeWidth: sw,
        };
    }, [size, percentage]);

    return (
        <div className={`relative inline-flex flex-col items-center ${className}`}>
            <svg
                width={size}
                height={size * 0.75}
                viewBox={`0 0 ${size} ${size * 0.85}`}
                className="overflow-visible"
            >
                {/* Background arc */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="rgba(51, 65, 85, 0.3)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${circumference} ${circumference * 0.33}`}
                    transform={`rotate(135 ${center} ${center})`}
                />

                {/* Foreground arc (progress) */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={gaugeColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${circumference} ${circumference * 0.33}`}
                    strokeDashoffset={dashOffset}
                    transform={`rotate(135 ${center} ${center})`}
                    className={animated ? 'transition-all duration-700 ease-out' : ''}
                    style={{
                        filter: `drop-shadow(0 0 6px ${gaugeColor}40)`,
                    }}
                />

                {/* Glow effect */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={gaugeColor}
                    strokeWidth={strokeWidth * 2}
                    strokeLinecap="round"
                    strokeDasharray={`${circumference} ${circumference * 0.33}`}
                    strokeDashoffset={dashOffset}
                    transform={`rotate(135 ${center} ${center})`}
                    opacity={0.15}
                    className={animated ? 'transition-all duration-700 ease-out' : ''}
                />

                {/* Tick marks */}
                {[0, 25, 50, 75, 100].map((tick) => {
                    const angle = (135 + (tick / 100) * 270) * (Math.PI / 180);
                    const innerR = radius - strokeWidth / 2 - 6;
                    const outerR = radius - strokeWidth / 2 - 2;
                    const x1 = center + innerR * Math.cos(angle);
                    const y1 = center + innerR * Math.sin(angle);
                    const x2 = center + outerR * Math.cos(angle);
                    const y2 = center + outerR * Math.sin(angle);

                    return (
                        <line
                            key={tick}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="rgba(148, 163, 184, 0.5)"
                            strokeWidth={1}
                        />
                    );
                })}
            </svg>

            {/* Center value */}
            <div
                className="absolute flex flex-col items-center justify-center"
                style={{
                    top: size * 0.25,
                    width: size * 0.6,
                }}
            >
                <span
                    className="text-2xl font-bold text-white"
                    style={{
                        fontSize: size * 0.22,
                        textShadow: `0 0 20px ${gaugeColor}40`,
                    }}
                >
                    {percentage.toFixed(1)}%
                </span>
                {showLabel && label && (
                    <span
                        className="text-slate-400 mt-1"
                        style={{ fontSize: size * 0.09 }}
                    >
                        {label}
                    </span>
                )}
            </div>
        </div>
    );
}

// Dual gauge for comparing Yes/No
interface DualGaugeProps {
    yesValue: number;
    noValue: number;
    size?: number;
    className?: string;
}

export function DualProbabilityGauge({
    yesValue,
    noValue,
    size = 100,
    className = '',
}: DualGaugeProps) {
    return (
        <div className={`flex items-center gap-4 ${className}`}>
            <div className="flex flex-col items-center">
                <ProbabilityGauge
                    value={yesValue}
                    size={size}
                    color="#22c55e"
                    showLabel={true}
                    label="Yes"
                />
            </div>
            <div className="flex flex-col items-center">
                <ProbabilityGauge
                    value={noValue}
                    size={size}
                    color="#ef4444"
                    showLabel={true}
                    label="No"
                />
            </div>
        </div>
    );
}

// Simple linear progress bar variant
interface ProbabilityBarProps {
    value: number;
    showPercentage?: boolean;
    height?: number;
    className?: string;
}

export function ProbabilityBar({
    value,
    showPercentage = true,
    height = 8,
    className = '',
}: ProbabilityBarProps) {
    const percentage = Math.max(0, Math.min(100, value * 100));

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div
                className="flex-1 bg-slate-700/50 rounded-full overflow-hidden"
                style={{ height }}
            >
                <div className="flex h-full">
                    {/* Yes portion */}
                    <div
                        className="bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                    />
                    {/* No portion */}
                    <div
                        className="bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500"
                        style={{ width: `${100 - percentage}%` }}
                    />
                </div>
            </div>
            {showPercentage && (
                <div className="flex items-center gap-2 text-sm font-medium min-w-[100px]">
                    <span className="text-green-400">{percentage.toFixed(0)}%</span>
                    <span className="text-slate-500">/</span>
                    <span className="text-red-400">{(100 - percentage).toFixed(0)}%</span>
                </div>
            )}
        </div>
    );
}
