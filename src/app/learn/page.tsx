'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Section {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
}

function ProbabilityDemo() {
  const [prob, setProb] = useState(65);
  const price = prob / 100;
  const payout = 1.0;
  const expectedReturn = ((payout / price) - 1) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-400 w-24">Probability:</span>
        <input
          type="range"
          min={5}
          max={95}
          value={prob}
          onChange={e => setProb(parseInt(e.target.value))}
          className="flex-1 accent-brand-500"
        />
        <span className="text-lg font-mono font-bold text-brand-300 w-16 text-right">{prob}%</span>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 rounded-lg bg-slate-800/30">
          <div className="text-xs text-slate-400">YES Price</div>
          <div className="text-lg font-mono text-green-400">{price.toFixed(2)}¢</div>
        </div>
        <div className="p-3 rounded-lg bg-slate-800/30">
          <div className="text-xs text-slate-400">NO Price</div>
          <div className="text-lg font-mono text-red-400">{(1 - price).toFixed(2)}¢</div>
        </div>
        <div className="p-3 rounded-lg bg-slate-800/30">
          <div className="text-xs text-slate-400">If Correct</div>
          <div className={`text-lg font-mono ${expectedReturn > 0 ? 'text-green-400' : 'text-red-400'}`}>
            +{expectedReturn.toFixed(0)}%
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Buy YES at {price.toFixed(2)}¢. If the event happens, receive $1.00. If not, lose your stake.
        The price IS the market&apos;s probability estimate.
      </p>
    </div>
  );
}

function ArbitrageDemo() {
  const [polyYes, setPolyYes] = useState(62);
  const [kalshiNo, setKalshiNo] = useState(42);
  const totalCost = polyYes + kalshiNo;
  const profit = 100 - totalCost;
  const costs = 2.5; // 250bps
  const netProfit = profit - costs;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded bg-brand-500/50" />
            <span className="text-sm text-slate-300">Polymarket YES</span>
          </div>
          <input
            type="range"
            min={30}
            max={80}
            value={polyYes}
            onChange={e => setPolyYes(parseInt(e.target.value))}
            className="w-full accent-brand-500"
          />
          <span className="text-lg font-mono text-brand-300">{polyYes}¢</span>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded bg-accent-cyan/50" />
            <span className="text-sm text-slate-300">Kalshi NO</span>
          </div>
          <input
            type="range"
            min={20}
            max={60}
            value={kalshiNo}
            onChange={e => setKalshiNo(parseInt(e.target.value))}
            className="w-full accent-cyan-500"
          />
          <span className="text-lg font-mono text-accent-cyan">{kalshiNo}¢</span>
        </div>
      </div>
      <div className="p-4 rounded-lg bg-slate-800/30">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-slate-400">Total Cost</div>
            <div className="text-lg font-mono text-white">{totalCost}¢</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Gross Profit</div>
            <div className={`text-lg font-mono ${profit > 0 ? 'text-green-400' : 'text-red-400'}`}>{profit}¢</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Net (after costs)</div>
            <div className={`text-lg font-mono font-bold ${netProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>{netProfit.toFixed(1)}¢</div>
          </div>
        </div>
        <div className="mt-3 text-center">
          {profit > 0 ? (
            <div className="text-sm text-green-400">
              {netProfit > 0 ? `Arbitrage opportunity! Guaranteed ${netProfit.toFixed(1)}¢ profit per $1 regardless of outcome.` : `Gross profit exists but costs (${costs}¢) eliminate the edge.`}
            </div>
          ) : (
            <div className="text-sm text-slate-400">No arbitrage — combined price exceeds $1.00.</div>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Buy YES on Polymarket + NO on Kalshi for the same event. If YES+NO &lt; $1, you profit regardless of outcome.
        This is how cross-platform arbitrage works.
      </p>
    </div>
  );
}

function TrustScoreDemo() {
  const [volumeScore, setVolumeScore] = useState(75);
  const [resolutionScore, setResolutionScore] = useState(80);
  const [liquidityScore, setLiquidityScore] = useState(60);

  const weights = { volume: 0.3, resolution: 0.4, liquidity: 0.3 };
  const trustScore = volumeScore * weights.volume + resolutionScore * weights.resolution + liquidityScore * weights.liquidity;

  const level = trustScore >= 80 ? { label: 'High Trust', color: 'text-green-400' }
    : trustScore >= 60 ? { label: 'Medium Trust', color: 'text-yellow-400' }
    : { label: 'Low Trust', color: 'text-red-400' };

  return (
    <div className="space-y-4">
      {[
        { label: 'Volume Score', value: volumeScore, set: setVolumeScore, weight: weights.volume, color: 'accent-brand-500' },
        { label: 'Resolution Score', value: resolutionScore, set: setResolutionScore, weight: weights.resolution, color: 'accent-cyan-500' },
        { label: 'Liquidity Score', value: liquidityScore, set: setLiquidityScore, weight: weights.liquidity, color: 'accent-brand-500' },
      ].map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-sm text-slate-400 w-36">{item.label} ({item.weight * 100}%)</span>
          <input type="range" min={0} max={100} value={item.value} onChange={e => item.set(parseInt(e.target.value))} className="flex-1" />
          <span className="text-sm font-mono text-white w-10 text-right">{item.value}</span>
        </div>
      ))}
      <div className="p-4 rounded-lg bg-slate-800/30 text-center">
        <div className="text-xs text-slate-400 mb-1">Trust Score</div>
        <div className={`text-3xl font-bold font-mono ${level.color}`}>{trustScore.toFixed(0)}</div>
        <div className={`text-sm mt-1 ${level.color}`}>{level.label}</div>
      </div>
    </div>
  );
}

export default function LearnPage() {
  const [activeSection, setActiveSection] = useState('prediction-markets');

  const sections: Section[] = [
    {
      id: 'prediction-markets',
      title: 'What is a Prediction Market?',
      icon: '🎯',
      content: (
        <div className="space-y-6">
          <p className="text-slate-300 leading-relaxed">
            A prediction market is a financial exchange where you can buy and sell contracts on the outcomes of real-world events.
            Each contract pays <strong className="text-white">$1.00</strong> if the event happens and <strong className="text-white">$0.00</strong> if it doesn&apos;t.
          </p>
          <p className="text-slate-300 leading-relaxed">
            The market price of a YES contract directly reflects the crowd&apos;s probability estimate. If YES trades at 65¢,
            the market collectively estimates a 65% chance the event will occur.
          </p>
          <div className="glass-strong rounded-xl p-6">
            <h4 className="text-sm font-semibold text-white mb-4">Interactive: Probability ↔ Price</h4>
            <ProbabilityDemo />
          </div>
          <div className="glass-strong rounded-xl p-6">
            <h4 className="text-sm font-semibold text-white mb-3">Major Platforms</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-slate-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded bg-brand-500" />
                  <span className="text-sm font-medium text-white">Polymarket</span>
                </div>
                <p className="text-xs text-slate-400">Blockchain-based (Polygon). Global access, no KYC for small amounts. Higher liquidity on crypto/politics events.</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded bg-accent-cyan" />
                  <span className="text-sm font-medium text-white">Kalshi</span>
                </div>
                <p className="text-xs text-slate-400">CFTC-regulated US exchange. KYC required. Better compliance guarantees. Broad event coverage.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'arbitrage',
      title: 'What is Arbitrage?',
      icon: '⇄',
      content: (
        <div className="space-y-6">
          <p className="text-slate-300 leading-relaxed">
            Arbitrage means profiting from price differences for the same thing on different markets.
            If the same event is priced differently on Polymarket and Kalshi, you can buy on the cheaper platform
            and sell on the more expensive one, locking in a <strong className="text-white">risk-free profit</strong>.
          </p>
          <div className="glass-strong rounded-xl p-6">
            <h4 className="text-sm font-semibold text-white mb-4">Interactive: Cross-Platform Arbitrage</h4>
            <ArbitrageDemo />
          </div>
          <div className="glass-strong rounded-xl p-6">
            <h4 className="text-sm font-semibold text-white mb-3">Why Do Price Gaps Exist?</h4>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2"><span className="text-brand-400 mt-0.5">1.</span> <span><strong>Different user bases</strong> — Polymarket skews crypto-native; Kalshi skews US institutional</span></li>
              <li className="flex items-start gap-2"><span className="text-brand-400 mt-0.5">2.</span> <span><strong>Settlement differences</strong> — Different resolution criteria for "the same" event</span></li>
              <li className="flex items-start gap-2"><span className="text-brand-400 mt-0.5">3.</span> <span><strong>Capital friction</strong> — Moving money between platforms takes time</span></li>
              <li className="flex items-start gap-2"><span className="text-brand-400 mt-0.5">4.</span> <span><strong>Information asymmetry</strong> — Not all traders monitor both platforms</span></li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'trust-scoring',
      title: 'How Do We Score Trust?',
      icon: '🛡',
      content: (
        <div className="space-y-6">
          <p className="text-slate-300 leading-relaxed">
            Not all prediction markets are equally reliable. Our Trust Engine scores each market on three dimensions:
            trading volume (are people actually trading?), resolution clarity (is the outcome well-defined?),
            and liquidity depth (can you enter/exit without moving the price?).
          </p>
          <div className="glass-strong rounded-xl p-6">
            <h4 className="text-sm font-semibold text-white mb-4">Interactive: Trust Score Calculator</h4>
            <TrustScoreDemo />
          </div>
          <div className="glass-strong rounded-xl p-6">
            <h4 className="text-sm font-semibold text-white mb-3">Why Trust Matters</h4>
            <p className="text-sm text-slate-300 mb-3">
              Our research shows that filtering by trust score significantly improves strategy performance:
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>Cross-platform arbitrage with trust ≥ 60 has 34% fewer false positives (RAAS finding)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>Insurance overlay requires trust ≥ 70 for reliable hedge behaviour</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>Low-trust markets have higher dispute rates and settlement uncertainty</span>
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'backtesting',
      title: 'How Are Strategies Validated?',
      icon: '📊',
      content: (
        <div className="space-y-6">
          <p className="text-slate-300 leading-relaxed">
            Backtesting means running a trading strategy on historical data to see how it would have performed.
            The key challenge: avoiding <strong className="text-white">overfitting</strong> — finding patterns that worked in the past
            but don&apos;t actually predict the future.
          </p>
          <div className="glass-strong rounded-xl p-6">
            <h4 className="text-sm font-semibold text-white mb-4">Our Anti-Overfitting Framework</h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="px-2.5 py-1 bg-brand-500/10 text-brand-300 rounded-full text-xs font-mono font-bold shrink-0">1</span>
                <div>
                  <h5 className="text-sm font-semibold text-white">Train/Validation/Test Split</h5>
                  <p className="text-xs text-slate-400 mt-1">Data split into three periods. Parameters tuned on training data only. Test set touched exactly once, at the very end.</p>
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1 h-3 rounded-full bg-brand-500/30 relative"><span className="absolute inset-0 flex items-center justify-center text-[8px] text-white">Train (→Sep 2025)</span></div>
                    <div className="flex-[0.5] h-3 rounded-full bg-yellow-500/30 relative"><span className="absolute inset-0 flex items-center justify-center text-[8px] text-white">Val</span></div>
                    <div className="flex-[0.3] h-3 rounded-full bg-green-500/30 relative"><span className="absolute inset-0 flex items-center justify-center text-[8px] text-white">Test</span></div>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="px-2.5 py-1 bg-brand-500/10 text-brand-300 rounded-full text-xs font-mono font-bold shrink-0">2</span>
                <div>
                  <h5 className="text-sm font-semibold text-white">No Look-Ahead</h5>
                  <p className="text-xs text-slate-400 mt-1">Every position is based on yesterday&apos;s information. We use <code className="text-accent-cyan">shift(1)</code> on all signals — the single most important line of code in the entire engine.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="px-2.5 py-1 bg-brand-500/10 text-brand-300 rounded-full text-xs font-mono font-bold shrink-0">3</span>
                <div>
                  <h5 className="text-sm font-semibold text-white">Statistical Significance</h5>
                  <p className="text-xs text-slate-400 mt-1">We require t-stat ≥ 3.0 (Harvey, Liu & Zhang 2016 standard) and apply Bonferroni correction across all 6 strategies.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="px-2.5 py-1 bg-brand-500/10 text-brand-300 rounded-full text-xs font-mono font-bold shrink-0">4</span>
                <div>
                  <h5 className="text-sm font-semibold text-white">Honest Reporting</h5>
                  <p className="text-xs text-slate-400 mt-1">Strategy 5 (Mean Reversion) shows NO alpha after costs. We report this transparently — it validates market efficiency and is academically valuable.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center pt-4">
            <Link href="/research/backtest" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-500/20 to-accent-cyan/20 text-white font-medium rounded-xl border border-brand-500/30 hover:border-brand-500/50 transition-all">
              View Full Backtest Results →
            </Link>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 terminal-bg opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white mb-3">
            Learn <span className="bg-gradient-to-r from-brand-300 to-accent-cyan bg-clip-text text-transparent">How It Works</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl">
            From prediction market basics to advanced backtesting methodology.
            Interactive explainers for every concept.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64 shrink-0">
            <nav className="lg:sticky lg:top-24 space-y-1">
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    activeSection === section.id
                      ? 'bg-brand-500/10 text-brand-300 border border-brand-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{section.icon}</span>
                  {section.title}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {sections.map(section => (
              <div key={section.id} className={activeSection === section.id ? '' : 'hidden'}>
                <h2 className="text-2xl font-bold text-white mb-6">{section.icon} {section.title}</h2>
                {section.content}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
