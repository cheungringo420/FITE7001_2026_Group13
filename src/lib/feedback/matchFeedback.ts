import fs from 'fs/promises';
import path from 'path';
import { MatchFeedbackEvent } from '@/lib/core/types';

export type MatchFeedbackStatus = 'mismatch' | 'match';

export type MatchFeedbackEntry = MatchFeedbackEvent;

interface MatchFeedbackStore {
  entries: MatchFeedbackEntry[];
}

const DATA_DIR = path.join(process.cwd(), 'data', 'feedback');
const FILE_PATH = path.join(DATA_DIR, 'match-feedback.json');

function buildMatchKey(polymarketId: string, kalshiId: string) {
  return `${polymarketId}|${kalshiId}`;
}

function computeStatus(votes: { match: number; mismatch: number }): MatchFeedbackStatus {
  return votes.mismatch >= votes.match ? 'mismatch' : 'match';
}

function normalizeEntry(entry: Partial<MatchFeedbackEntry>): MatchFeedbackEntry | null {
  if (!entry.polymarketId || !entry.kalshiId) return null;

  const id = entry.id || buildMatchKey(entry.polymarketId, entry.kalshiId);
  const votes = entry.votes || {
    match: entry.status === 'match' ? 1 : 0,
    mismatch: entry.status === 'mismatch' ? 1 : 0,
  };
  const createdAt = entry.createdAt || new Date().toISOString();
  const updatedAt = entry.updatedAt || createdAt;

  return {
    id,
    polymarketId: entry.polymarketId,
    kalshiId: entry.kalshiId,
    status: computeStatus(votes),
    votes,
    reason: entry.reason,
    createdAt,
    updatedAt,
  };
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadStore(): Promise<MatchFeedbackStore> {
  try {
    const contents = await fs.readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(contents) as MatchFeedbackStore;
    const entries = (Array.isArray(parsed.entries) ? parsed.entries : [])
      .map((entry) => normalizeEntry(entry))
      .filter((entry): entry is MatchFeedbackEntry => entry !== null);
    return { entries };
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
  const existing = existingIndex >= 0 ? store.entries[existingIndex] : null;
  const votes = {
    match: existing?.votes.match ?? 0,
    mismatch: existing?.votes.mismatch ?? 0,
  };
  votes[input.status] += 1;

  const nextEntry: MatchFeedbackEntry = {
    id,
    polymarketId: input.polymarketId,
    kalshiId: input.kalshiId,
    status: computeStatus(votes),
    votes,
    reason: input.reason ?? existing?.reason,
    createdAt: existing?.createdAt ?? now,
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
  return store.entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
