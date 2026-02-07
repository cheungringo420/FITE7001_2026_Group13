import { randomUUID } from 'crypto';
import { ExecutionLeg, ExecutionQuote, ExecutionRecord, QuoteRequest, ExecutionSubmitRequest } from './types';
import { applyRiskToQuote, evaluateRisk } from './risk';
import { evaluateMarketMatch } from './validation';
import { getQuote, saveExecution, saveQuote, updateExecution } from './store';

const DEFAULT_TTL_MS = 10_000;

function estimateProfit(legs: ExecutionLeg[]): number {
  if (legs.length < 2) return 0;
  const notional = legs.reduce((sum, leg) => sum + leg.size * leg.limitPrice, 0);
  return Math.max(0, notional * 0.01);
}

export function createExecutionQuote(request: QuoteRequest): ExecutionQuote {
  const ttlMs = request.ttlMs ?? DEFAULT_TTL_MS;
  const quoteId = `q_${randomUUID()}`;

  const match = evaluateMarketMatch(request.legs, {
    marketMatchKey: request.marketMatchKey,
    allowHeuristic: request.allowHeuristic,
  });

  const quote: ExecutionQuote = {
    quoteId,
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
  return enriched;
}

export function submitExecution(request: ExecutionSubmitRequest): ExecutionRecord {
  const quote = getQuote(request.quoteId);
  if (!quote) {
    throw new Error('Quote not found or expired');
  }

  if (quote.validation.matchStatus === 'blocked') {
    throw new Error(`Validation blocked: ${quote.validation.reasons?.join(', ') || 'market match failed'}`);
  }

  const risk = evaluateRisk(quote.legs, quote.maxNotional);
  if (risk.status === 'blocked') {
    throw new Error(`Risk checks failed: ${risk.reasons.join(', ')}`);
  }

  const executionId = `x_${randomUUID()}`;
  const now = new Date().toISOString();

  const record: ExecutionRecord = {
    executionId,
    status: 'submitted',
    createdAt: now,
    updatedAt: now,
    legs: quote.legs.map((leg, index) => ({
      platform: leg.platform,
      orderId: `${leg.platform}_${executionId}_${index}`,
      status: 'open',
    })),
    quote,
    trust: quote.trust,
    fills: [],
    profitRealized: 0,
  };

  saveExecution(record);

  // Simulate asynchronous fills in the stub service
  setTimeout(() => {
    updateExecution(executionId, {
      status: 'filled',
      legs: record.legs.map((leg) => ({ ...leg, status: 'filled' })),
      fills: record.legs.map((leg) => ({
        platform: leg.platform,
        filled: 1,
        avgPrice: record.quote.legs.find((qLeg) => qLeg.platform === leg.platform)?.limitPrice || 0,
      })),
      profitRealized: record.quote.estimatedProfit,
    });
  }, 2500);

  return record;
}
