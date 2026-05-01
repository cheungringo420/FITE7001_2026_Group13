import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export type TrustFeedbackType =
  | 'trust-agree'
  | 'trust-disagree'
  | 'evidence-helpful'
  | 'evidence-misleading'
  | 'report-issue';

export interface TrustFeedbackEntry {
  id: string;
  marketId: string;
  platform: 'polymarket' | 'kalshi';
  feedbackType: TrustFeedbackType;
  comment?: string;
  submittedAt: string;
}

interface TrustFeedbackStore {
  entries: TrustFeedbackEntry[];
}

const DATA_DIR = path.join(process.cwd(), 'data', 'feedback');
const FILE_PATH = path.join(DATA_DIR, 'trust-feedback.json');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadStore(): Promise<TrustFeedbackStore> {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as TrustFeedbackStore;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return { entries: [] };
  }
}

async function saveStore(store: TrustFeedbackStore): Promise<void> {
  await ensureDir();
  await fs.writeFile(FILE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export async function addTrustFeedback(input: Omit<TrustFeedbackEntry, 'id' | 'submittedAt'>): Promise<TrustFeedbackEntry> {
  const store = await loadStore();
  const entry: TrustFeedbackEntry = {
    id: `fb-${randomUUID()}`,
    marketId: input.marketId,
    platform: input.platform,
    feedbackType: input.feedbackType,
    comment: input.comment,
    submittedAt: new Date().toISOString(),
  };
  store.entries.push(entry);
  await saveStore(store);
  return entry;
}

export async function listTrustFeedback(filter?: {
  marketId?: string;
  platform?: 'polymarket' | 'kalshi';
}): Promise<TrustFeedbackEntry[]> {
  const store = await loadStore();
  return store.entries.filter((entry) => {
    if (filter?.marketId && entry.marketId !== filter.marketId) return false;
    if (filter?.platform && entry.platform !== filter.platform) return false;
    return true;
  });
}
