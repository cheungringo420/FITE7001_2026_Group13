'use client';

import { useState, useMemo } from 'react';
import { calculatePayout } from '@/lib/polymarket/client';

interface TradingPanelProps {
    yesPrice: number;
    noPrice: number;
    marketQuestion: string;
    outcomes?: string[];
    disabled?: boolean;
}

type Side = 'yes' | 'no';

export function TradingPanel({
    yesPrice,
    noPrice,
    marketQuestion,
    outcomes = ['Yes', 'No'],
    disabled = false
}: TradingPanelProps) {
    const [selectedSide, setSelectedSide] = useState<Side>('yes');
    const [amount, setAmount] = useState<string>('10');

    const amountNum = parseFloat(amount) || 0;
    const price = selectedSide === 'yes' ? yesPrice : noPrice;

    const { shares, potentialPayout } = useMemo(() => {
        if (amountNum <= 0 || price <= 0) return { shares: 0, potentialPayout: 0 };
        return calculatePayout(amountNum, price);
    }, [amountNum, price]);

    const potentialProfit = potentialPayout - amountNum;
    const returnPercentage = amountNum > 0 ? (potentialProfit / amountNum) * 100 : 0;

    const quickAmounts = [5, 10, 25, 50, 100];

    return (
        <div className="trading-panel bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-4">Trade</h3>

            {/* Yes/No Toggle */}
            <div className="grid grid-cols-2 gap-2 mb-6">
                <button
                    onClick={() => setSelectedSide('yes')}
                    disabled={disabled}
                    className={`
            relative py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200
            ${selectedSide === 'yes'
                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
                >
                    <div className="text-sm opacity-80 mb-1">{outcomes[0]}</div>
                    <div className="text-2xl font-bold">{(yesPrice * 100).toFixed(1)}¢</div>
                    {selectedSide === 'yes' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-green-900" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                            </svg>
                        </div>
                    )}
                </button>

                <button
                    onClick={() => setSelectedSide('no')}
                    disabled={disabled}
                    className={`
            relative py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200
            ${selectedSide === 'no'
                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
                >
                    <div className="text-sm opacity-80 mb-1">{outcomes[1]}</div>
                    <div className="text-2xl font-bold">{(noPrice * 100).toFixed(1)}¢</div>
                    {selectedSide === 'no' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-red-900" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                            </svg>
                        </div>
                    )}
                </button>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-2">Amount (USDC)</label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">$</span>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={disabled}
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl py-3 pl-10 pr-4 text-white text-lg font-semibold focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                        placeholder="0.00"
                        min="0"
                        step="1"
                    />
                </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex gap-2 mb-6">
                {quickAmounts.map((quickAmount) => (
                    <button
                        key={quickAmount}
                        onClick={() => setAmount(quickAmount.toString())}
                        disabled={disabled}
                        className="flex-1 py-2 px-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors disabled:opacity-50"
                    >
                        ${quickAmount}
                    </button>
                ))}
            </div>

            {/* Payout Info */}
            <div className="bg-slate-800/50 rounded-xl p-4 mb-6 space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Shares</span>
                    <span className="text-slate-200 font-mono">{shares.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Avg Price</span>
                    <span className="text-slate-200 font-mono">{(price * 100).toFixed(1)}¢</span>
                </div>
                <div className="border-t border-slate-700 pt-3 flex justify-between">
                    <span className="text-slate-400">Potential Return</span>
                    <div className="text-right">
                        <span className={`font-bold ${potentialProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${potentialPayout.toFixed(2)}
                        </span>
                        <span className="text-green-400 text-sm ml-2">
                            (+{returnPercentage.toFixed(0)}%)
                        </span>
                    </div>
                </div>
            </div>

            {/* Trade Button */}
            <button
                disabled={disabled || amountNum <= 0}
                className={`
          w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200
          ${selectedSide === 'yes'
                        ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg shadow-green-500/25'
                        : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25'}
          disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
        `}
            >
                {disabled ? 'Connect Wallet to Trade' : `Buy ${selectedSide === 'yes' ? outcomes[0] : outcomes[1]}`}
            </button>

            {/* Disclaimer */}
            <p className="text-xs text-slate-500 text-center mt-4">
                Trading is currently view-only. Connect a wallet to place orders.
            </p>
        </div>
    );
}
