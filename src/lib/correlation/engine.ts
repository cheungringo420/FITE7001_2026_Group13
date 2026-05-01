// Cross-Event Correlation Engine
// Detects logical linkages between prediction market events
// and identifies mispricing based on macroeconomic transmission mechanisms

import { NormalizedMarket } from '../kalshi/types';
import {
    CorrelationLink,
    CorrelationChain,
    CorrelationTemplate,
    CorrelationCategory,
    MispricingSignal,
    CorrelationScanResult,
} from './types';

// Pre-defined correlation templates for common macro chains
const CORRELATION_TEMPLATES: CorrelationTemplate[] = [
    // Japan political → currency
    {
        name: 'Japan Election → JPY',
        region: 'Japan',
        category: 'political→currency',
        direction: 'positive',
        keywordPairsA: [['japan', 'election'], ['ldp', 'majority'], ['takaichi'], ['japan', 'prime minister']],
        keywordPairsB: [['usd', 'jpy'], ['yen', 'depreci'], ['jpy', 'hit']],
        mechanism: 'Election victory → fiscal easing mandate → slower BOJ hikes → JPY depreciation',
        expectedStrength: 0.7,
    },
    {
        name: 'Japan Election → BOJ Policy',
        region: 'Japan',
        category: 'political→economic',
        direction: 'negative',
        keywordPairsA: [['japan', 'election'], ['ldp', 'win'], ['takaichi']],
        keywordPairsB: [['bank of japan'], ['boj', 'rate'], ['japan', 'interest rate']],
        mechanism: 'Strong LDP victory → fiscal expansion → slower BOJ rate hikes',
        expectedStrength: 0.65,
    },
    // US political → economic
    {
        name: 'US Election → Fed Policy',
        region: 'US',
        category: 'political→economic',
        direction: 'positive',
        keywordPairsA: [['trump', 'president'], ['trump', 'win'], ['trump', 'election']],
        keywordPairsB: [['fed', 'rate'], ['federal reserve'], ['interest rate', 'cut']],
        mechanism: 'Election outcome → fiscal policy shift → Fed response',
        expectedStrength: 0.55,
    },
    {
        name: 'US Election → Tariffs → Market',
        region: 'US',
        category: 'political→economic',
        direction: 'positive',
        keywordPairsA: [['trump', 'tariff'], ['trade war'], ['china', 'tariff']],
        keywordPairsB: [['recession'], ['gdp', 'growth'], ['s&p', 'decline'], ['market', 'crash']],
        mechanism: 'Tariff escalation → trade disruption → economic slowdown risk',
        expectedStrength: 0.5,
    },
    // Economic → currency
    {
        name: 'Fed Rate → USD Strength',
        region: 'US',
        category: 'rates→currency',
        direction: 'positive',
        keywordPairsA: [['fed', 'rate'], ['federal reserve', 'hike'], ['interest rate', 'increase']],
        keywordPairsB: [['usd', 'strength'], ['dollar', 'index'], ['dxy']],
        mechanism: 'Higher rates → increased USD demand → dollar appreciation',
        expectedStrength: 0.7,
    },
    // Geopolitical → market
    {
        name: 'China-Taiwan → Market Volatility',
        region: 'Asia-Pacific',
        category: 'geopolitical→market',
        direction: 'positive',
        keywordPairsA: [['china', 'taiwan'], ['china', 'military'], ['taiwan', 'invasion'], ['strait']],
        keywordPairsB: [['vix'], ['market', 'crash'], ['volatility'], ['gold', 'price']],
        mechanism: 'Geopolitical escalation → risk-off sentiment → volatility spike',
        expectedStrength: 0.6,
    },
    {
        name: 'Russia-Ukraine → Energy Prices',
        region: 'Europe',
        category: 'geopolitical→market',
        direction: 'positive',
        keywordPairsA: [['russia', 'ukraine'], ['war', 'escalat'], ['nato', 'russia']],
        keywordPairsB: [['oil', 'price'], ['gas', 'price'], ['energy', 'crisis'], ['brent']],
        mechanism: 'Conflict escalation → energy supply disruption → commodity price spike',
        expectedStrength: 0.65,
    },
    // Same-event variant detection
    {
        name: 'Bitcoin Price Milestones',
        region: 'Global',
        category: 'same-event-variants',
        direction: 'positive',
        keywordPairsA: [['bitcoin', '100'], ['btc', '100k'], ['bitcoin', 'ath']],
        keywordPairsB: [['bitcoin', '150'], ['btc', '200k'], ['crypto', 'market cap']],
        mechanism: 'Correlated price targets — lower milestone should have higher probability',
        expectedStrength: 0.8,
    },
];

/**
 * Check if a market question matches keyword pairs.
 * At least one pair must fully match (all keywords in the pair present).
 */
function matchesKeywordPairs(question: string, keywordPairs: string[][]): boolean {
    const lower = question.toLowerCase();
    return keywordPairs.some(pair =>
        pair.every(keyword => lower.includes(keyword.toLowerCase()))
    );
}

/**
 * Calculate correlation strength between two markets based on template match.
 */
function calculateCorrelationStrength(
    marketA: NormalizedMarket,
    marketB: NormalizedMarket,
    template: CorrelationTemplate
): number {
    let strength = template.expectedStrength;

    // Boost if both markets are high-volume (more reliable signal)
    const avgVolume = ((marketA.volume24h || 0) + (marketB.volume24h || 0)) / 2;
    if (avgVolume > 50000) strength = Math.min(1, strength + 0.1);
    else if (avgVolume < 5000) strength = Math.max(0.2, strength - 0.15);

    // Boost if probabilities are extreme (clearer signal)
    const extremeA = Math.abs(marketA.yesPrice - 0.5);
    const extremeB = Math.abs(marketB.yesPrice - 0.5);
    if (extremeA > 0.3 || extremeB > 0.3) strength = Math.min(1, strength + 0.05);

    return Math.round(strength * 100) / 100;
}

/**
 * Detect mispricing between two correlated events.
 */
function detectMispricing(
    marketA: NormalizedMarket,
    marketB: NormalizedMarket,
    template: CorrelationTemplate
): MispricingSignal | undefined {
    const probA = marketA.yesPrice;
    const probB = marketB.yesPrice;

    // For positive correlation: if A is very likely, B should also trend likely
    // For negative correlation: if A is very likely, B should be less likely
    let expectedBGivenA: number;
    if (template.direction === 'positive') {
        expectedBGivenA = 0.3 + probA * 0.5; // rough heuristic
    } else {
        expectedBGivenA = 0.7 - probA * 0.5;
    }

    const divergence = Math.abs(probB - expectedBGivenA);

    // Only flag if divergence is significant (>15 percentage points)
    if (divergence < 0.15) return undefined;

    const isAOverpriced = template.direction === 'positive'
        ? probA > 0.6 && probB < 0.3
        : probA > 0.6 && probB > 0.6;

    const isBOverpriced = template.direction === 'positive'
        ? probA < 0.3 && probB > 0.6
        : probA < 0.3 && probB < 0.3;

    const direction = isAOverpriced
        ? 'event-a-overpriced' as const
        : isBOverpriced
            ? 'event-b-overpriced' as const
            : 'both-misaligned' as const;

    const confidence = divergence > 0.3 ? 'high' : divergence > 0.2 ? 'medium' : 'low';

    const suggestedAction = template.direction === 'positive'
        ? probA > probB
            ? `Buy "${marketB.question.slice(0, 50)}..." (underpriced relative to Event A)`
            : `Buy "${marketA.question.slice(0, 50)}..." (underpriced relative to Event B)`
        : `Monitor for convergence — probabilities should move in opposite directions`;

    return {
        divergence: Math.round(divergence * 100),
        direction,
        confidence,
        suggestedAction,
        expectedConvergence: template.mechanism,
    };
}

/**
 * Find all correlations between markets using templates.
 */
export function findCorrelations(markets: NormalizedMarket[]): CorrelationLink[] {
    const links: CorrelationLink[] = [];

    for (const template of CORRELATION_TEMPLATES) {
        const groupA: NormalizedMarket[] = [];
        const groupB: NormalizedMarket[] = [];

        for (const market of markets) {
            if (matchesKeywordPairs(market.question, template.keywordPairsA)) {
                groupA.push(market);
            }
            if (matchesKeywordPairs(market.question, template.keywordPairsB)) {
                groupB.push(market);
            }
        }

        // Create links between matched groups
        for (const a of groupA) {
            for (const b of groupB) {
                // Skip self-matches
                if (a.id === b.id) continue;

                const strength = calculateCorrelationStrength(a, b, template);
                const mispricing = detectMispricing(a, b, template);

                links.push({
                    eventA: {
                        marketId: a.id,
                        question: a.question,
                        platform: a.platform as 'polymarket' | 'kalshi',
                        probability: a.yesPrice,
                    },
                    eventB: {
                        marketId: b.id,
                        question: b.question,
                        platform: b.platform as 'polymarket' | 'kalshi',
                        probability: b.yesPrice,
                    },
                    direction: template.direction,
                    strength,
                    mechanism: template.mechanism,
                    category: template.category,
                    mispricing,
                });
            }
        }
    }

    // Sort by strength descending, then by mispricing signal
    links.sort((a, b) => {
        if (a.mispricing && !b.mispricing) return -1;
        if (!a.mispricing && b.mispricing) return 1;
        return b.strength - a.strength;
    });

    return links;
}

/**
 * Group correlations into chains (multi-hop correlations).
 */
export function buildCorrelationChains(links: CorrelationLink[]): CorrelationChain[] {
    const chains: CorrelationChain[] = [];
    const regionGroups = new Map<string, CorrelationLink[]>();

    // Group by template region via category pattern
    for (const link of links) {
        const region = guessRegion(link);
        const existing = regionGroups.get(region) || [];
        existing.push(link);
        regionGroups.set(region, existing);
    }

    let chainId = 0;
    for (const [region, regionLinks] of regionGroups) {
        const totalDivergence = regionLinks.reduce(
            (sum, l) => sum + (l.mispricing?.divergence || 0), 0
        );
        const mispricingCount = regionLinks.filter(l => l.mispricing).length;

        chains.push({
            id: `chain-${chainId++}`,
            name: `${region} Macro Chain`,
            region,
            links: regionLinks,
            totalDivergence,
            opportunity: mispricingCount > 0 && totalDivergence > 20,
            detectedAt: Date.now(),
        });
    }

    // Sort by opportunity first, then by total divergence
    chains.sort((a, b) => {
        if (a.opportunity && !b.opportunity) return -1;
        if (!a.opportunity && b.opportunity) return 1;
        return b.totalDivergence - a.totalDivergence;
    });

    return chains;
}

function guessRegion(link: CorrelationLink): string {
    const text = (link.eventA.question + ' ' + link.eventB.question).toLowerCase();
    if (text.includes('japan') || text.includes('jpy') || text.includes('boj') || text.includes('ldp')) return 'Japan';
    if (text.includes('china') || text.includes('taiwan')) return 'Asia-Pacific';
    if (text.includes('russia') || text.includes('ukraine') || text.includes('eu')) return 'Europe';
    if (text.includes('bitcoin') || text.includes('btc') || text.includes('crypto')) return 'Crypto';
    return 'US';
}

/**
 * Full correlation scan: find links, build chains, compute stats.
 */
export function scanCorrelations(markets: NormalizedMarket[]): CorrelationScanResult {
    const pairs = findCorrelations(markets);
    const chains = buildCorrelationChains(pairs);
    const mispricingsDetected = pairs.filter(p => p.mispricing).length;

    return {
        chains,
        pairs,
        totalMarketsScanned: markets.length,
        correlationsFound: pairs.length,
        mispricingsDetected,
        scannedAt: new Date().toISOString(),
    };
}
