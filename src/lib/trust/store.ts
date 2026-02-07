import { TrustAnalysis, TrustSummaryItem } from './types';

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const summaryCache = new Map<string, CacheEntry<TrustSummaryItem[]>>();
const analysisCache = new Map<string, CacheEntry<TrustAnalysis>>();

function isValid<T>(entry?: CacheEntry<T>): entry is CacheEntry<T> {
  return Boolean(entry && Date.now() < entry.expiresAt);
}

export function getCachedSummary(key: string): TrustSummaryItem[] | null {
  const entry = summaryCache.get(key);
  if (!isValid(entry)) return null;
  return entry.value;
}

export function setCachedSummary(key: string, value: TrustSummaryItem[], ttlMs: number): void {
  summaryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function getCachedAnalysis(key: string): TrustAnalysis | null {
  const entry = analysisCache.get(key);
  if (!isValid(entry)) return null;
  return entry.value;
}

export function setCachedAnalysis(key: string, value: TrustAnalysis, ttlMs: number): void {
  analysisCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearTrustCaches(): void {
  summaryCache.clear();
  analysisCache.clear();
}
