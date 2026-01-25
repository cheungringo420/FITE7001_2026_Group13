// Arbitrage Detection Engine

import { NormalizedMarket, ArbitrageOpportunity } from '../kalshi/types';
import { ParsedMarket } from '../polymarket/types';

/**
 * Normalize a Polymarket market to cross-platform format
 */
export function normalizePolymarketMarket(market: ParsedMarket): NormalizedMarket {
    // Build Polymarket URL - prefer event slug if available, otherwise use market slug
    const eventSlug = market.events?.[0]?.slug;
    const polymarketUrl = eventSlug 
        ? `https://polymarket.com/event/${eventSlug}`
        : `https://polymarket.com/event/${market.slug}`;

    return {
        id: market.conditionId,
        platform: 'polymarket',
        question: market.question,
        description: market.description,
        category: market.category || 'General',
        yesPrice: market.outcomePrices[0] || 0.5,
        noPrice: market.outcomePrices[1] || 0.5,
        volume: parseFloat(market.volume) || 0,
        volume24h: market.volume24hr || 0,
        liquidity: parseFloat(market.liquidity) || 0,
        status: market.closed ? 'closed' : market.active ? 'active' : 'settled',
        endDate: market.endDate,
        url: polymarketUrl,
        originalData: market,
    };
}

// --- Matching Logic Helpers ---

const ENTITY_WEIGHT = 0.4;
const JACCARD_WEIGHT = 0.4;
const DATE_WEIGHT = 0.1;
const TOPIC_WEIGHT = 0.1;

// Key topics/entities that indicate similar markets if both contain them
const KEY_TOPICS = [
    'trump', 'biden', 'elon', 'musk', 'doge', 'spacex', 'tesla',
    'fed', 'interest rate', 'inflation', 'gdp', 'recession', 'unemployment',
    'election', 'president', 'congress', 'senate', 'house', 'supreme court',
    'pope', 'china', 'russia', 'ukraine', 'israel', 'iran',
    'ai', 'openai', 'anthropic', 'chatgpt', 'gpt',
    'bitcoin', 'crypto', 'ethereum',
    'mars', 'nasa', 'moon',
    'oscar', 'emmy', 'grammy', 'super bowl',
    'deportation', 'immigration', 'border',
    'tariff', 'trade war',
];

function extractEntities(text: string): Set<string> {
    const entities = new Set<string>();

    // Numbers with units or qualifiers (e.g. 25bps, $100M, 50+)
    const numberMatches = text.match(/\b\d+(\.\d+)?[a-z%+]*/gi);
    if (numberMatches) numberMatches.forEach(m => entities.add(m.toLowerCase()));

    // Dates (Month Year, Month Day)
    const dateMatches = text.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,4}/gi);
    if (dateMatches) dateMatches.forEach(m => entities.add(m.toLowerCase()));

    // Year mentions (2024, 2025, 2026, etc.)
    const yearMatches = text.match(/\b20[2-3]\d\b/g);
    if (yearMatches) yearMatches.forEach(m => entities.add(m));

    // Proper Nouns / Capitalized words (excluding common stop words)
    const properNounMatches = text.match(/\b[A-Z][a-z]+(\s+[A-Z][a-z]+)*\b/g);
    if (properNounMatches) {
        properNounMatches.forEach(m => {
            if (!['The', 'Will', 'Who', 'What', 'After', 'Before', 'When', 'How', 'Which'].includes(m)) {
                entities.add(m.toLowerCase());
            }
        });
    }

    return entities;
}

function extractKeyTopics(text: string): Set<string> {
    const lowerText = text.toLowerCase();
    const found = new Set<string>();
    for (const topic of KEY_TOPICS) {
        if (lowerText.includes(topic)) {
            found.add(topic);
        }
    }
    return found;
}

function normalizeText(text: string): string {
    if (!text) return '';
    return text.toLowerCase()
        // Generic normalizations
        .replace(/basis points?/g, 'bps')
        .replace(/fed rate/g, 'fed interest rate')
        .replace(/federal reserve/g, 'fed')
        .replace(/fomc/g, 'fed')
        .replace(/united states/g, 'us')
        .replace(/u\.s\./g, 'us')
        .replace(/presidential election/g, 'election')
        .replace(/president of the united states/g, 'president')
        .replace(/wins?/g, 'win')
        .replace(/outcome/g, '')
        .replace(/elon musk/g, 'elon')
        .replace(/donald trump/g, 'trump')
        .replace(/joe biden/g, 'biden')
        // Formatting
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculate similarity score between two market questions
 * Uses Jaccard similarity + Entity Extraction + Date Matching + Key Topic Matching
 */
export function calculateSimilarity(question1: string, question2: string): number {
    const q1Norm = normalizeText(question1);
    const q2Norm = normalizeText(question2);

    // 1. Jaccard on normalized text
    const words1 = new Set(q1Norm.split(' ').filter(w => w.length > 2));
    const words2 = new Set(q2Norm.split(' ').filter(w => w.length > 2));

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    const jaccardScore = intersection / union;

    // 2. Entity Matching
    const entities1 = extractEntities(question1);
    const entities2 = extractEntities(question2);

    let entityScore = 0;
    if (entities1.size > 0 && entities2.size > 0) {
        const entityIntersection = [...entities1].filter(e => entities2.has(e)).length;
        const entityUnion = new Set([...entities1, ...entities2]).size;
        entityScore = entityIntersection / entityUnion;
    } else if (entities1.size === 0 && entities2.size === 0) {
        entityScore = 0.5; // Both have no entities, neutral
    } else {
        entityScore = 0; // One has entities, the other doesn't mismatch
    }

    // 3. Key topic matching (important political/event topics)
    const topics1 = extractKeyTopics(question1);
    const topics2 = extractKeyTopics(question2);

    let topicScore = 0;
    if (topics1.size > 0 && topics2.size > 0) {
        const topicIntersection = [...topics1].filter(t => topics2.has(t)).length;
        if (topicIntersection > 0) {
            // If they share key topics, boost the score significantly
            topicScore = topicIntersection / Math.min(topics1.size, topics2.size);
        }
    }

    // 3. Date Matching (heuristic: if both contain month names, they must match)
    // Using simple string check for months
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const q1Months = months.filter(m => q1Norm.includes(m));
    const q2Months = months.filter(m => q2Norm.includes(m));

    let dateScore = 1;
    if (q1Months.length > 0 && q2Months.length > 0) {
        // If they share common months, full score. If disjoint sets of months, 0 score.
        const commonMonths = q1Months.filter(m => q2Months.includes(m));
        if (commonMonths.length === 0) {
            dateScore = 0; // Critical mismatch!
        }
    }

    // Weighted Total
    // If date mismatch, reduce the score significantly but don't kill it
    if (dateScore === 0 && topicScore < 0.5) return 0;

    let totalScore = (jaccardScore * JACCARD_WEIGHT) + (entityScore * ENTITY_WEIGHT) + (dateScore * DATE_WEIGHT) + (topicScore * TOPIC_WEIGHT);

    // Boost for very high Jaccard (near identical)
    if (jaccardScore > 0.7) totalScore = Math.max(totalScore, 0.85);

    // Boost if they share multiple key topics
    if (topicScore > 0.5) totalScore = Math.max(totalScore, totalScore * 1.3);

    return Math.min(totalScore, 1.0);
}

/**
 * Find matching markets between Polymarket and Kalshi
 */
export function findMatchingMarkets(
    polymarketMarkets: NormalizedMarket[],
    kalshiMarkets: NormalizedMarket[],
    similarityThreshold = 0.4
): Array<{ polymarket: NormalizedMarket; kalshi: NormalizedMarket; similarity: number }> {
    const matches: Array<{ polymarket: NormalizedMarket; kalshi: NormalizedMarket; similarity: number }> = [];

    for (const pm of polymarketMarkets) {
        for (const km of kalshiMarkets) {
            const similarity = calculateSimilarity(pm.question, km.question);

            if (similarity >= similarityThreshold) {
                matches.push({
                    polymarket: pm,
                    kalshi: km,
                    similarity,
                });
            }
        }
    }

    // Sort by similarity descending
    return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Detect arbitrage opportunity between two markets
 * Arbitrage exists when: yes_price_A + no_price_B < 1 (or vice versa)
 * 
 * Example: If Polymarket Yes = 0.45 and Kalshi No = 0.52
 * Total cost = 0.45 + 0.52 = 0.97
 * Guaranteed payout = 1.00
 * Profit = 0.03 (3.1% return)
 */
/**
 * Validate that a market has valid price data
 */
export function isValidMarket(market: NormalizedMarket): boolean {
    // Prices must be between 0.01 and 0.99 (1% to 99%)
    const validYes = market.yesPrice >= 0.01 && market.yesPrice <= 0.99;
    const validNo = market.noPrice >= 0.01 && market.noPrice <= 0.99;
    // Yes + No should be close to 1 (allowing for spread)
    const sumValid = (market.yesPrice + market.noPrice) >= 0.9 && (market.yesPrice + market.noPrice) <= 1.1;
    return validYes && validNo && sumValid;
}

export function detectArbitrage(
    market1: NormalizedMarket,
    market2: NormalizedMarket
): ArbitrageOpportunity | null {
    // Validate both markets have valid prices
    if (!isValidMarket(market1) || !isValidMarket(market2)) {
        return null;
    }

    // Strategy 1: Buy YES on market1, buy NO on market2
    const strategy1Cost = market1.yesPrice + market2.noPrice;

    // Strategy 2: Buy NO on market1, buy YES on market2
    const strategy2Cost = market1.noPrice + market2.yesPrice;

    // Find the best strategy
    const bestCost = Math.min(strategy1Cost, strategy2Cost);
    const useStrategy1 = strategy1Cost <= strategy2Cost;

    // Arbitrage exists if total cost < 1 (we pay less than $1 for a guaranteed $1 payout)
    if (bestCost >= 1) {
        return null;
    }

    // Filter out opportunities that are too small (< 0.5% profit)
    const guaranteedProfit = 1 - bestCost;
    const profitPercentage = (guaranteedProfit / bestCost) * 100;

    if (profitPercentage < 0.5) {
        return null;
    }

    return {
        id: `${market1.id}-${market2.id}-${Date.now()}`,
        question: market1.question,
        type: market1.platform !== market2.platform ? 'cross-platform' : 'single-platform',
        strategy: useStrategy1 ? 'buy-yes-a-no-b' : 'buy-no-a-yes-b',
        platform1: {
            name: market1.platform,
            marketId: market1.id,
            yesPrice: market1.yesPrice,
            noPrice: market1.noPrice,
        },
        platform2: {
            name: market2.platform,
            marketId: market2.id,
            yesPrice: market2.yesPrice,
            noPrice: market2.noPrice,
        },
        profitPercentage,
        totalCost: bestCost,
        guaranteedProfit,
        detectedAt: new Date().toISOString(),
    };
}

/**
 * Scan all matched markets for arbitrage opportunities
 */
export function scanForArbitrage(
    matches: Array<{ polymarket: NormalizedMarket; kalshi: NormalizedMarket; similarity: number }>
): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    for (const match of matches) {
        const opportunity = detectArbitrage(match.polymarket, match.kalshi);
        if (opportunity) {
            opportunities.push(opportunity);
        }
    }

    // Sort by profit percentage descending
    return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
}

/**
 * Check for single-platform arbitrage (Yes + No < 1 on same platform)
 * This can happen due to market inefficiencies
 */
export function detectSinglePlatformArbitrage(market: NormalizedMarket): ArbitrageOpportunity | null {
    // Validate market has valid prices
    if (!isValidMarket(market)) {
        return null;
    }

    const totalCost = market.yesPrice + market.noPrice;

    // Single-platform arbitrage only if Yes + No < 1
    if (totalCost >= 1) {
        return null;
    }

    const guaranteedProfit = 1 - totalCost;
    const profitPercentage = (guaranteedProfit / totalCost) * 100;

    // Filter out very small opportunities
    if (profitPercentage < 0.5) {
        return null;
    }

    return {
        id: `${market.id}-single-${Date.now()}`,
        question: market.question,
        type: 'single-platform',
        strategy: 'buy-both-same',
        platform1: {
            name: market.platform,
            marketId: market.id,
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
        },
        platform2: {
            name: market.platform,
            marketId: market.id,
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
        },
        profitPercentage,
        totalCost,
        guaranteedProfit,
        detectedAt: new Date().toISOString(),
    };
}
