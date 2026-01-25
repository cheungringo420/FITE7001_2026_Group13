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

// --- Enhanced Matching Logic ---

// Scoring weights - emphasize entity and exact matches
const ENTITY_WEIGHT = 0.35;
const JACCARD_WEIGHT = 0.25;
const DATE_WEIGHT = 0.20;
const TOPIC_WEIGHT = 0.10;
const EXACT_PHRASE_WEIGHT = 0.10;

// Key people/entities that MUST match if present in both questions
const CRITICAL_ENTITIES = [
    // Politicians
    'trump', 'biden', 'harris', 'desantis', 'newsom', 'pence', 'obama', 'pelosi',
    'sanders', 'aoc', 'ocasio-cortez', 'mcconnell', 'schumer', 'vance',
    // Tech figures  
    'elon', 'musk', 'zuckerberg', 'bezos', 'altman', 'pichai', 'cook', 'nadella',
    // World leaders
    'putin', 'xi', 'jinping', 'zelensky', 'netanyahu', 'modi',
    // Pope/Religious
    'pope', 'francis', 'conclave',
    // Companies
    'tesla', 'spacex', 'openai', 'anthropic', 'google', 'meta', 'apple', 'nvidia',
    // Specific events
    'super bowl', 'oscars', 'grammy', 'world cup',
];

// Key topics that indicate related markets
const KEY_TOPICS = [
    'fed', 'interest rate', 'inflation', 'gdp', 'recession', 'unemployment',
    'election', 'president', 'congress', 'senate', 'house', 'supreme court',
    'china', 'russia', 'ukraine', 'israel', 'iran', 'taiwan',
    'ai', 'bitcoin', 'crypto', 'ethereum',
    'mars', 'nasa', 'moon', 'starship',
    'deportation', 'immigration', 'border',
    'tariff', 'trade war',
    'trillionaire', 'billionaire',
    'doge', 'budget', 'deficit',
];

// Extract critical entities (person names, companies) that MUST match
function extractCriticalEntities(text: string): Set<string> {
    const lowerText = text.toLowerCase();
    const found = new Set<string>();
    
    for (const entity of CRITICAL_ENTITIES) {
        if (lowerText.includes(entity)) {
            // Normalize similar entities
            if (entity === 'elon' || entity === 'musk') {
                found.add('elon_musk');
            } else if (entity === 'xi' || entity === 'jinping') {
                found.add('xi_jinping');
            } else if (entity === 'ocasio-cortez' || entity === 'aoc') {
                found.add('aoc');
            } else {
                found.add(entity);
            }
        }
    }
    return found;
}

function extractEntities(text: string): Set<string> {
    const entities = new Set<string>();

    // Numbers with context (e.g. 25bps, $100M, 50%, 2 trillion)
    const numberMatches = text.match(/\$?\d+(\.\d+)?\s*(bps|%|billion|trillion|million|m|b|k)?/gi);
    if (numberMatches) numberMatches.forEach(m => entities.add(m.toLowerCase().replace(/\s+/g, '')));

    // Dates (Month Year, Month Day)
    const dateMatches = text.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,4}/gi);
    if (dateMatches) dateMatches.forEach(m => entities.add(m.toLowerCase()));

    // Year mentions (2024, 2025, 2026, 2027, 2028, etc.)
    const yearMatches = text.match(/\b20[2-3]\d\b/g);
    if (yearMatches) yearMatches.forEach(m => entities.add(m));

    // Specific dates like "Jan 31", "January 31st"
    const shortDateMatches = text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(st|nd|rd|th)?/gi);
    if (shortDateMatches) shortDateMatches.forEach(m => entities.add(m.toLowerCase()));

    // Proper Nouns / Capitalized multi-word names
    const properNounMatches = text.match(/\b[A-Z][a-z]+(\s+[A-Z][a-z]+)+\b/g);
    if (properNounMatches) {
        const stopPhrases = ['The', 'Will', 'Who', 'What', 'After', 'Before', 'When', 'How', 'Which', 'Democratic', 'Republican', 'United States'];
        properNounMatches.forEach(m => {
            if (!stopPhrases.some(s => m.startsWith(s))) {
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

// Extract years mentioned in text
function extractYears(text: string): Set<string> {
    const years = new Set<string>();
    const yearMatches = text.match(/\b20[2-3]\d\b/g);
    if (yearMatches) yearMatches.forEach(y => years.add(y));
    return years;
}

// Extract month-day combinations
function extractMonthDay(text: string): Set<string> {
    const dates = new Set<string>();
    const lowerText = text.toLowerCase();
    
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                    'july', 'august', 'september', 'october', 'november', 'december'];
    const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                         'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    // Match "Month DD" or "Mon DD"
    for (let i = 0; i < months.length; i++) {
        const monthRegex = new RegExp(`(${months[i]}|${shortMonths[i]})[a-z]*\\.?\\s+(\\d{1,2})`, 'gi');
        const matches = lowerText.match(monthRegex);
        if (matches) {
            matches.forEach(m => {
                // Normalize to "month-day" format
                const dayMatch = m.match(/\d{1,2}/);
                if (dayMatch) {
                    dates.add(`${shortMonths[i]}-${dayMatch[0]}`);
                }
            });
        }
    }
    return dates;
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
        .replace(/kamala harris/g, 'harris')
        .replace(/ron desantis/g, 'desantis')
        .replace(/gavin newsom/g, 'newsom')
        // Common variations
        .replace(/become a trillionaire/g, 'trillionaire')
        .replace(/become president/g, 'president')
        .replace(/win the/g, 'win')
        // Formatting
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculate similarity score between two market questions
 * Enhanced algorithm with:
 * - Critical entity matching (must match if present)
 * - Year/date validation
 * - Jaccard similarity
 * - Key topic overlap
 */
export function calculateSimilarity(question1: string, question2: string): number {
    const q1Norm = normalizeText(question1);
    const q2Norm = normalizeText(question2);

    // === CRITICAL ENTITY CHECK ===
    // If both questions mention specific people/companies, they MUST match
    const critical1 = extractCriticalEntities(question1);
    const critical2 = extractCriticalEntities(question2);
    
    if (critical1.size > 0 && critical2.size > 0) {
        const criticalIntersection = [...critical1].filter(e => critical2.has(e));
        const criticalUnion = new Set([...critical1, ...critical2]);
        
        // If they mention different people/entities, heavily penalize
        if (criticalIntersection.length === 0) {
            return 0.1; // Almost no match - different subjects
        }
        
        // If only partial overlap (e.g., one mentions Trump AND Biden, other only Trump)
        // Still allow but with penalty
        if (criticalIntersection.length < Math.min(critical1.size, critical2.size)) {
            // Partial match - may be related but not same market
        }
    }

    // === YEAR VALIDATION ===
    // If both mention years, they should overlap
    const years1 = extractYears(question1);
    const years2 = extractYears(question2);
    
    if (years1.size > 0 && years2.size > 0) {
        const yearIntersection = [...years1].filter(y => years2.has(y));
        if (yearIntersection.length === 0) {
            return 0.15; // Different time periods - not same market
        }
    }

    // === DATE VALIDATION (Month-Day) ===
    const dates1 = extractMonthDay(question1);
    const dates2 = extractMonthDay(question2);
    
    let dateScore = 1.0;
    if (dates1.size > 0 && dates2.size > 0) {
        const dateIntersection = [...dates1].filter(d => dates2.has(d));
        if (dateIntersection.length === 0) {
            dateScore = 0.3; // Different specific dates
        }
    }

    // === JACCARD SIMILARITY ===
    const words1 = new Set(q1Norm.split(' ').filter(w => w.length > 2));
    const words2 = new Set(q2Norm.split(' ').filter(w => w.length > 2));

    if (words1.size === 0 || words2.size === 0) return 0;

    const wordIntersection = [...words1].filter(w => words2.has(w)).length;
    const wordUnion = new Set([...words1, ...words2]).size;
    const jaccardScore = wordIntersection / wordUnion;

    // === ENTITY MATCHING ===
    const entities1 = extractEntities(question1);
    const entities2 = extractEntities(question2);

    let entityScore = 0.5; // Neutral default
    if (entities1.size > 0 && entities2.size > 0) {
        const entityIntersection = [...entities1].filter(e => entities2.has(e)).length;
        const entityUnion = new Set([...entities1, ...entities2]).size;
        entityScore = entityIntersection / entityUnion;
    }

    // === KEY TOPIC MATCHING ===
    const topics1 = extractKeyTopics(question1);
    const topics2 = extractKeyTopics(question2);

    let topicScore = 0;
    if (topics1.size > 0 && topics2.size > 0) {
        const topicIntersection = [...topics1].filter(t => topics2.has(t)).length;
        if (topicIntersection > 0) {
            topicScore = topicIntersection / Math.min(topics1.size, topics2.size);
        }
    }

    // === EXACT PHRASE MATCHING ===
    // Check for significant phrase overlap (3+ word sequences)
    let exactPhraseScore = 0;
    const words1Arr = q1Norm.split(' ');
    for (let i = 0; i < words1Arr.length - 2; i++) {
        const phrase = `${words1Arr[i]} ${words1Arr[i+1]} ${words1Arr[i+2]}`;
        if (phrase.length > 8 && q2Norm.includes(phrase)) {
            exactPhraseScore = 1.0;
            break;
        }
    }

    // === WEIGHTED TOTAL ===
    let totalScore = 
        (jaccardScore * JACCARD_WEIGHT) + 
        (entityScore * ENTITY_WEIGHT) + 
        (dateScore * DATE_WEIGHT) + 
        (topicScore * TOPIC_WEIGHT) +
        (exactPhraseScore * EXACT_PHRASE_WEIGHT);

    // Boost for very high Jaccard (near identical questions)
    if (jaccardScore > 0.65) {
        totalScore = Math.max(totalScore, 0.80);
    }

    // Boost if they share multiple key topics AND critical entities
    if (topicScore > 0.5 && critical1.size > 0 && critical2.size > 0) {
        const criticalMatch = [...critical1].some(e => critical2.has(e));
        if (criticalMatch) {
            totalScore = Math.min(totalScore * 1.2, 1.0);
        }
    }

    // Apply date penalty
    totalScore *= dateScore;

    return Math.min(Math.max(totalScore, 0), 1.0);
}

/**
 * Find matching markets between Polymarket and Kalshi
 * Enhanced to find the best match per Polymarket market (1:1 matching)
 */
export function findMatchingMarkets(
    polymarketMarkets: NormalizedMarket[],
    kalshiMarkets: NormalizedMarket[],
    similarityThreshold = 0.55
): Array<{ polymarket: NormalizedMarket; kalshi: NormalizedMarket; similarity: number }> {
    const matches: Array<{ polymarket: NormalizedMarket; kalshi: NormalizedMarket; similarity: number }> = [];
    const usedKalshiIds = new Set<string>();

    // For each Polymarket market, find the BEST matching Kalshi market
    for (const pm of polymarketMarkets) {
        let bestMatch: { kalshi: NormalizedMarket; similarity: number } | null = null;
        
        for (const km of kalshiMarkets) {
            // Skip if this Kalshi market is already matched
            if (usedKalshiIds.has(km.id)) continue;
            
            const similarity = calculateSimilarity(pm.question, km.question);

            if (similarity >= similarityThreshold) {
                if (!bestMatch || similarity > bestMatch.similarity) {
                    bestMatch = { kalshi: km, similarity };
                }
            }
        }
        
        // Add the best match if found
        if (bestMatch) {
            matches.push({
                polymarket: pm,
                kalshi: bestMatch.kalshi,
                similarity: bestMatch.similarity,
            });
            usedKalshiIds.add(bestMatch.kalshi.id);
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
