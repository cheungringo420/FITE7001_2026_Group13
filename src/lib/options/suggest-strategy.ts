// Cross-asset strategy generator: Polymarket binary vs Deribit BTC options.
//
// Replicates a $1 digital at strike K via a tight call spread (long K_low /
// short K_high) — the Breeden–Litzenberger discrete digital approximation.
// Per unit of digital exposure: cost ≈ (longCall.mid − shortCall.mid) /
// (K_high − K_low).
//
// If Polymarket prices YES at p_poly and the replicated digital costs p_opt,
// the locked-in arbitrage edge per $1 of binary notional is |p_poly − p_opt|,
// minus basis risk from the discrete spread width and minus fees/slippage
// (NOT modeled here — emitted as warnings instead).

import { ChainSlice, NormalizedOption } from './sources/deribit';
import { ThresholdMatch } from './match-btc-threshold';
import { calculateDiscrepancy } from './iv-calculator';

export interface DigitalReplication {
    longCall: NormalizedOption;
    shortCall: NormalizedOption;
    spreadWidth: number;
    midStrike: number;
    replicatedDigitalPrice: number;
    direction: 'above' | 'below';
}

export interface TradeLeg {
    side: 'buy' | 'sell';
    venue: 'polymarket' | 'deribit';
    instrument: string;
    contractType: 'binary-yes' | 'binary-no' | 'call' | 'put';
    strike?: number;
    expiry: string;
    size: number;
    pricePerContract: number;
    notional: number;
}

export interface StrategyTicket {
    thesis: string;
    rationale: string;
    edgePerUnit: number;
    edgePercent: number;
    legs: TradeLeg[];
    estimatedProfit: number;
    estimatedCapital: number;
    breakevenProbability: number;
    warnings: string[];
    replication: DigitalReplication;
    inputs: {
        match: ThresholdMatch;
        predictionPrice: number;
        optionsImpliedProbability: number;
    };
}

// Pick the tightest call-strike pair that straddles K.
export function buildDigitalReplicationAtStrike(
    chain: ChainSlice,
    strike: number,
    direction: 'above' | 'below'
): DigitalReplication | null {
    const calls = chain.calls;
    if (calls.length < 2) return null;

    let lowIdx = -1;
    for (let i = 0; i < calls.length; i++) {
        if (calls[i].strike <= strike) lowIdx = i;
        else break;
    }
    if (lowIdx < 0 || lowIdx >= calls.length - 1) return null;

    const longCall = calls[lowIdx];
    const shortCall = calls[lowIdx + 1];
    const spreadWidth = shortCall.strike - longCall.strike;
    if (spreadWidth <= 0) return null;

    const spreadCost = longCall.mid - shortCall.mid;
    const aboveProbability = Math.max(0, Math.min(1, spreadCost / spreadWidth));
    const replicatedDigitalPrice = direction === 'above' ? aboveProbability : 1 - aboveProbability;

    return {
        longCall,
        shortCall,
        spreadWidth,
        midStrike: (longCall.strike + shortCall.strike) / 2,
        replicatedDigitalPrice,
        direction,
    };
}

export interface SuggestStrategyInput {
    match: ThresholdMatch;
    predictionPrice: number;
    polymarketMarketId: string;
    chain: ChainSlice;
    notionalUsd?: number;
}

export function suggestStrategy(input: SuggestStrategyInput): StrategyTicket | null {
    const { match, predictionPrice, polymarketMarketId, chain } = input;
    const notionalUsd = input.notionalUsd ?? 1000;

    const replication = buildDigitalReplicationAtStrike(chain, match.threshold, match.direction);
    if (!replication) return null;

    const optionsImpliedProbability = replication.replicatedDigitalPrice;
    const disc = calculateDiscrepancy(predictionPrice, optionsImpliedProbability);
    if (!disc.opportunity) return null;

    const polyOverpriced = disc.direction === 'prediction-higher';

    const polyCostPerUnit = polyOverpriced ? 1 - predictionPrice : predictionPrice;
    const optsCostPerUnit = polyOverpriced
        ? 1 - optionsImpliedProbability
        : optionsImpliedProbability;
    const capitalPerUnit = Math.max(0.01, polyCostPerUnit + optsCostPerUnit);
    const units = Math.floor(notionalUsd / capitalPerUnit);
    if (units <= 0) return null;

    const spreadContracts = Math.max(1, Math.ceil(units / replication.spreadWidth));

    const polyLeg: TradeLeg = {
        side: polyOverpriced ? 'sell' : 'buy',
        venue: 'polymarket',
        instrument: polymarketMarketId,
        contractType: 'binary-yes',
        expiry: match.expiryISO,
        size: units,
        pricePerContract: predictionPrice,
        notional: units * predictionPrice,
    };
    const longLeg: TradeLeg = {
        side: polyOverpriced ? 'buy' : 'sell',
        venue: 'deribit',
        instrument: replication.longCall.instrumentName,
        contractType: 'call',
        strike: replication.longCall.strike,
        expiry: chain.expirationDate,
        size: spreadContracts,
        pricePerContract: replication.longCall.mid,
        notional: spreadContracts * replication.longCall.mid,
    };
    const shortLeg: TradeLeg = {
        side: polyOverpriced ? 'sell' : 'buy',
        venue: 'deribit',
        instrument: replication.shortCall.instrumentName,
        contractType: 'call',
        strike: replication.shortCall.strike,
        expiry: chain.expirationDate,
        size: spreadContracts,
        pricePerContract: replication.shortCall.mid,
        notional: spreadContracts * replication.shortCall.mid,
    };

    const edge = Math.abs(disc.valueDiff);
    const estimatedProfit = units * edge;
    const estimatedCapital = units * capitalPerUnit;

    const warnings: string[] = [];
    const widthPctOfSpot = replication.spreadWidth / chain.underlyingPrice;
    if (widthPctOfSpot > 0.05) {
        warnings.push(
            `Replication spread width is ${(widthPctOfSpot * 100).toFixed(1)}% of spot — digital approximation is coarse; basis risk material.`
        );
    }
    if (chain.daysToExpiration < 1) {
        warnings.push(`Chain expires in <1 day — gamma risk on the spread leg.`);
    }
    const expiryGapDays = Math.abs(
        (new Date(chain.expirationDate).getTime() - new Date(match.expiryISO).getTime()) / 86_400_000
    );
    if (expiryGapDays > 7) {
        warnings.push(
            `Polymarket expiry vs nearest Deribit expiry differs by ${expiryGapDays.toFixed(0)} days.`
        );
    }
    if (match.matchConfidence < 1) {
        warnings.push(
            `Question→strike confidence is ${(match.matchConfidence * 100).toFixed(0)}%.`
        );
    }
    warnings.push('Fees, slippage, and Polymarket→Deribit collateral transfer cost are not modeled.');

    const directionWord = match.direction === 'above' ? '>' : '<';
    const thesis = polyOverpriced
        ? `Polymarket overprices "${match.underlying} ${directionWord} $${match.threshold.toLocaleString()} by ${match.expiryISO}" at ${(predictionPrice * 100).toFixed(1)}%; Deribit-replicated digital implies ${(optionsImpliedProbability * 100).toFixed(1)}%.`
        : `Polymarket underprices "${match.underlying} ${directionWord} $${match.threshold.toLocaleString()} by ${match.expiryISO}" at ${(predictionPrice * 100).toFixed(1)}%; Deribit-replicated digital implies ${(optionsImpliedProbability * 100).toFixed(1)}%.`;

    const rationale =
        `Edge ${(edge * 100).toFixed(2)}pp (${disc.percentDiff.toFixed(1)}% relative). ` +
        `Replicating $1 digital at K=$${match.threshold.toLocaleString()} via call spread ` +
        `${replication.longCall.strike.toLocaleString()}/${replication.shortCall.strike.toLocaleString()} ` +
        `(width $${replication.spreadWidth.toLocaleString()}, mid $${replication.midStrike.toLocaleString()}).`;

    return {
        thesis,
        rationale,
        edgePerUnit: edge,
        edgePercent: edge * 100,
        legs: [polyLeg, longLeg, shortLeg],
        estimatedProfit,
        estimatedCapital,
        breakevenProbability: polyOverpriced ? optionsImpliedProbability : predictionPrice,
        warnings,
        replication,
        inputs: { match, predictionPrice, optionsImpliedProbability },
    };
}
