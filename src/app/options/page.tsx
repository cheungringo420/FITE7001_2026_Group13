'use client';

// Cross-Asset Mispricing Detection — Polymarket × Deribit BTC options.
// This page implements the Comparative Framework described in the report
// (Section "Comparative Framework between Polymarket Probabilities and Options
// Implied Volatility"). The earlier SPY/QQQ Market-Comparisons demo, the
// Black-Scholes calculator, and the standalone options-chain table have all
// been retired — the live BTC × Deribit pipeline is the canonical surface for
// the cross-asset thesis.

import { CrossAssetBtcPanel } from '@/components/CrossAssetBtcPanel';

export default function OptionsPage() {
    return (
        <div className="min-h-screen terminal-bg py-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <span className="text-xl">⚡</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white text-gradient-brand">Cross-Asset Mispricing</h1>
                            <p className="text-slate-400 text-sm">
                                Polymarket binaries replicated on Deribit BTC options via tight call spreads (Breeden–Litzenberger digital approximation).
                            </p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
                        For each BTC threshold market on Polymarket, the engine matches the listed Deribit expiry,
                        replicates the binary using the tightest call spread straddling the strike, and emits a
                        structured 3-leg trade ticket whenever the disagreement exceeds the 5% no-arbitrage band.
                        Quality gates filter out short-dated gamma plays and wing-distortion artifacts.
                    </p>
                </div>

                <CrossAssetBtcPanel />
            </div>
        </div>
    );
}
