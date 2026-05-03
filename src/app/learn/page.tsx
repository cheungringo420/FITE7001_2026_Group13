import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Learn | PM Arbitrage',
  description: 'Methodology notes for trust scoring, resolution confidence, and dispute-risk analysis.',
};

const scoringInputs = [
  {
    label: 'Criteria clarity',
    weight: '40%',
    description: 'Starts at 50, then rewards explicit dates, objective thresholds, and settlement wording. Ambiguous wording lowers the score.',
  },
  {
    label: 'Evidence consensus',
    weight: '35%',
    description: 'Weights supporting, contradicting, and neutral evidence by source reliability and text similarity to the market.',
  },
  {
    label: 'Market integrity',
    weight: '25%',
    description: 'Starts with baseline risk and penalizes thin liquidity, low 24h volume, or YES plus NO prices far from 100 cents.',
  },
];

const clarityRules = [
  ['Base clarity', '+50 points'],
  ['Explicit date or time window', '+20 points'],
  ['Objective threshold', '+20 points'],
  ['Resolution wording', '+10 points'],
  ['Ambiguity terms', '-20 points'],
];

export default function LearnPage() {
  return (
    <div className="min-h-screen terminal-bg">
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/trust" className="inline-flex items-center gap-2 text-sm text-brand-300 hover:text-brand-200 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Trust Center
          </Link>
          <div className="mt-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 text-xs uppercase tracking-[0.3em] text-brand-300 bg-brand-500/10">
            Methodology
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mt-4" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            Trust Score Calculation
          </h1>
          <p className="text-slate-400 mt-3 max-w-3xl leading-relaxed">
            The Trust Center compresses resolution quality, evidence agreement, and market microstructure risk into a 0 to 100 score.
            It is designed to flag markets where the question may be hard to resolve, evidence is conflicted, or liquidity is weak.
          </p>
        </div>

        <div id="trust-scoring" className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 scroll-mt-24">
          <div className="surface rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Headline Formula</h2>
            <div className="rounded-xl border border-slate-700/60 bg-slate-950/70 p-4 font-mono text-sm text-slate-200 overflow-x-auto">
              trustScore = 100 * (
              <br />
              <span className="text-brand-300">0.40 * clarity</span>
              <br />
              + <span className="text-sky-300">0.35 * evidenceConsensus</span>
              <br />
              + <span className="text-emerald-300">0.25 * (1 - integrityRisk) * agreementOverlay</span>
              <br />
              )
            </div>
            <p className="text-sm text-slate-400 mt-4 leading-relaxed">
              The agreement overlay is <span className="font-mono text-slate-200">0.5 + 0.5 * agreementScore</span>.
              When no special feedback signal is supplied, agreement defaults to 0.5, so the integrity portion is partially discounted.
            </p>
          </div>

          <div className="surface rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Related Metrics</h2>
            <div className="space-y-3 text-sm">
              <div className="surface-strong rounded-xl p-4">
                <div className="text-slate-500 mb-1">Resolution Confidence</div>
                <div className="font-mono text-slate-200">100 * (0.40 clarity + 0.35 consensus + 0.25 cleanIntegrity)</div>
              </div>
              <div className="surface-strong rounded-xl p-4">
                <div className="text-slate-500 mb-1">Dispute Risk</div>
                <div className="font-mono text-slate-200">100 * (0.5 unclearCriteria + 0.5 evidenceConflict)</div>
              </div>
              <div className="surface-strong rounded-xl p-4">
                <div className="text-slate-500 mb-1">Integrity Risk</div>
                <div className="text-slate-300">Liquidity, volume, and price-balance penalties, clamped to 0 to 100.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {scoringInputs.map((input) => (
            <div key={input.label} className="surface rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white">{input.label}</h3>
                <span className="px-2 py-0.5 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-200 text-xs font-mono">
                  {input.weight}
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{input.description}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="surface rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Criteria Clarity Rules</h2>
            <div className="space-y-2">
              {clarityRules.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/45 px-3 py-2 text-sm">
                  <span className="text-slate-300">{label}</span>
                  <span className="font-mono text-brand-200">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="surface rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Evidence Consensus</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Each evidence item receives a stance value: support is +1, contradict is -1, and neutral is 0.
              The stance is multiplied by reliability, similarity, and item weight. The final consensus is centered around 50%,
              so balanced or missing evidence stays near neutral rather than pretending to be certain.
            </p>
            <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-950/70 p-4 font-mono text-sm text-slate-200 overflow-x-auto">
              consensus = clamp(0.5 + weightedStance / (2 * totalWeight))
            </div>
          </div>
        </div>

        <div className="surface rounded-2xl p-6 mt-6">
          <h2 className="text-xl font-semibold text-white mb-3">How To Read The Score</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="font-semibold text-emerald-300">80-100</div>
              <div className="text-slate-400 mt-1">Clear terms, aligned evidence, and healthier market structure.</div>
            </div>
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
              <div className="font-semibold text-sky-300">65-79</div>
              <div className="text-slate-400 mt-1">Usable, but still worth checking criteria details and evidence.</div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="font-semibold text-amber-300">50-64</div>
              <div className="text-slate-400 mt-1">Moderate trust. Review ambiguity, volume, and source agreement.</div>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <div className="font-semibold text-red-300">0-49</div>
              <div className="text-slate-400 mt-1">Caution. The market may be hard to resolve or poorly supported.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
