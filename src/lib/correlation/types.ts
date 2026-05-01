// Cross-Event Correlation Types

export interface CorrelationLink {
    eventA: {
        marketId: string;
        question: string;
        platform: 'polymarket' | 'kalshi';
        probability: number;
    };
    eventB: {
        marketId: string;
        question: string;
        platform: 'polymarket' | 'kalshi';
        probability: number;
    };
    direction: 'positive' | 'negative' | 'neutral';
    strength: number; // 0-1
    mechanism: string; // e.g., "Election outcome → fiscal policy → currency depreciation"
    category: CorrelationCategory;
    mispricing?: MispricingSignal;
}

export type CorrelationCategory =
    | 'political→economic'
    | 'political→currency'
    | 'economic→currency'
    | 'economic→asset'
    | 'geopolitical→market'
    | 'policy→rates'
    | 'rates→currency'
    | 'same-event-variants';

export interface MispricingSignal {
    divergence: number; // percentage points
    direction: 'event-a-overpriced' | 'event-b-overpriced' | 'both-misaligned';
    confidence: 'high' | 'medium' | 'low';
    suggestedAction: string;
    expectedConvergence: string; // e.g., "Event A probability should decrease as Event B rises"
}

export interface CorrelationChain {
    id: string;
    name: string; // e.g., "Japan Political→Economic→Currency"
    region: string;
    links: CorrelationLink[];
    totalDivergence: number;
    opportunity: boolean;
    detectedAt: number;
}

export interface CorrelationTemplate {
    name: string;
    region: string;
    category: CorrelationCategory;
    direction: 'positive' | 'negative';
    keywordPairsA: string[][]; // Keywords that identify Event A
    keywordPairsB: string[][]; // Keywords that identify Event B
    mechanism: string;
    expectedStrength: number;
}

export interface CorrelationScanResult {
    chains: CorrelationChain[];
    pairs: CorrelationLink[];
    totalMarketsScanned: number;
    correlationsFound: number;
    mispricingsDetected: number;
    scannedAt: string;
}
