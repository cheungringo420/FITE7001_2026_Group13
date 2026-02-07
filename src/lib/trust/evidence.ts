import fs from 'fs/promises';
import path from 'path';
import { EvidenceDataset, EvidenceItemScored, EvidenceSource } from './types';
import { buildMarketKeys, jaccardSimilarity, normalizeText } from './text';

const DATA_DIR = path.join(process.cwd(), 'data', 'evidence');
const SOURCES_PATH = path.join(DATA_DIR, 'sources.json');
const EVIDENCE_PATH = path.join(DATA_DIR, 'evidence.json');
const DEFAULT_RELIABILITY = 0.6;
const MATCH_THRESHOLD = 0.18;

let datasetCache: { data: EvidenceDataset; loadedAt: number } | null = null;

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(contents) as T;
  } catch {
    return fallback;
  }
}

export async function loadEvidenceDataset(): Promise<EvidenceDataset> {
  if (datasetCache) return datasetCache.data;

  const sources = await readJsonFile<EvidenceSource[]>(SOURCES_PATH, []);
  const evidence = await readJsonFile<EvidenceDataset['evidence']>(EVIDENCE_PATH, []);

  const data: EvidenceDataset = { sources, evidence };
  datasetCache = { data, loadedAt: Date.now() };
  return data;
}

export function resetEvidenceCache(): void {
  datasetCache = null;
}

function scoreEvidenceMatch(question: string, evidenceText: string): number {
  const similarity = jaccardSimilarity(question, evidenceText);
  return similarity;
}

function buildSourceMap(sources: EvidenceSource[]): Map<string, EvidenceSource> {
  return new Map(sources.map((source) => [source.id, source]));
}

export async function matchEvidenceForMarket(market: {
  id: string;
  platform: 'polymarket' | 'kalshi';
  question: string;
  category?: string | null;
}): Promise<EvidenceItemScored[]> {
  const dataset = await loadEvidenceDataset();
  const sourceMap = buildSourceMap(dataset.sources);
  const marketKeys = new Set(buildMarketKeys(market));

  const scored: EvidenceItemScored[] = [];

  for (const item of dataset.evidence) {
    const itemKeys = item.marketKeys || [];
    const keyMatch = itemKeys.some((key) => marketKeys.has(key));

    const combinedEvidenceText = `${item.title} ${item.summary}`;
    const similarity = keyMatch
      ? 1
      : scoreEvidenceMatch(market.question, combinedEvidenceText);

    if (!keyMatch && similarity < MATCH_THRESHOLD) continue;

    const source = sourceMap.get(item.sourceId);
    const reliability = source?.reliability ?? DEFAULT_RELIABILITY;
    const weight = reliability * (0.5 + similarity / 2);

    scored.push({
      ...item,
      reliability,
      similarity,
      weight,
    });
  }

  return scored.sort((a, b) => b.weight - a.weight);
}

export function describeEvidenceCoverage(evidence: EvidenceItemScored[]): string {
  if (!evidence.length) return 'No curated evidence matched.';

  const sources = new Set(evidence.map((item) => item.sourceId));
  return `${evidence.length} evidence items from ${sources.size} sources.`;
}

export function normalizeEvidenceKey(input: string): string {
  return normalizeText(input);
}
