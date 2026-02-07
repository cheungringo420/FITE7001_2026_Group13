const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'by', 'at',
  'is', 'are', 'be', 'will', 'would', 'should', 'could', 'as', 'from', 'about',
  'this', 'that', 'these', 'those', 'it', 'its', 'into', 'over', 'under'
]);

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeKey(input: string): string {
  return normalizeText(input).replace(/\s+/g, '-');
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  if (!normalized) return [];
  return normalized
    .split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function buildMarketKeys(market: {
  id: string;
  platform: 'polymarket' | 'kalshi';
  question: string;
  category?: string | null;
}): string[] {
  const keys: string[] = [];

  keys.push(`platform:${market.platform}:${market.id}`);
  keys.push(`question:${normalizeText(market.question)}`);

  if (market.category) {
    keys.push(`category:${normalizeKey(market.category)}`);
  }

  return keys;
}
