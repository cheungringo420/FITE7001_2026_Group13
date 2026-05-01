/**
 * Shared types for the backtest module.
 * Extracted from page.tsx to avoid circular imports.
 */

export interface BacktestConfig {
  threshold: number;
  dateFrom: string;
  dateTo: string;
  category: string | null;
  platform: string;
}

export interface BacktestResult {
  threshold: number;
  totalMarkets: number;
  overallDisputeRate: number;
  nLowTrust: number;
  nHighTrust: number;
  disputeRateLow: number;
  disputeRateHigh: number;
  disputedLow: number;
  disputedHigh: number;
  liftRatio: number;
  chi2Statistic: number;
  pValue: number;
  isSignificant: boolean;
  aucRoc?: number;
  dateFrom: string;
  dateTo: string;
}

export interface DecileBucket {
  scoreRange: string;
  nMarkets: number;
  nDisputed: number;
  disputeRate: number;
}

export interface SampleMarket {
  id: string;
  question: string;
  compositeScore: number;
  category?: string;
  resolvedAt?: string;
  disputed: boolean;
}
