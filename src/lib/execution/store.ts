import fs from 'fs';
import path from 'path';
import { ExecutionQuote, ExecutionRecord } from './types';

interface QuoteEntry {
  quote: ExecutionQuote;
  expiresAt: number;
}

interface PersistentExecutionStore {
  quotes: Record<string, QuoteEntry>;
  executions: Record<string, ExecutionRecord>;
  idempotency: Record<string, string>;
}

const STORE_FILE = path.join(process.cwd(), 'data', 'execution', 'store.json');

let store: PersistentExecutionStore | null = null;

function ensureStoreDir() {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
}

function loadStore(): PersistentExecutionStore {
  if (store) return store;

  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistentExecutionStore>;
    store = {
      quotes: parsed.quotes ?? {},
      executions: parsed.executions ?? {},
      idempotency: parsed.idempotency ?? {},
    };
  } catch {
    store = { quotes: {}, executions: {}, idempotency: {} };
  }

  return store;
}

function persistStore() {
  ensureStoreDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(loadStore(), null, 2), 'utf8');
}

function cleanupExpiredQuotes(now = Date.now()) {
  const state = loadStore();
  let changed = false;
  for (const [quoteId, entry] of Object.entries(state.quotes)) {
    if (now > entry.expiresAt) {
      delete state.quotes[quoteId];
      changed = true;
    }
  }
  if (changed) persistStore();
}

export function saveQuote(quote: ExecutionQuote, ttlMs: number) {
  const state = loadStore();
  state.quotes[quote.quoteId] = { quote, expiresAt: Date.now() + ttlMs };
  persistStore();
}

export function getQuote(quoteId: string): ExecutionQuote | null {
  cleanupExpiredQuotes();
  const state = loadStore();
  const entry = state.quotes[quoteId];
  if (!entry) return null;
  return entry.quote;
}

export function saveExecution(record: ExecutionRecord) {
  const state = loadStore();
  state.executions[record.executionId] = record;
  persistStore();
}

export function getExecution(executionId: string): ExecutionRecord | null {
  const state = loadStore();
  return state.executions[executionId] ?? null;
}

export function updateExecution(executionId: string, patch: Partial<ExecutionRecord>): ExecutionRecord | null {
  const state = loadStore();
  const existing = state.executions[executionId];
  if (!existing) return null;

  const updated: ExecutionRecord = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  state.executions[executionId] = updated;
  persistStore();
  return updated;
}

export function getExecutionByIdempotencyKey(key: string): ExecutionRecord | null {
  const state = loadStore();
  const executionId = state.idempotency[key];
  if (!executionId) return null;
  return state.executions[executionId] ?? null;
}

export function saveIdempotencyKey(key: string, executionId: string) {
  const state = loadStore();
  state.idempotency[key] = executionId;
  persistStore();
}
