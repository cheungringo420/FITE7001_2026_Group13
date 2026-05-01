export const CORE_POLICY = {
  fetchLimit: 200,
  matching: {
    threshold: 0.5,
    strictThreshold: 0.62,
    minTextSimilarity: 0.2,
    minCategorySimilarity: 0.12,
    minAlignment: 0.35,
  },
  opportunities: {
    minSimilarity: 0.65,
    strictMinSimilarity: 0.72,
    minAlignment: 0.65,
    strictMinAlignment: 0.72,
    minProfitPercentage: 0.5,
    minTrustScore: 30,
  },
  feedback: {
    minVotesToPenalize: 2,
    mismatchPenalty: 0.2,
  },
} as const;
