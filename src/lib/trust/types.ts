export type EvidenceStance = 'support' | 'contradict' | 'neutral';

export interface EvidenceSource {
  id: string;
  name: string;
  reliability: number; // 0-1
  category?: string;
  url?: string;
}

export interface EvidenceItem {
  id: string;
  marketKeys: string[];
  title: string;
  summary: string;
  publishedAt: string; // ISO date string
  sourceId: string;
  stance: EvidenceStance;
  url?: string;
}

export interface EvidenceItemScored extends EvidenceItem {
  reliability: number;
  similarity: number; // 0-1
  weight: number; // reliability * similarity weight
}

export interface ResolutionCriteria {
  hasExplicitDate: boolean;
  hasObjectiveThreshold: boolean;
  hasResolutionWording: boolean;
  ambiguityFlags: string[];
  clarityScore: number; // 0-1
  timeWindow?: {
    raw?: string;
    start?: string;
    end?: string;
  };
}

export interface ResolutionAlignmentBreakdown {
  score: number; // 0-1
  criteria: {
    explicitDate: { polymarket: boolean; kalshi: boolean; match: boolean };
    objectiveThreshold: { polymarket: boolean; kalshi: boolean; match: boolean };
    resolutionWording: { polymarket: boolean; kalshi: boolean; match: boolean };
    timeWindow: { polymarket?: string; kalshi?: string; match: boolean };
    ambiguityFlags: { polymarket: string[]; kalshi: string[]; match: boolean };
  };
  clarity: { polymarket: number; kalshi: number };
}

export interface TrustMetrics {
  trustScore: number; // 0-100
  resolutionConfidence: number; // 0-100
  disputeRisk: number; // 0-100
  integrityRisk: number; // 0-100
  evidenceCount: number;
}

export interface TrustAnalysis extends TrustMetrics {
  criteria: ResolutionCriteria;
  evidence: EvidenceItemScored[];
  consensusScore: number; // 0-1
  agreementScore: number; // 0-1
}

export interface TrustSummaryItem extends TrustMetrics {
  marketId: string;
  platform: 'polymarket' | 'kalshi';
  question: string;
  category?: string;
  updatedAt: string;
}

export interface EvidenceDataset {
  sources: EvidenceSource[];
  evidence: EvidenceItem[];
}
