import { NextResponse } from 'next/server';
import { fetchMarkets, parseMarket } from '@/lib/polymarket/client';
import { matchBtcThreshold, ThresholdMatch } from '@/lib/options/match-btc-threshold';
import { fetchBtcChainNearExpiry, ChainSlice } from '@/lib/options/sources/deribit';
import { suggestStrategy, StrategyTicket } from '@/lib/options/suggest-strategy';
import type { Market } from '@/lib/polymarket/types';

export const revalidate = 30;

const BTC_HINT = /\b(bitcoin|btc)\b/i;
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

// Quality gates — keep the demo focused on signal, not gamma noise or wing artifacts.
// Defaults are tunable per-request via query string (minDays / minProb / maxProb)
// so the presenter can soften them live without redeploying.
const DEFAULT_MIN_DAYS_TO_EXPIRATION = 3;       // skip pure intraday gamma plays
const DEFAULT_MIN_OPTIONS_IMPLIED_PROB = 0.05;  // wing-gate: deep OTM call spreads are unreliable
const DEFAULT_MAX_OPTIONS_IMPLIED_PROB = 0.95;  // wing-gate: deep ITM call spreads are unreliable

interface FilterCounts {
    rejectedShortDated: number;
    rejectedWing: number;
    rejectedNoEdge: number;
}

async function scanBtcMarkets(): Promise<Market[]> {
    const seen = new Map<string, Market>();
    for (let page = 0; page < MAX_PAGES; page++) {
        const batch = await fetchMarkets({
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
            order: 'volume24hr',
            ascending: false,
            active: true,
            closed: false,
        });
        if (batch.length === 0) break;
        for (const m of batch) {
            if (BTC_HINT.test(m.question || '')) seen.set(m.id, m);
        }
        if (batch.length < PAGE_SIZE) break;
    }
    return Array.from(seen.values());
}

interface ScannedMarket {
    marketId: string;
    question: string;
    yesPrice: number;
    matched: boolean;
    matchConfidence?: number;
}

export interface CrossAssetBtcResponse {
    spotPrice: number | null;
    scanned: number;
    matched: number;
    opportunities: number;
    tickets: StrategyTicket[];
    skipped: ScannedMarket[];
    filters: FilterCounts & {
        minDaysToExpiration: number;
        minOptionsImpliedProb: number;
        maxOptionsImpliedProb: number;
    };
    errors: string[];
    fetchedAt: number;
}

function parseNumberParam(value: string | null, fallback: number): number {
    if (!value) return fallback;
    const n = parseFloat(value);
    return isFinite(n) ? n : fallback;
}

export async function GET(req: Request): Promise<NextResponse<CrossAssetBtcResponse>> {
    const url = new URL(req.url);
    const MIN_DAYS_TO_EXPIRATION = Math.max(0, parseNumberParam(url.searchParams.get('minDays'), DEFAULT_MIN_DAYS_TO_EXPIRATION));
    const MIN_OPTIONS_IMPLIED_PROB = Math.min(1, Math.max(0, parseNumberParam(url.searchParams.get('minProb'), DEFAULT_MIN_OPTIONS_IMPLIED_PROB)));
    const MAX_OPTIONS_IMPLIED_PROB = Math.min(1, Math.max(0, parseNumberParam(url.searchParams.get('maxProb'), DEFAULT_MAX_OPTIONS_IMPLIED_PROB)));

    const errors: string[] = [];
    const skipped: ScannedMarket[] = [];

    let rawMarkets: Market[] = [];
    try {
        rawMarkets = await scanBtcMarkets();
    } catch (e) {
        errors.push(`Polymarket scan failed: ${(e as Error).message}`);
    }

    const candidates: { match: ThresholdMatch; marketId: string; question: string; yesPrice: number }[] = [];
    for (const raw of rawMarkets) {
        const parsed = parseMarket(raw);
        const yesPrice = parsed.outcomePrices?.[0];
        if (typeof yesPrice !== 'number' || !isFinite(yesPrice) || yesPrice <= 0 || yesPrice >= 1) {
            continue;
        }
        const match = matchBtcThreshold(parsed.question);
        if (!match) {
            skipped.push({
                marketId: parsed.id,
                question: parsed.question,
                yesPrice,
                matched: false,
            });
            continue;
        }
        candidates.push({ match, marketId: parsed.id, question: parsed.question, yesPrice });
    }

    // Dedupe Deribit chain fetches by target expiry (yyyy-mm-dd).
    const chainCache = new Map<string, Promise<ChainSlice | null>>();
    const getChain = (targetExpiryISO: string): Promise<ChainSlice | null> => {
        const key = targetExpiryISO.slice(0, 10);
        let cached = chainCache.get(key);
        if (!cached) {
            cached = fetchBtcChainNearExpiry(targetExpiryISO).catch((e) => {
                errors.push(`Deribit fetch for ${key} failed: ${(e as Error).message}`);
                return null;
            });
            chainCache.set(key, cached);
        }
        return cached;
    };

    const tickets: StrategyTicket[] = [];
    let spotPrice: number | null = null;
    const filters: FilterCounts = { rejectedShortDated: 0, rejectedWing: 0, rejectedNoEdge: 0 };

    const settled = await Promise.all(
        candidates.map(async (c) => {
            const chain = await getChain(c.match.expiryISO);
            if (!chain) return null;
            if (spotPrice === null) spotPrice = chain.underlyingPrice;

            if (chain.daysToExpiration < MIN_DAYS_TO_EXPIRATION) {
                filters.rejectedShortDated++;
                return null;
            }

            const ticket = suggestStrategy({
                match: c.match,
                predictionPrice: c.yesPrice,
                polymarketMarketId: c.marketId,
                chain,
                notionalUsd: 1000,
            });
            if (!ticket) {
                filters.rejectedNoEdge++;
                skipped.push({
                    marketId: c.marketId,
                    question: c.question,
                    yesPrice: c.yesPrice,
                    matched: true,
                    matchConfidence: c.match.matchConfidence,
                });
                return null;
            }

            const p = ticket.inputs.optionsImpliedProbability;
            if (p < MIN_OPTIONS_IMPLIED_PROB || p > MAX_OPTIONS_IMPLIED_PROB) {
                filters.rejectedWing++;
                return null;
            }

            return ticket;
        })
    );

    for (const t of settled) if (t) tickets.push(t);
    tickets.sort((a, b) => b.edgePerUnit - a.edgePerUnit);

    return NextResponse.json({
        spotPrice,
        scanned: rawMarkets.length,
        matched: candidates.length,
        opportunities: tickets.length,
        tickets,
        skipped,
        filters: {
            ...filters,
            minDaysToExpiration: MIN_DAYS_TO_EXPIRATION,
            minOptionsImpliedProb: MIN_OPTIONS_IMPLIED_PROB,
            maxOptionsImpliedProb: MAX_OPTIONS_IMPLIED_PROB,
        },
        errors,
        fetchedAt: Date.now(),
    });
}
