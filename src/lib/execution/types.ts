export type Platform = 'polymarket' | 'kalshi';

export interface ExecutionLegTrust {
  platform: Platform;
  marketId: string;
  trustScore: number;
  resolutionConfidence: number;
  disputeRisk: number;
  integrityRisk: number;
  evidenceCount: number;
}

export interface ExecutionTrustSnapshot {
  snapshotVersion: string;
  evaluatedAt: string;
  legs: ExecutionLegTrust[];
}

export interface ExecutionLeg {
  platform: Platform;
  marketId: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  size: number;
  limitPrice: number;
}

export interface QuoteRequest {
  legs: ExecutionLeg[];
  maxNotional: number;
  ttlMs?: number;
  marketMatchKey?: string;
  allowHeuristic?: boolean;
  trustSnapshot?: ExecutionTrustSnapshot;
}

export interface ExecutionQuote {
  quoteId: string;
  mode: 'paper' | 'live';
  legs: ExecutionLeg[];
  maxNotional: number;
  expiresAt: string;
  estimatedProfit: number;
  trust?: ExecutionTrustSnapshot;
  validation: {
    marketMatch: 'strict' | 'heuristic';
    matchStatus: 'ok' | 'blocked';
    riskStatus: 'ok' | 'blocked';
    reasons?: string[];
  };
}

export interface ExecutionSubmitRequest {
  quoteId: string;
  executionToken: string;
  clientNonce: string;
  idempotencyKey?: string;
}

export interface ExecutionLegStatus {
  platform: Platform;
  orderId: string;
  requestedSize: number;
  filledSize: number;
  limitPrice: number;
  averageFillPrice?: number;
  status: 'pending' | 'open' | 'partially_filled' | 'filled' | 'canceled' | 'rejected';
}

export interface ExecutionRecord {
  executionId: string;
  quoteId: string;
  status: 'created' | 'quoted' | 'submitted' | 'partially_filled' | 'filled' | 'canceled' | 'rejected';
  createdAt: string;
  updatedAt: string;
  mode: 'paper' | 'live';
  idempotencyKey: string;
  legs: ExecutionLegStatus[];
  quote: ExecutionQuote;
  trust?: ExecutionTrustSnapshot;
  fills?: Array<{ platform: Platform; filled: number; avgPrice: number }>;
  profitRealized?: number;
}
