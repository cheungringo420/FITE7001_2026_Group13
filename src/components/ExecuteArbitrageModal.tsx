'use client';

import { useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ArbitrageOpportunity } from '@/lib/kalshi/types';
import {
    ExecutionProgress,
    ExecutionResult,
    ExecutionCredentials,
    executeArbitrage
} from '@/lib/arbitrage/execution';
import { deriveApiCredentials, PolymarketCredentials } from '@/lib/polymarket/trading';
import { KalshiCredentials } from '@/lib/kalshi/trading';
import { TrustBadge } from './TrustBadge';

interface ExecuteArbitrageModalProps {
    opportunity: ArbitrageOpportunity;
    isOpen: boolean;
    onClose: () => void;
}

export function ExecuteArbitrageModal({
    opportunity,
    isOpen,
    onClose
}: ExecuteArbitrageModalProps) {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();

    const [amount, setAmount] = useState<string>('100');
    const [progress, setProgress] = useState<ExecutionProgress | null>(null);
    const [result, setResult] = useState<ExecutionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [polyCredentials, setPolyCredentials] = useState<PolymarketCredentials | null>(null);
    const [kalshiCredentials, setKalshiCredentials] = useState<KalshiCredentials | null>(null);
    const [kalshiApiKey, setKalshiApiKey] = useState('');
    const [kalshiPrivateKey, setKalshiPrivateKey] = useState('');
    const [trustLegs, setTrustLegs] = useState<Array<{
        platform: 'polymarket' | 'kalshi';
        marketId: string;
        trustScore: number;
        disputeRisk: number;
        resolutionConfidence: number;
    }>>([]);

    useEffect(() => {
        let active = true;

        const fetchTrust = async () => {
            try {
                const [res1, res2] = await Promise.all([
                    fetch(`/api/trust/market?platform=${opportunity.platform1.name}&id=${opportunity.platform1.marketId}`),
                    fetch(`/api/trust/market?platform=${opportunity.platform2.name}&id=${opportunity.platform2.marketId}`),
                ]);

                const legs: Array<{
                    platform: 'polymarket' | 'kalshi';
                    marketId: string;
                    trustScore: number;
                    disputeRisk: number;
                    resolutionConfidence: number;
                }> = [];

                const pushLeg = (
                    platform: 'polymarket' | 'kalshi',
                    marketId: string,
                    analysis?: { trustScore: number; disputeRisk: number; resolutionConfidence: number }
                ) => {
                    if (!analysis) return;
                    legs.push({
                        platform,
                        marketId,
                        trustScore: analysis.trustScore,
                        disputeRisk: analysis.disputeRisk,
                        resolutionConfidence: analysis.resolutionConfidence,
                    });
                };

                if (res1.ok) {
                    const data = await res1.json();
                    pushLeg(opportunity.platform1.name, opportunity.platform1.marketId, data.analysis);
                }
                if (res2.ok) {
                    const data = await res2.json();
                    pushLeg(opportunity.platform2.name, opportunity.platform2.marketId, data.analysis);
                }

                if (active) {
                    const unique = new Map<string, typeof legs[number]>();
                    legs.forEach((leg) => unique.set(`${leg.platform}:${leg.marketId}`, leg));
                    setTrustLegs(Array.from(unique.values()));
                }
            } catch {
                if (active) setTrustLegs([]);
            }
        };

        fetchTrust();
        return () => {
            active = false;
        };
    }, [opportunity]);

    if (!isOpen) return null;

    const contracts = Math.floor(parseFloat(amount || '0') / opportunity.totalCost);
    const estimatedProfit = contracts * opportunity.guaranteedProfit;

    const handleDerivePolymarketKey = async () => {
        if (!address) return;

        try {
            setError(null);
            const signFn = async (message: string) => {
                return await signMessageAsync({ message });
            };
            const creds = await deriveApiCredentials(address, signFn);
            setPolyCredentials(creds);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to derive API key');
        }
    };

    const handleSaveKalshiCredentials = () => {
        if (kalshiApiKey && kalshiPrivateKey) {
            setKalshiCredentials({
                apiKeyId: kalshiApiKey,
                privateKey: kalshiPrivateKey,
            });
        }
    };

    const handleExecute = async () => {
        if (!isConnected) {
            setError('Please connect your wallet first');
            return;
        }

        const credentials: ExecutionCredentials = {};

        if (opportunity.platform1.name === 'polymarket' || opportunity.platform2.name === 'polymarket') {
            if (!polyCredentials) {
                setError('Please derive Polymarket API credentials first');
                return;
            }
            credentials.polymarket = polyCredentials;
        }

        if (opportunity.platform1.name === 'kalshi' || opportunity.platform2.name === 'kalshi') {
            if (!kalshiCredentials) {
                setError('Please enter Kalshi API credentials first');
                return;
            }
            credentials.kalshi = kalshiCredentials;
        }

        try {
            setError(null);
            setResult(null);

            const executionResult = await executeArbitrage(
                opportunity,
                credentials,
                parseFloat(amount),
                setProgress
            );

            setResult(executionResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Execution failed');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-900 rounded-2xl border border-slate-700 p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Execute Arbitrage</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Opportunity Summary */}
                <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
                    <div className="text-sm text-slate-400 mb-2">Market</div>
                    <div className="text-white font-medium mb-3">{opportunity.question}</div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Expected Profit</span>
                        <span className="text-green-400 font-semibold">+{opportunity.profitPercentage.toFixed(2)}%</span>
                    </div>
                    {trustLegs.length > 0 && (
                        <div className="mt-4 space-y-2 text-xs text-slate-400">
                            <div className="text-slate-500 uppercase tracking-wide">Trust Snapshot</div>
                            <div className="grid grid-cols-1 gap-2">
                                {trustLegs.map((leg) => (
                                    <div key={`${leg.platform}-${leg.marketId}`} className="flex items-center justify-between">
                                        <span className={leg.platform === 'polymarket' ? 'text-brand-300' : 'text-accent-cyan'}>
                                            {leg.platform === 'polymarket' ? 'Polymarket' : 'Kalshi'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <TrustBadge score={leg.trustScore} compact />
                                            <span className="text-slate-500">Dispute {leg.disputeRisk}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Wallet Status */}
                {!isConnected && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
                        <div className="text-yellow-400 text-sm">
                            ⚠️ Please connect your wallet to execute trades
                        </div>
                    </div>
                )}

                {/* Credentials Section */}
                {isConnected && (
                    <div className="space-y-4 mb-6">
                        {/* Polymarket Credentials */}
                        {(opportunity.platform1.name === 'polymarket' || opportunity.platform2.name === 'polymarket') && (
                            <div className="bg-slate-800/30 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-brand-300">Polymarket</span>
                                    {polyCredentials ? (
                                        <span className="text-xs text-green-400">✓ Connected</span>
                                    ) : (
                                        <button
                                            onClick={handleDerivePolymarketKey}
                                            className="text-xs px-3 py-1 bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 rounded-lg transition-colors"
                                        >
                                            Sign to Connect
                                        </button>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500">
                                    Signs a message to derive your Polymarket API credentials
                                </p>
                            </div>
                        )}

                        {/* Kalshi Credentials */}
                        {(opportunity.platform1.name === 'kalshi' || opportunity.platform2.name === 'kalshi') && (
                            <div className="bg-slate-800/30 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-medium text-accent-cyan">Kalshi</span>
                                    {kalshiCredentials ? (
                                        <span className="text-xs text-green-400">✓ Configured</span>
                                    ) : null}
                                </div>
                                {!kalshiCredentials ? (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            placeholder="API Key ID"
                                            value={kalshiApiKey}
                                            onChange={(e) => setKalshiApiKey(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500"
                                        />
                                        <input
                                            type="password"
                                            placeholder="Private Key"
                                            value={kalshiPrivateKey}
                                            onChange={(e) => setKalshiPrivateKey(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500"
                                        />
                                        <button
                                            onClick={handleSaveKalshiCredentials}
                                            disabled={!kalshiApiKey || !kalshiPrivateKey}
                                            className="w-full text-xs px-3 py-2 bg-accent-cyan/20 hover:bg-accent-cyan/30 text-accent-cyan rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            Save Credentials
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500">
                                        API credentials configured from Kalshi dashboard
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Amount Input */}
                <div className="mb-6">
                    <label className="text-sm text-slate-400 mb-2 block">Investment Amount (USDC)</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min="1"
                        step="1"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-lg font-mono focus:border-brand-500 focus:outline-none"
                    />
                    <div className="flex justify-between text-sm mt-2">
                        <span className="text-slate-500">Contracts: {contracts}</span>
                        <span className="text-green-400">Est. Profit: ${estimatedProfit.toFixed(4)}</span>
                    </div>
                </div>

                {/* Progress */}
                {progress && !result && (
                    <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
                        <div className="flex items-center gap-3 mb-3">
                            <svg className="animate-spin w-5 h-5 text-brand-300" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-white font-medium">{progress.message}</span>
                        </div>
                        <div className="space-y-2">
                            {progress.orders.map((order, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400">{order.platform}</span>
                                    <span className={
                                        order.status === 'filled' ? 'text-green-400' :
                                            order.status === 'failed' ? 'text-red-400' :
                                                'text-yellow-400'
                                    }>
                                        {order.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Result */}
                {result && (
                    <div className={`rounded-xl p-4 mb-6 ${result.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
                        }`}>
                        <div className="flex items-center gap-2 mb-3">
                            {result.success ? (
                                <span className="text-green-400 text-lg">✓ Executed Successfully</span>
                            ) : (
                                <span className="text-red-400 text-lg">✗ Execution Failed</span>
                            )}
                        </div>
                        <div className="space-y-2 text-sm">
                            {result.orders.map((order, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-slate-400">
                                        {order.platform.toUpperCase()} ({order.side.toUpperCase()})
                                    </span>
                                    <span className={order.status === 'filled' ? 'text-green-400' : 'text-red-400'}>
                                        {order.status} {order.filledAmount && `(${order.filledAmount} contracts)`}
                                    </span>
                                </div>
                            ))}
                            {result.success && (
                                <div className="pt-2 mt-2 border-t border-slate-700">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Total Cost</span>
                                        <span className="text-white font-mono">${result.totalCost.toFixed(4)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Estimated Profit</span>
                                        <span className="text-green-400 font-mono">${result.estimatedProfit.toFixed(4)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
                    >
                        {result ? 'Close' : 'Cancel'}
                    </button>
                    {!result && (
                        <button
                            onClick={handleExecute}
                            disabled={!isConnected || progress !== null}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Execute Trade
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
