import { ResolutionCriteria } from './types';
import { normalizeText } from './text';

const AMBIGUITY_TERMS = [
  'likely',
  'significant',
  'major',
  'substantial',
  'meaningful',
  'material',
  'sharp',
  'soon',
  'unexpected',
  'surge',
  'crash',
  'notable',
  'considerable',
  'rapid',
  'dramatic'
];

const RESOLUTION_TERMS = [
  'will',
  'by',
  'before',
  'after',
  'as of',
  'on',
  'at close',
  'settle',
  'official',
  'according to'
];

const THRESHOLD_TERMS = [
  'above',
  'below',
  'greater than',
  'less than',
  'at least',
  'at most',
  'reach',
  'exceed'
];

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function extractTimeWindow(text: string): ResolutionCriteria['timeWindow'] {
  const lower = text.toLowerCase();

  const monthRegex = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?/i;
  const yearRegex = /\b20[2-3]\d\b/;
  const monthMatch = lower.match(monthRegex);
  const yearMatch = lower.match(yearRegex);

  if (!monthMatch && !yearMatch) return undefined;

  const raw = monthMatch ? monthMatch[0] : yearMatch ? yearMatch[0] : undefined;
  return { raw };
}

export function extractResolutionCriteria(question: string, description?: string): ResolutionCriteria {
  const combined = `${question} ${description || ''}`.trim();
  const lower = combined.toLowerCase();
  const normalized = normalizeText(combined);

  const hasExplicitDate = /\b(20[2-3]\d)\b/.test(lower) || /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(lower);

  const hasObjectiveThreshold = THRESHOLD_TERMS.some((term) => lower.includes(term)) ||
    /\b\d+(?:\.\d+)?\s*(%|bps|billion|million|trillion|k|m|b|usd|\$)\b/i.test(lower);

  const hasResolutionWording = RESOLUTION_TERMS.some((term) => lower.includes(term));

  const ambiguityFlags = AMBIGUITY_TERMS.filter((term) => normalized.includes(term));

  let score = 0.5;
  if (hasExplicitDate) score += 0.2;
  if (hasObjectiveThreshold) score += 0.2;
  if (hasResolutionWording) score += 0.1;
  if (ambiguityFlags.length > 0) score -= 0.2;

  return {
    hasExplicitDate,
    hasObjectiveThreshold,
    hasResolutionWording,
    ambiguityFlags,
    clarityScore: clamp(score),
    timeWindow: extractTimeWindow(combined),
  };
}
