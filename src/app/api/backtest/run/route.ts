import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// ── Row types from Supabase query ────────────────────────────
interface MarketMeta {
  question:         string;
  category:         string;
  resolved_at:      string;
  resolution_state: string;
  platform:         string;
}

interface TrustRow {
  market_id:         string;
  composite_score:   number;
  criteria_clarity:  number;
  evidence_consensus:number;
  integrity_risk:    number;
  methodology_ver:   string;
  markets_history:   MarketMeta | MarketMeta[];
}

interface DisputeRow {
  market_id: string;
}

// ── Input validation ──────────────────────────────────────────
const BacktestConfigSchema = z.object({
  threshold: z.number().min(1).max(99),
  dateFrom:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category:  z.string().nullable().optional(),
  platform:  z.enum(['polymarket', 'kalshi', 'all']).default('polymarket'),
});

// ── Supabase (server-side only, service role) ─────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key);
}

// ── Chi-square calculation (server-side) ──────────────────────
function chiSquare(
  a: number, b: number, c: number, d: number
): { chi2: number; p: number } {
  const n = a + b + c + d;
  if (n === 0) return { chi2: 0, p: 1 };
  const expected = [
    (a + b) * (a + c) / n,
    (a + b) * (b + d) / n,
    (c + d) * (a + c) / n,
    (c + d) * (b + d) / n,
  ];
  const observed = [a, b, c, d];
  const chi2 = observed.reduce((sum, o, i) => {
    const e = expected[i];
    return e > 0 ? sum + (o - e) ** 2 / e : sum;
  }, 0);

  // p-value approximation for chi² with df=1
  const p = Math.exp(-chi2 / 2);
  return { chi2: +chi2.toFixed(4), p: +p.toFixed(6) };
}

export async function POST(req: NextRequest) {
  try {
    // Parse & validate input
    const body = await req.json();
    const config = BacktestConfigSchema.parse(body);
    const supabase = getSupabase();

    // ── Query 1: fetch trust score join with market metadata ──
    let query = supabase
      .from('trust_scores_historical')
      .select(`
        market_id,
        composite_score,
        criteria_clarity,
        evidence_consensus,
        integrity_risk,
        methodology_ver,
        markets_history!inner (
          question,
          category,
          resolved_at,
          resolution_state,
          platform
        )
      `)
      .eq('methodology_ver', 'v1.0')
      .gte('markets_history.resolved_at', config.dateFrom)
      .lte('markets_history.resolved_at', config.dateTo);

    if (config.platform !== 'all') {
      query = query.eq('markets_history.platform', config.platform);
    }
    if (config.category) {
      query = query.ilike('markets_history.category', `%${config.category}%`);
    }

    const { data: trustRows, error: trustErr } = await query.limit(20_000);
    if (trustErr) throw new Error(`Trust query failed: ${trustErr.message}`);
    if (!trustRows?.length) {
      return NextResponse.json(
        { message: 'No data found for the selected filters. Run the data pipeline scripts first.' },
        { status: 422 }
      );
    }

    // ── Query 2: get disputed market IDs ──────────────────────
    const marketIds = (trustRows as TrustRow[]).map((r: TrustRow) => r.market_id);
    const { data: disputeRows } = await supabase
      .from('dispute_events')
      .select('market_id')
      .in('market_id', marketIds);

    const disputedSet = new Set((disputeRows as DisputeRow[] ?? []).map((d: DisputeRow) => d.market_id));

    // Also mark markets where resolution_state === DISPUTED
    const typedRows = trustRows as TrustRow[];
    const allDisputed = new Set([
      ...disputedSet,
      ...typedRows
        .filter((r: TrustRow) => {
          const meta = Array.isArray(r.markets_history) ? r.markets_history[0] : r.markets_history;
          return meta?.resolution_state === 'DISPUTED';
        })
        .map((r: TrustRow) => r.market_id),
    ]);

    // ── Compute statistics ────────────────────────────────────
    const { threshold } = config;
    const low:  { score: number; disputed: boolean; marketId: string }[] = [];
    const high: { score: number; disputed: boolean; marketId: string }[] = [];

    for (const row of typedRows) {
      const score    = row.composite_score ?? 0;
      const disputed = allDisputed.has(row.market_id);
      if (score < threshold) low.push({ score, disputed, marketId: row.market_id });
      else                   high.push({ score, disputed, marketId: row.market_id });
    }

    const nLow  = low.length;
    const nHigh = high.length;
    const dLow  = low.filter(r => r.disputed).length;
    const dHigh = high.filter(r => r.disputed).length;

    const rateLow  = nLow  > 0 ? dLow  / nLow  : 0;
    const rateHigh = nHigh > 0 ? dHigh / nHigh : 0;
    const lift     = rateHigh > 0 ? rateLow / rateHigh : 99;

    const { chi2, p } = chiSquare(dLow, nLow - dLow, dHigh, nHigh - dHigh);

    // ── Decile breakdown ──────────────────────────────────────
    const decileSize = 10;
    const deciles = Array.from({ length: 10 }, (_, i) => {
      const lo = i * decileSize;
      const hi = lo + decileSize;
      const bucket = trustRows.filter(r =>
        r.composite_score >= lo && r.composite_score < hi
      );
      const nDisputed = bucket.filter(r => allDisputed.has(r.market_id)).length;
      return {
        scoreRange:  `${lo}–${hi}`,
        nMarkets:    bucket.length,
        nDisputed,
        disputeRate: bucket.length > 0 ? nDisputed / bucket.length : 0,
      };
    }).filter(d => d.nMarkets > 0);

    // ── Sample markets ────────────────────────────────────────
    const getMeta = (marketId: string): MarketMeta | null => {
      const row = typedRows.find((t: TrustRow) => t.market_id === marketId);
      if (!row) return null;
      return Array.isArray(row.markets_history) ? row.markets_history[0] : row.markets_history;
    };

    const sampleMarkets = [
      ...low.filter((r) => r.disputed).slice(0, 5).map((r) => {
        const meta = getMeta(r.marketId);
        return {
          id: r.marketId, question: meta?.question ?? '',
          compositeScore: r.score, disputed: true,
          resolvedAt: meta?.resolved_at ?? '', category: meta?.category ?? '',
        };
      }),
      ...high.filter((r) => !r.disputed).slice(0, 5).map((r) => {
        const meta = getMeta(r.marketId);
        return {
          id: r.marketId, question: meta?.question ?? '',
          compositeScore: r.score, disputed: false,
          resolvedAt: meta?.resolved_at ?? '', category: meta?.category ?? '',
        };
      }),
    ];

    // ── Persist result to Supabase ────────────────────────────
    const runRecord = {
      run_name:             `api_thr${threshold}_${new Date().toISOString().split('T')[0]}`,
      methodology_ver:      'v1.0',
      trust_threshold:      threshold,
      date_from:            config.dateFrom,
      date_to:              config.dateTo,
      category_filter:      config.category ?? null,
      platform_filter:      config.platform,
      total_markets:        nLow + nHigh,
      n_low_trust:          nLow,
      n_high_trust:         nHigh,
      disputed_low_trust:   dLow,
      disputed_high_trust:  dHigh,
      dispute_rate_low:     +rateLow.toFixed(4),
      dispute_rate_high:    +rateHigh.toFixed(4),
      overall_dispute_rate: +((dLow + dHigh) / (nLow + nHigh)).toFixed(4),
      lift_ratio:           +lift.toFixed(3),
      chi2_statistic:       chi2,
      p_value:              p,
      degrees_of_freedom:   1,
      is_significant:       p < 0.05,
    };

    await supabase.from('backtest_runs').insert(runRecord);

    // ── Return response ───────────────────────────────────────
    return NextResponse.json({
      runName:           runRecord.run_name,
      threshold,
      dateFrom:          config.dateFrom,
      dateTo:            config.dateTo,
      totalMarkets:      nLow + nHigh,
      nLowTrust:         nLow,
      nHighTrust:        nHigh,
      disputedLow:       dLow,
      disputedHigh:      dHigh,
      disputeRateLow:    +rateLow.toFixed(4),
      disputeRateHigh:   +rateHigh.toFixed(4),
      overallDisputeRate: +((dLow + dHigh) / (nLow + nHigh)).toFixed(4),
      liftRatio:         +lift.toFixed(3),
      chi2Statistic:     chi2,
      pValue:            p,
      isSignificant:     p < 0.05,
      decileBreakdown:   deciles,
      sampleMarkets,
    });

  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', issues: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[backtest/run]', message);
    return NextResponse.json({ message }, { status: 500 });
  }
}
