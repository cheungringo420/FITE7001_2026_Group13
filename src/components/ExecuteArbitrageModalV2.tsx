'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { usePortfolio } from '@/contexts/PortfolioContext';

interface ExecuteArbitrageModalProps {
    opportunity: ArbitrageOpportunity;
    isOpen: boolean;
    onClose: () => void;
}

// Step indicator component
function StepIndicator({
    step,
    currentStep,
    label,
    status
}: {
    step: number;
    currentStep: number;
    label: string;
    status?: 'pending' | 'active' | 'completed' | 'failed';
}) {
    const getStepClass = () => {
        if (status === 'completed') return 'bg-green-500 border-green-500';
        if (status === 'failed') return 'bg-red-500 border-red-500';
        if (status === 'active') return 'bg-purple-500 border-purple-500 animate-pulse';
        if (step < currentStep) return 'bg-slate-600 border-slate-600';
        return 'bg-slate-800 border-slate-600';
    };

    return (
        <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${getStepClass()}`}>
                {status === 'completed' ? (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                ) : status === 'failed' ? (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <span className="text-sm font-medium text-white">{step}</span>
                )}
            </div>
            <span className="text-xs text-slate-400 mt-1 text-center max-w-16">{label}</span>
        </div>
    );
}

// Slippage warning component
function SlippageWarning({ slippage }: { slippage: number }) {
    if (slippage < 1) return null;

    const severity = slippage < 2 ? 'low' : slippage < 5 ? 'medium' : 'high';
    const colors = {
        low: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
        medium: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
        high: 'bg-red-500/10 border-red-500/30 text-red-400',
    };
    const icons = {
        low: '⚠️',
        medium: '⚠️',
        high: '🚨',
    };

    return (
        <div className={`rounded-lg p-3 border ${colors[severity]} text-sm`}>
            <div className="flex items-start gap-2">
                <span>{icons[severity]}</span>
                <div>
                    <span className="font-medium">Slippage Warning</span>
                    <p className="text-xs opacity-80 mt-0.5">
                        {severity === 'high'
                            ? `High slippage of ${slippage.toFixed(2)}% may significantly impact your profit. Consider reducing order size.`
                            : `Expected slippage: ${slippage.toFixed(2)}%. Actual execution price may vary.`
                        }
                    </p>
                </div>
            </div>
        </div>
    );
}

// Success animation component
function SuccessAnimation({ profit }: { profit: number }) {
    return (
        <div className="text-center py-6">
            <div className="relative inline-block">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                    <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                    <span className="text-white text-xs font-bold">✓</span>
                </div>
            </div>
            <h3 className="text-xl font-bold text-white mt-4">Trade Executed!</h3>
            <p className="text-green-400 text-lg font-mono mt-1">
                +${profit.toFixed(4)} estimated profit
            </p>
            <p className="text-slate-400 text-sm mt-2">
                Your positions have been added to your portfolio
            </p>
        </div>
    );
}

// Failure animation component
function FailureAnimation({ message }: { message: string }) {
    return (
        <div className="text-center py-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </div>
            <h3 className="text-xl font-bold text-white mt-4">Execution Failed</h3>
            <p className="text-red-400 text-sm mt-2 max-w-xs mx-auto">{message}</p>
        </div>
    );
}

export function ExecuteArbitrageModalV2({
    opportunity,
    isOpen,
    onClose
}: ExecuteArbitrageModalProps) {
    const { address, isConnected } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { addPosition, addTrade, addArbitrageTrade } = usePortfolio();

    const [amount, setAmount] = useState<string>('100');
    const [slippageTolerance, setSlippageTolerance] = useState<number>(1);
    const [progress, setProgress] = useState<ExecutionProgress | null>(null);
    const [result, setResult] = useState<ExecutionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [polyCredentials, setPolyCredentials] = useState<PolymarketCredentials | null>(null);
    const [kalshiCredentials, setKalshiCredentials] = useState<KalshiCredentials | null>(null);
    const [kalshiApiKey, setKalshiApiKey] = useState('');
    const [kalshiPrivateKey, setKalshiPrivateKey] = useState('');
    const [currentStep, setCurrentStep] = useState(0);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Calculate estimated slippage based on order size and liquidity
    const contracts = Math.floor(parseFloat(amount || '0') / opportunity.totalCost);
    const estimatedProfit = contracts * opportunity.guaranteedProfit;
    const estimatedSlippage = Math.min(contracts * 0.05, 5); // Rough estimate

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setProgress(null);
            setResult(null);
            setError(null);
            setCurrentStep(0);
        }
    }, [isOpen]);

    // Update step based on progress
    useEffect(() => {
        if (progress) {
            if (progress.status === 'placing-orders') setCurrentStep(2);
            else if (progress.status === 'confirming') setCurrentStep(3);
            else if (progress.status === 'completed') setCurrentStep(4);
        }
    }, [progress]);

    if (!isOpen) return null;

    const handleDerivePolymarketKey = async () => {
        if (!address) return;

        try {
            setError(null);
            setCurrentStep(1);
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
            setCurrentStep(1);
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
            setCurrentStep(2);

            const executionResult = await executeArbitrage(
                opportunity,
                credentials,
                parseFloat(amount),
                setProgress
            );

            setResult(executionResult);
            setCurrentStep(executionResult.success ? 4 : -1);

            // Add to portfolio if successful
            if (executionResult.success) {
                const now = Date.now();

                // Add trades for each leg
                for (const order of executionResult.orders) {
                    addTrade({
                        platform: order.platform as 'polymarket' | 'kalshi',
                        marketId: order.platform === 'polymarket' ? opportunity.platform1.marketId : opportunity.platform2.marketId,
                        marketTitle: opportunity.question,
                        type: 'buy',
                        side: order.side as 'yes' | 'no',
                        price: order.averagePrice || 0.5,
                        quantity: order.filledAmount || contracts,
                        total: (order.averagePrice || 0.5) * (order.filledAmount || contracts),
                        timestamp: now,
                        executedAt: new Date(),
                        orderId: order.orderId,
                        status: order.status === 'filled' ? 'completed' : 'failed',
                    });

                    // Add positions
                    addPosition({
                        platform: order.platform as 'polymarket' | 'kalshi',
                        marketId: order.platform === 'polymarket' ? opportunity.platform1.marketId : opportunity.platform2.marketId,
                        marketTitle: opportunity.question,
                        side: order.side as 'yes' | 'no',
                        entryPrice: order.averagePrice || 0.5,
                        quantity: order.filledAmount || contracts,
                        entryTimestamp: now,
                        costBasis: (order.averagePrice || 0.5) * (order.filledAmount || contracts),
                        status: 'open',
                    });
                }

                // Add arbitrage trade record
                addArbitrageTrade({
                    timestamp: now,
                    matchedQuestion: opportunity.question,
                    similarity: opportunity.similarity || 0.9,
                    polymarketTrade: {
                        id: `poly-${now}`,
                        platform: 'polymarket',
                        marketId: opportunity.platform1.marketId,
                        marketTitle: opportunity.question,
                        type: 'buy',
                        side: 'yes',
                        price: opportunity.platform1.yesPrice,
                        quantity: contracts,
                        total: opportunity.platform1.yesPrice * contracts,
                        timestamp: now,
                        executedAt: new Date(),
                        status: 'completed',
                    },
                    kalshiTrade: {
                        id: `kalshi-${now}`,
                        platform: 'kalshi',
                        marketId: opportunity.platform2.marketId,
                        marketTitle: opportunity.question,
                        type: 'buy',
                        side: 'yes',
                        price: opportunity.platform2.yesPrice,
                        quantity: contracts,
                        total: opportunity.platform2.yesPrice * contracts,
                        timestamp: now,
                        executedAt: new Date(),
                        status: 'completed',
                    },
                    totalCost: executionResult.totalCost,
                    expectedProfit: executionResult.estimatedProfit,
                    expectedProfitPercent: opportunity.profitPercentage,
                    status: 'executed',
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Execution failed');
            setCurrentStep(-1);
        }
    };

    const hasPolymarket = opportunity.platform1.name === 'polymarket' || opportunity.platform2.name === 'polymarket';
    const hasKalshi = opportunity.platform1.name === 'kalshi' || opportunity.platform2.name === 'kalshi';
    const credentialsReady = (!hasPolymarket || polyCredentials) && (!hasKalshi || kalshiCredentials);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-slate-900/95 rounded-2xl border border-slate-700/50 p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white">Execute Arbitrage</h2>
                        <p className="text-sm text-slate-400 mt-0.5">
                            {opportunity.profitPercentage.toFixed(2)}% guaranteed profit
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Step Progress */}
                {!result && (
                    <div className="flex items-center justify-between mb-6 px-4">
                        <StepIndicator step={1} currentStep={currentStep} label="Connect" status={credentialsReady ? 'completed' : currentStep >= 1 ? 'active' : 'pending'} />
                        <div className="flex-1 h-0.5 bg-slate-700 mx-2" />
                        <StepIndicator step={2} currentStep={currentStep} label="Configure" status={currentStep > 2 ? 'completed' : currentStep === 2 ? 'active' : 'pending'} />
                        <div className="flex-1 h-0.5 bg-slate-700 mx-2" />
                        <StepIndicator step={3} currentStep={currentStep} label="Execute" status={currentStep > 3 ? 'completed' : currentStep === 3 ? 'active' : 'pending'} />
                        <div className="flex-1 h-0.5 bg-slate-700 mx-2" />
                        <StepIndicator step={4} currentStep={currentStep} label="Done" status={currentStep === 4 ? 'completed' : 'pending'} />
                    </div>
                )}

                {/* Success/Failure Animation */}
                {result && (
                    result.success ? (
                        <SuccessAnimation profit={result.estimatedProfit} />
                    ) : (
                        <FailureAnimation message={result.orders.find(o => o.status === 'failed')?.error || 'Unknown error'} />
                    )
                )}

                {/* Main Content */}
                {!result && (
                    <>
                        {/* Opportunity Summary Card */}
                        <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 rounded-xl p-4 mb-4 border border-slate-700/30">
                            <div className="text-sm text-slate-400 mb-1">Market</div>
                            <div className="text-white font-medium mb-3 line-clamp-2">{opportunity.question}</div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                                    <span className="text-slate-400">Polymarket:</span>
                                    <span className="text-white font-mono">{(opportunity.platform1.yesPrice * 100).toFixed(1)}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="text-slate-400">Kalshi:</span>
                                    <span className="text-white font-mono">{(opportunity.platform2.yesPrice * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Slippage Warning */}
                        <div className="mb-4">
                            <SlippageWarning slippage={estimatedSlippage} />
                        </div>

                        {/* Wallet Status */}
                        {!isConnected && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Please connect your wallet to execute trades
                                </div>
                            </div>
                        )}

                        {/* Credentials Section */}
                        {isConnected && !progress && (
                            <div className="space-y-3 mb-4">
                                {hasPolymarket && (
                                    <div className={`rounded-xl p-3 border transition-colors ${polyCredentials ? 'bg-green-500/5 border-green-500/30' : 'bg-slate-800/30 border-slate-700/30'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full bg-purple-500" />
                                                <span className="text-sm font-medium text-white">Polymarket</span>
                                            </div>
                                            {polyCredentials ? (
                                                <span className="flex items-center gap-1 text-xs text-green-400">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Connected
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={handleDerivePolymarketKey}
                                                    className="text-xs px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
                                                >
                                                    Sign to Connect
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {hasKalshi && (
                                    <div className={`rounded-xl p-3 border transition-colors ${kalshiCredentials ? 'bg-green-500/5 border-green-500/30' : 'bg-slate-800/30 border-slate-700/30'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full bg-blue-500" />
                                                <span className="text-sm font-medium text-white">Kalshi</span>
                                            </div>
                                            {kalshiCredentials && (
                                                <span className="flex items-center gap-1 text-xs text-green-400">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Configured
                                                </span>
                                            )}
                                        </div>
                                        {!kalshiCredentials && (
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    placeholder="API Key ID"
                                                    value={kalshiApiKey}
                                                    onChange={(e) => setKalshiApiKey(e.target.value)}
                                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                                                />
                                                <input
                                                    type="password"
                                                    placeholder="Private Key"
                                                    value={kalshiPrivateKey}
                                                    onChange={(e) => setKalshiPrivateKey(e.target.value)}
                                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                                                />
                                                <button
                                                    onClick={handleSaveKalshiCredentials}
                                                    disabled={!kalshiApiKey || !kalshiPrivateKey}
                                                    className="w-full text-xs px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    Save Credentials
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Amount Input */}
                        {!progress && (
                            <div className="mb-4">
                                <label className="text-sm text-slate-400 mb-2 block">Investment Amount (USDC)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        min="1"
                                        step="1"
                                        className="w-full pl-8 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-lg font-mono focus:border-purple-500 focus:outline-none"
                                    />
                                </div>
                                <div className="flex justify-between text-sm mt-2">
                                    <span className="text-slate-500">Contracts: {contracts}</span>
                                    <span className="text-green-400">Est. Profit: ${estimatedProfit.toFixed(4)}</span>
                                </div>

                                {/* Quick amount buttons */}
                                <div className="flex gap-2 mt-2">
                                    {[50, 100, 250, 500, 1000].map((val) => (
                                        <button
                                            key={val}
                                            onClick={() => setAmount(val.toString())}
                                            className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${amount === val.toString()
                                                ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                }`}
                                        >
                                            ${val}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Advanced Settings */}
                        {!progress && (
                            <div className="mb-4">
                                <button
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                                >
                                    <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    Advanced Settings
                                </button>

                                {showAdvanced && (
                                    <div className="mt-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
                                        <label className="text-xs text-slate-400 mb-1 block">Slippage Tolerance</label>
                                        <div className="flex gap-2">
                                            {[0.5, 1, 2.5, 5].map((val) => (
                                                <button
                                                    key={val}
                                                    onClick={() => setSlippageTolerance(val)}
                                                    className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${slippageTolerance === val
                                                        ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
                                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                        }`}
                                                >
                                                    {val}%
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Progress */}
                        {progress && (
                            <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="relative w-6 h-6">
                                        <svg className="animate-spin w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                    <span className="text-white font-medium">{progress.message}</span>
                                </div>
                                <div className="space-y-2">
                                    {progress.orders.map((order, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm bg-slate-900/50 rounded-lg p-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${order.platform === 'polymarket' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                                                <span className="text-slate-400">{order.platform}</span>
                                            </div>
                                            <span className={
                                                order.status === 'filled' ? 'text-green-400' :
                                                    order.status === 'failed' ? 'text-red-400' :
                                                        'text-yellow-400'
                                            }>
                                                {order.status === 'filled' && '✓ '}
                                                {order.status === 'failed' && '✗ '}
                                                {order.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                        <div className="flex items-start gap-2 text-red-400 text-sm">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium"
                    >
                        {result ? 'Close' : 'Cancel'}
                    </button>
                    {!result && (
                        <button
                            onClick={handleExecute}
                            disabled={!isConnected || !credentialsReady || progress !== null}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-slate-600 disabled:to-slate-600"
                        >
                            {progress ? 'Executing...' : 'Execute Trade'}
                        </button>
                    )}
                    {result && result.success && (
                        <a
                            href="/portfolio"
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all text-center"
                        >
                            View Portfolio
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
