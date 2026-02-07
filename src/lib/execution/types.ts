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
}

export interface ExecutionLegStatus {
  platform: Platform;
  orderId: string;
  status: 'open' | 'filled' | 'cancelled' | 'rejected';
}

export interface ExecutionRecord {
  executionId: string;
  status: 'submitted' | 'partially_filled' | 'filled' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  legs: ExecutionLegStatus[];
  quote: ExecutionQuote;
  trust?: ExecutionTrustSnapshot;
  fills?: Array<{ platform: Platform; filled: number; avgPrice: number }>;
  profitRealized?: number;
}
