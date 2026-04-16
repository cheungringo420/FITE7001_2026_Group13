import { randomUUID } from 'crypto';
import { getExecutionMode } from '@/lib/config/features';
import { applyRiskToQuote, evaluateRisk } from './risk';
import { evaluateMarketMatch } from './validation';
import {
  getExecution,
  getExecutionByIdempotencyKey,
  getQuote,
  saveExecution,
  saveIdempotencyKey,
  saveQuote,
  updateExecution,
} from './store';
import { recordAuditEvent } from './audit';
import {
  ExecutionLeg,
  ExecutionLegStatus,
  ExecutionQuote,
  ExecutionRecord,
  ExecutionSubmitRequest,
  QuoteRequest,
} from './types';

const DEFAULT_TTL_MS = 10_000;
const MIN_TRUST_SCORE = 30;

const ALLOWED_TRANSITIONS: Record<ExecutionRecord['status'], ExecutionRecord['status'][]> = {
  created: ['quoted', 'submitted', 'canceled', 'rejected'],
  quoted: ['submitted', 'canceled', 'rejected'],
  submitted: ['partially_filled', 'filled', 'canceled', 'rejected'],
  partially_filled: ['filled', 'canceled'],
  filled: [],
  canceled: [],
  rejected: [],
};

function estimateProfit(legs: ExecutionLeg[]): number {
  if (legs.length < 2) return 0;
  const notional = legs.reduce((sum, leg) => sum + leg.size * leg.limitPrice, 0);
  return Math.max(0, notional * 0.01);
}

function ensureTransition(record: ExecutionRecord, next: ExecutionRecord['status']) {
  const allowed = ALLOWED_TRANSITIONS[record.status];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid execution transition ${record.status} -> ${next}`);
  }
}

function setExecutionStatus(executionId: string, nextStatus: ExecutionRecord['status']) {
  const existing = getExecution(executionId);
  if (!existing) {
    throw new Error(`Execution ${executionId} not found`);
  }
  ensureTransition(existing, nextStatus);
  const updated = updateExecution(executionId, { status: nextStatus });
  if (!updated) {
    throw new Error(`Unable to transition execution ${executionId} to ${nextStatus}`);
  }
  return updated;
}

function buildLegStatuses(executionId: string, legs: ExecutionLeg[]): ExecutionLegStatus[] {
  return legs.map((leg, index) => ({
    platform: leg.platform,
    orderId: `${leg.platform}_${executionId}_${index}`,
    requestedSize: leg.size,
    filledSize: 0,
    limitPrice: leg.limitPrice,
    status: 'pending',
  }));
}

function deterministicFill(leg: ExecutionLeg): {
  status: ExecutionLegStatus['status'];
  filledSize: number;
  averageFillPrice?: number;
} {
  if (leg.size <= 300) {
    return { status: 'filled', filledSize: leg.size, averageFillPrice: leg.limitPrice };
  }
  if (leg.size <= 600) {
    const partial = Math.round(leg.size * 0.5 * 1000) / 1000;
    return { status: 'partially_filled', filledSize: partial, averageFillPrice: leg.limitPrice };
  }
  return { status: 'rejected', filledSize: 0 };
}

export function createExecutionQuote(request: QuoteRequest): ExecutionQuote {
  const ttlMs = request.ttlMs ?? DEFAULT_TTL_MS;
  const quoteId = `q_${randomUUID()}`;
  const mode = getExecutionMode();

  const match = evaluateMarketMatch(request.legs, {
    marketMatchKey: request.marketMatchKey,
    allowHeuristic: request.allowHeuristic,
  });

  const quote: ExecutionQuote = {
    quoteId,
    mode,
    legs: request.legs,
    maxNotional: request.maxNotional,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    estimatedProfit: estimateProfit(request.legs),
    trust: request.trustSnapshot,
    validation: {
      marketMatch: match.marketMatch,
      matchStatus: match.matchStatus,
      riskStatus: 'ok',
      reasons: match.reasons.length ? match.reasons : undefined,
    },
  };

  const enriched = applyRiskToQuote(quote, request.maxNotional);
  saveQuote(enriched, ttlMs);

  recordAuditEvent(quoteId, 'quote_created', {
    mode,
    legs: enriched.legs.length,
    maxNotional: enriched.maxNotional,
    estimatedProfit: enriched.estimatedProfit,
    ttlMs,
  });

  return enriched;
}

function createRejectedExecution(quote: ExecutionQuote, idempotencyKey: string, reason: string): ExecutionRecord {
  const executionId = `x_${randomUUID()}`;
  const now = new Date().toISOString();
  const record: ExecutionRecord = {
    executionId,
    quoteId: quote.quoteId,
    status: 'rejected',
    createdAt: now,
    updatedAt: now,
    mode: quote.mode,
    idempotencyKey,
    legs: buildLegStatuses(executionId, quote.legs).map((leg) => ({ ...leg, status: 'rejected' })),
    quote,
    trust: quote.trust,
    fills: [],
    profitRealized: 0,
  };
  saveExecution(record);
  saveIdempotencyKey(idempotencyKey, executionId);
  recordAuditEvent(executionId, 'execution_rejected', { reason });
  return record;
}

export function submitExecution(request: ExecutionSubmitRequest): ExecutionRecord {
  const quote = getQuote(request.quoteId);
  if (!quote) {
    throw new Error('Quote not found or expired');
  }

  const idempotencyKey = request.idempotencyKey || `${request.quoteId}:${request.clientNonce}`;
  const existing = getExecutionByIdempotencyKey(idempotencyKey);
  if (existing) {
    return existing;
  }

  if (quote.validation.matchStatus === 'blocked') {
    recordAuditEvent(quote.quoteId, 'validation_blocked', { reasons: quote.validation.reasons });
    return createRejectedExecution(
      quote,
      idempotencyKey,
      `Validation blocked: ${quote.validation.reasons?.join(', ') || 'market match failed'}`,
    );
  }
  recordAuditEvent(quote.quoteId, 'validation_passed', { marketMatch: quote.validation.marketMatch });

  const risk = evaluateRisk(quote.legs, quote.maxNotional);
  if (risk.status === 'blocked') {
    recordAuditEvent(quote.quoteId, 'risk_check_blocked', { reasons: risk.reasons });
    return createRejectedExecution(quote, idempotencyKey, `Risk checks failed: ${risk.reasons.join(', ')}`);
  }
  recordAuditEvent(quote.quoteId, 'risk_check_passed', { riskStatus: risk.status });

  if (quote.trust) {
    const minTrust = Math.min(...quote.trust.legs.map((leg) => leg.trustScore));
    if (minTrust < MIN_TRUST_SCORE) {
      recordAuditEvent(quote.quoteId, 'trust_gate_blocked', {
        minTrustScore: minTrust,
        threshold: MIN_TRUST_SCORE,
      });
      return createRejectedExecution(
        quote,
        idempotencyKey,
        `Trust gate failed: minimum trust score ${minTrust} below threshold ${MIN_TRUST_SCORE}`,
      );
    }
    recordAuditEvent(quote.quoteId, 'trust_gate_passed', {
      minTrustScore: minTrust,
      threshold: MIN_TRUST_SCORE,
    });
  }

  const executionId = `x_${randomUUID()}`;
  const now = new Date().toISOString();
  const record: ExecutionRecord = {
    executionId,
    quoteId: quote.quoteId,
    status: 'created',
    createdAt: now,
    updatedAt: now,
    mode: quote.mode,
    idempotencyKey,
    legs: buildLegStatuses(executionId, quote.legs),
    quote,
    trust: quote.trust,
    fills: [],
    profitRealized: 0,
  };
  saveExecution(record);
  saveIdempotencyKey(idempotencyKey, executionId);
  recordAuditEvent(executionId, 'execution_created', {
    quoteId: quote.quoteId,
    legsCount: record.legs.length,
    mode: quote.mode,
  });

  setExecutionStatus(executionId, 'quoted');
  setExecutionStatus(executionId, 'submitted');
  recordAuditEvent(executionId, 'execution_submitted', {
    quoteId: quote.quoteId,
    legsCount: record.legs.length,
  });

  if (quote.mode === 'live') {
    const rejected = setExecutionStatus(executionId, 'rejected');
    updateExecution(executionId, {
      legs: rejected.legs.map((leg) => ({ ...leg, status: 'rejected' })),
      profitRealized: 0,
    });
    recordAuditEvent(executionId, 'execution_rejected', {
      reason: 'Live execution adapters are not configured for this deployment',
    });
    return getExecution(executionId)!;
  }

  const legStatuses: ExecutionLegStatus[] = [];
  const fills: Array<{ platform: 'polymarket' | 'kalshi'; filled: number; avgPrice: number }> = [];

  for (let index = 0; index < quote.legs.length; index += 1) {
    const leg = quote.legs[index];
    const baseStatus = record.legs[index];
    recordAuditEvent(executionId, 'order_placed', {
      orderId: baseStatus.orderId,
      platform: leg.platform,
      requestedSize: leg.size,
      limitPrice: leg.limitPrice,
    }, leg.platform);

    const fill = deterministicFill(leg);
    const nextLeg: ExecutionLegStatus = {
      ...baseStatus,
      status: fill.status,
      filledSize: fill.filledSize,
      averageFillPrice: fill.averageFillPrice,
    };
    legStatuses.push(nextLeg);

    if (fill.status === 'filled') {
      recordAuditEvent(executionId, 'order_filled', {
        orderId: nextLeg.orderId,
        size: fill.filledSize,
        fillPrice: fill.averageFillPrice,
        notional: fill.filledSize * (fill.averageFillPrice || 0),
      }, leg.platform);
    } else if (fill.status === 'partially_filled') {
      recordAuditEvent(executionId, 'order_partially_filled', {
        orderId: nextLeg.orderId,
        filledSize: fill.filledSize,
        requestedSize: leg.size,
        fillPrice: fill.averageFillPrice,
      }, leg.platform);
    } else {
      recordAuditEvent(executionId, 'order_rejected', {
        orderId: nextLeg.orderId,
        requestedSize: leg.size,
        reason: 'Order size exceeds paper-mode deterministic fill capacity',
      }, leg.platform);
    }

    if (fill.filledSize > 0 && fill.averageFillPrice !== undefined) {
      fills.push({
        platform: leg.platform,
        filled: fill.filledSize,
        avgPrice: fill.averageFillPrice,
      });
    }
  }

  const filledLegs = legStatuses.filter((leg) => leg.status === 'filled').length;
  const partialLegs = legStatuses.filter((leg) => leg.status === 'partially_filled').length;
  const rejectedLegs = legStatuses.filter((leg) => leg.status === 'rejected').length;
  const fillRatio = quote.legs.length
    ? legStatuses.reduce((sum, leg) => sum + leg.filledSize / leg.requestedSize, 0) / quote.legs.length
    : 0;
  const profitRealized = Math.round(quote.estimatedProfit * fillRatio * 100) / 100;

  let targetStatus: ExecutionRecord['status'] = 'filled';
  if (rejectedLegs === legStatuses.length) {
    targetStatus = 'rejected';
  } else if (partialLegs > 0 || (filledLegs > 0 && rejectedLegs > 0)) {
    targetStatus = 'partially_filled';
  } else if (filledLegs !== legStatuses.length) {
    targetStatus = 'rejected';
  }

  const transitioned = setExecutionStatus(executionId, targetStatus);
  updateExecution(executionId, {
    status: transitioned.status,
    legs: legStatuses,
    fills,
    profitRealized,
  });

  if (targetStatus === 'filled') {
    recordAuditEvent(executionId, 'execution_completed', {
      profitRealized,
      fillRatio,
    });
  } else if (targetStatus === 'partially_filled') {
    recordAuditEvent(executionId, 'execution_partially_filled', {
      profitRealized,
      filledLegs,
      partialLegs,
      rejectedLegs,
    });
  } else {
    recordAuditEvent(executionId, 'execution_rejected', {
      reason: 'No legs filled in paper mode',
    });
  }

  return getExecution(executionId)!;
}

export function cancelExecution(executionId: string): ExecutionRecord {
  const record = getExecution(executionId);
  if (!record) {
    throw new Error('Execution not found');
  }

  if (!['created', 'quoted', 'submitted', 'partially_filled'].includes(record.status)) {
    throw new Error(`Execution in status ${record.status} cannot be canceled`);
  }

  const transitioned = setExecutionStatus(executionId, 'canceled');
  const updated = updateExecution(executionId, {
    status: transitioned.status,
    legs: transitioned.legs.map((leg) => {
      if (leg.status === 'filled') return leg;
      return { ...leg, status: 'canceled' };
    }),
  });

  recordAuditEvent(executionId, 'execution_cancelled', { previousStatus: record.status });

  if (!updated) {
    throw new Error('Unable to cancel execution');
  }

  return updated;
}
