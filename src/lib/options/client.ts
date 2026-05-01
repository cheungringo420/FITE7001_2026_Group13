// Options Chain Data Client
// Fetches real options data from Yahoo Finance (free, delayed 15min)
// Falls back to simulation mode with clearly labeled parameters

import { isSyntheticEnabled } from '@/lib/config/features';

export interface OptionsChainData {
    ticker: string;
    currentPrice: number;
    expirations: string[];
    calls: OptionContract[];
    puts: OptionContract[];
    fetchedAt: string;
    source: 'yahoo-finance' | 'simulation';
}

export interface OptionContract {
    contractSymbol: string;
    strike: number;
    expiry: string;
    lastPrice: number;
    bid: number;
    ask: number;
    volume: number;
    openInterest: number;
    impliedVolatility: number;
    inTheMoney: boolean;
    type: 'call' | 'put';
}

interface YahooOptionResult {
    quote: {
        regularMarketPrice: number;
        symbol: string;
    };
    expirationDates: number[];
    options: {
        expirationDate: number;
        calls: YahooOptionContract[];
        puts: YahooOptionContract[];
    }[];
}

interface YahooOptionContract {
    contractSymbol: string;
    strike: number;
    lastPrice: number;
    bid: number;
    ask: number;
    volume: number;
    openInterest: number;
    impliedVolatility: number;
    inTheMoney: boolean;
}

// Simple in-memory cache
const cache = new Map<string, { data: OptionsChainData; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch options chain from Yahoo Finance via their public API.
 */
async function fetchYahooOptions(ticker: string): Promise<OptionsChainData> {
    const url = `https://query1.finance.yahoo.com/v7/finance/options/${ticker}`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Yahoo Finance API returned ${response.status}`);
    }

    const data = await response.json();
    const result: YahooOptionResult = data.optionChain?.result?.[0];

    if (!result) {
        throw new Error(`No options data found for ${ticker}`);
    }

    const calls: OptionContract[] = (result.options[0]?.calls || []).map((c: YahooOptionContract) => ({
        contractSymbol: c.contractSymbol,
        strike: c.strike,
        expiry: new Date(result.options[0].expirationDate * 1000).toISOString().split('T')[0],
        lastPrice: c.lastPrice,
        bid: c.bid || 0,
        ask: c.ask || 0,
        volume: c.volume || 0,
        openInterest: c.openInterest || 0,
        impliedVolatility: c.impliedVolatility,
        inTheMoney: c.inTheMoney,
        type: 'call',
    }));

    const puts: OptionContract[] = (result.options[0]?.puts || []).map((p: YahooOptionContract) => ({
        contractSymbol: p.contractSymbol,
        strike: p.strike,
        expiry: new Date(result.options[0].expirationDate * 1000).toISOString().split('T')[0],
        lastPrice: p.lastPrice,
        bid: p.bid || 0,
        ask: p.ask || 0,
        volume: p.volume || 0,
        openInterest: p.openInterest || 0,
        impliedVolatility: p.impliedVolatility,
        inTheMoney: p.inTheMoney,
        type: 'put',
    }));

    const expirations = result.expirationDates.map(
        (ts: number) => new Date(ts * 1000).toISOString().split('T')[0]
    );

    return {
        ticker,
        currentPrice: result.quote.regularMarketPrice,
        expirations,
        calls,
        puts,
        fetchedAt: new Date().toISOString(),
        source: 'yahoo-finance',
    };
}

/**
 * Generate realistic simulated options data when Yahoo Finance is unavailable.
 * Clearly labeled as simulation data.
 */
function deterministicNoise(seed: number): number {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

function generateSimulatedOptions(ticker: string): OptionsChainData {
    const basePrice = ticker === 'SPY' ? 585 : ticker === 'QQQ' ? 505 : 100;
    const now = new Date();
    const expirations: string[] = [];

    // Generate 4 weekly expirations
    for (let i = 1; i <= 4; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i * 7);
        expirations.push(d.toISOString().split('T')[0]);
    }

    const strikes = Array.from({ length: 11 }, (_, i) =>
        Math.round(basePrice * (0.9 + i * 0.02))
    );

    const calls: OptionContract[] = strikes.map((strike, index) => {
        const moneyness = (basePrice - strike) / basePrice;
        const timeToExpiry = 30 / 365;
        const noise = deterministicNoise(strike + index);
        const iv = 0.18 + Math.abs(moneyness) * 0.3 + noise * 0.05;
        const intrinsic = Math.max(0, basePrice - strike);
        const timeValue = basePrice * iv * Math.sqrt(timeToExpiry) * 0.4;
        const price = Math.max(0.01, intrinsic + timeValue);

        return {
            contractSymbol: `${ticker}${expirations[0].replace(/-/g, '')}C${strike * 1000}`,
            strike,
            expiry: expirations[0],
            lastPrice: Math.round(price * 100) / 100,
            bid: Math.round((price * 0.97) * 100) / 100,
            ask: Math.round((price * 1.03) * 100) / 100,
            volume: Math.round(100 + deterministicNoise(strike * 2 + index) * 5000),
            openInterest: Math.round(500 + deterministicNoise(strike * 3 + index) * 20000),
            impliedVolatility: Math.round(iv * 10000) / 10000,
            inTheMoney: strike < basePrice,
            type: 'call' as const,
        };
    });

    const puts: OptionContract[] = strikes.map((strike, index) => {
        const moneyness = (strike - basePrice) / basePrice;
        const timeToExpiry = 30 / 365;
        const noise = deterministicNoise(strike + index + 100);
        const iv = 0.20 + Math.abs(moneyness) * 0.35 + noise * 0.05;
        const intrinsic = Math.max(0, strike - basePrice);
        const timeValue = basePrice * iv * Math.sqrt(timeToExpiry) * 0.4;
        const price = Math.max(0.01, intrinsic + timeValue);

        return {
            contractSymbol: `${ticker}${expirations[0].replace(/-/g, '')}P${strike * 1000}`,
            strike,
            expiry: expirations[0],
            lastPrice: Math.round(price * 100) / 100,
            bid: Math.round((price * 0.97) * 100) / 100,
            ask: Math.round((price * 1.03) * 100) / 100,
            volume: Math.round(100 + deterministicNoise(strike * 5 + index) * 5000),
            openInterest: Math.round(500 + deterministicNoise(strike * 7 + index) * 20000),
            impliedVolatility: Math.round(iv * 10000) / 10000,
            inTheMoney: strike > basePrice,
            type: 'put' as const,
        };
    });

    return {
        ticker,
        currentPrice: basePrice,
        expirations,
        calls,
        puts,
        fetchedAt: new Date().toISOString(),
        source: 'simulation',
    };
}

/**
 * Fetch options chain with caching and Yahoo Finance fallback.
 */
export async function getOptionsChain(ticker: string): Promise<OptionsChainData> {
    const cacheKey = ticker.toUpperCase();

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
        return cached.data;
    }

    // Try Yahoo Finance first
    try {
        const data = await fetchYahooOptions(cacheKey);
        cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL_MS });
        return data;
    } catch (error) {
        if (!isSyntheticEnabled()) {
            throw new Error(`Yahoo Finance unavailable for ${cacheKey}, and synthetic data is disabled`);
        }

        console.warn(`Yahoo Finance unavailable for ${cacheKey}, using simulation:`, error);

        // Fall back to simulation
        const simData = generateSimulatedOptions(cacheKey);
        cache.set(cacheKey, { data: simData, expires: Date.now() + CACHE_TTL_MS });
        return simData;
    }
}

/**
 * Supported tickers for options comparison.
 */
export const SUPPORTED_TICKERS = ['SPY', 'QQQ', 'IWM', 'DIA', 'GLD', 'TLT', 'USO', 'FXY'];
