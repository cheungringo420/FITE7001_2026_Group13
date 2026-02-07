import fs from 'fs/promises';
import path from 'path';

export type MatchFeedbackStatus = 'mismatch' | 'match';

export interface MatchFeedbackEntry {
  id: string;
  polymarketId: string;
  kalshiId: string;
  status: MatchFeedbackStatus;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

interface MatchFeedbackStore {
  entries: MatchFeedbackEntry[];
}

const DATA_DIR = path.join(process.cwd(), 'data', 'feedback');
const FILE_PATH = path.join(DATA_DIR, 'match-feedback.json');

function buildMatchKey(polymarketId: string, kalshiId: string) {
  return `${polymarketId}|${kalshiId}`;
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadStore(): Promise<MatchFeedbackStore> {
  try {
    const contents = await fs.readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(contents) as MatchFeedbackStore;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return { entries: [] };
  }
}

async function saveStore(store: MatchFeedbackStore): Promise<void> {
  await ensureDir();
  await fs.writeFile(FILE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export async function addMatchFeedback(input: {
  polymarketId: string;
  kalshiId: string;
  status: MatchFeedbackStatus;
  reason?: string;
}): Promise<MatchFeedbackEntry> {
  const store = await loadStore();
  const id = buildMatchKey(input.polymarketId, input.kalshiId);
  const now = new Date().toISOString();

  const existingIndex = store.entries.findIndex((entry) => entry.id === id);
  const nextEntry: MatchFeedbackEntry = {
    id,
    polymarketId: input.polymarketId,
    kalshiId: input.kalshiId,
    status: input.status,
    reason: input.reason,
    createdAt: existingIndex >= 0 ? store.entries[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    store.entries[existingIndex] = nextEntry;
  } else {
    store.entries.push(nextEntry);
  }

  await saveStore(store);
  return nextEntry;
}

export async function listMatchFeedback(): Promise<MatchFeedbackEntry[]> {
  const store = await loadStore();
  return store.entries;
}

export async function getMatchFeedbackMap(): Promise<Record<string, MatchFeedbackEntry>> {
  const store = await loadStore();
  return store.entries.reduce<Record<string, MatchFeedbackEntry>>((acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  }, {});
}

export function getMatchKey(polymarketId: string, kalshiId: string): string {
  return buildMatchKey(polymarketId, kalshiId);
}
