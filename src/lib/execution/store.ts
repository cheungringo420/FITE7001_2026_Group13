import { ExecutionQuote, ExecutionRecord } from './types';

const quoteStore = new Map<string, { quote: ExecutionQuote; expiresAt: number }>();
const executionStore = new Map<string, ExecutionRecord>();

export function saveQuote(quote: ExecutionQuote, ttlMs: number) {
  quoteStore.set(quote.quoteId, { quote, expiresAt: Date.now() + ttlMs });
}

export function getQuote(quoteId: string): ExecutionQuote | null {
  const entry = quoteStore.get(quoteId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    quoteStore.delete(quoteId);
    return null;
  }
  return entry.quote;
}

export function saveExecution(record: ExecutionRecord) {
  executionStore.set(record.executionId, record);
}

export function getExecution(executionId: string): ExecutionRecord | null {
  return executionStore.get(executionId) || null;
}

export function updateExecution(executionId: string, patch: Partial<ExecutionRecord>): ExecutionRecord | null {
  const existing = executionStore.get(executionId);
  if (!existing) return null;
  const updated: ExecutionRecord = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  executionStore.set(executionId, updated);
  return updated;
}
