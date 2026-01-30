// Implied Volatility and Options Pricing Utilities
// Uses Black-Scholes model for IV calculation

import { BlackScholesParams, ImpliedProbabilityResult } from './types';

// Standard normal cumulative distribution function
export function normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
}

// Standard normal probability density function
export function normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Black-Scholes d1 and d2 calculations
function calculateD1D2(params: BlackScholesParams): { d1: number; d2: number } {
    const { S, K, T, r, sigma } = params;

    if (T <= 0 || sigma <= 0) {
        throw new Error('Time and volatility must be positive');
    }

    const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    return { d1, d2 };
}

/**
 * Calculate Black-Scholes call option price
 */
export function blackScholesCall(params: BlackScholesParams): number {
    const { S, K, T, r } = params;
    const { d1, d2 } = calculateD1D2(params);

    return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
}

/**
 * Calculate Black-Scholes put option price
 */
export function blackScholesPut(params: BlackScholesParams): number {
    const { S, K, T, r } = params;
    const { d1, d2 } = calculateD1D2(params);

    return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
}

/**
 * Calculate implied volatility from option price using Newton-Raphson method
 */
export function calculateImpliedVolatility(
    optionPrice: number,
    S: number,
    K: number,
    T: number,
    r: number,
    isCall: boolean,
    initialGuess: number = 0.3,
    tolerance: number = 0.0001,
    maxIterations: number = 100
): number {
    let sigma = initialGuess;

    for (let i = 0; i < maxIterations; i++) {
        const params: BlackScholesParams = { S, K, T, r, sigma };
        const { d1 } = calculateD1D2(params);

        const price = isCall
            ? blackScholesCall(params)
            : blackScholesPut(params);

        const diff = price - optionPrice;

        if (Math.abs(diff) < tolerance) {
            return sigma;
        }

        // Vega: derivative of option price with respect to volatility
        const vega = S * Math.sqrt(T) * normalPDF(d1);

        if (Math.abs(vega) < 1e-10) {
            break; // Avoid division by zero
        }

        sigma = sigma - diff / vega;

        // Keep sigma positive
        if (sigma <= 0) {
            sigma = 0.01;
        }
    }

    return sigma;
}

/**
 * Calculate probability that stock will be above strike at expiration (risk-neutral)
 * This is N(d2) for a call option
 */
export function probabilityAboveStrike(params: BlackScholesParams): number {
    const { d2 } = calculateD1D2(params);
    return normalCDF(d2);
}

/**
 * Calculate probability that stock will be below strike at expiration
 */
export function probabilityBelowStrike(params: BlackScholesParams): number {
    return 1 - probabilityAboveStrike(params);
}

/**
 * Calculate implied probability from a binary option price
 * Binary options pay $1 if condition met, $0 otherwise
 * Price = P(condition) * e^(-rT)
 */
export function impliedProbabilityFromBinary(
    binaryPrice: number,
    T: number,
    r: number
): number {
    // Binary price = P * e^(-rT)
    // P = binaryPrice * e^(rT)
    return binaryPrice * Math.exp(r * T);
}

/**
 * Calculate implied probability from call and put prices (put-call parity method)
 * Uses the relationship: P(S > K) ≈ C - P for deep options
 */
export function impliedProbabilityFromPutCallParity(
    callPrice: number,
    putPrice: number,
    S: number,
    K: number,
    T: number,
    r: number
): ImpliedProbabilityResult {
    // Using risk-neutral probability approach
    const forwardPrice = S * Math.exp(r * T);
    const discountFactor = Math.exp(-r * T);

    // The probability is approximated from delta hedge ratio
    // For digital/binary equivalent: P(S > K) ≈ 1 - discountFactor * (K - S + putPrice) / (callPrice + putPrice)

    const probability = discountFactor * (callPrice / K);

    // Confidence based on liquidity (put-call spread)
    const spread = Math.abs(callPrice - putPrice);
    const midPrice = (callPrice + putPrice) / 2;
    const spreadPercent = midPrice > 0 ? spread / midPrice : 1;

    let confidence: 'high' | 'medium' | 'low';
    if (spreadPercent < 0.05) confidence = 'high';
    else if (spreadPercent < 0.15) confidence = 'medium';
    else confidence = 'low';

    return {
        probability: Math.max(0, Math.min(1, probability)),
        method: 'risk-neutral',
        confidence,
        notes: `Spread: ${(spreadPercent * 100).toFixed(1)}%`,
    };
}

/**
 * Convert prediction market price to implied volatility assumption
 * If market says 70% chance X happens, what IV is implied?
 */
export function predictionPriceToImpliedVolatility(
    predictionPrice: number,  // 0-1 probability
    S: number,
    K: number,
    T: number,
    r: number
): number {
    if (T <= 0) return 0;

    // Binary option price = N(d2) * e^(-rT)
    // We solve for sigma that gives N(d2) = predictionPrice * e^(rT)

    const targetN_d2 = predictionPrice * Math.exp(r * T);

    // Newton-Raphson to find sigma
    let sigma = 0.3; // Initial guess

    for (let i = 0; i < 50; i++) {
        const params: BlackScholesParams = { S, K, T, r, sigma };
        const { d1, d2 } = calculateD1D2(params);

        const currentN_d2 = normalCDF(d2);
        const diff = currentN_d2 - targetN_d2;

        if (Math.abs(diff) < 0.0001) break;

        // Derivative of N(d2) with respect to sigma
        // d(N(d2))/dsigma = n(d2) * d(d2)/dsigma
        // d(d2)/dsigma = -d1/sigma
        const derivative = -normalPDF(d2) * d1 / sigma;

        if (Math.abs(derivative) < 1e-10) break;

        sigma = sigma - diff / derivative;
        sigma = Math.max(0.01, Math.min(5, sigma)); // Keep reasonable bounds
    }

    return sigma;
}

/**
 * Calculate the discrepancy between prediction market and options-implied probability
 */
export function calculateDiscrepancy(
    predictionPrice: number,
    optionsImpliedProbability: number
): {
    valueDiff: number;
    percentDiff: number;
    direction: 'prediction-higher' | 'options-higher' | 'neutral';
    opportunity: boolean;
} {
    const valueDiff = predictionPrice - optionsImpliedProbability;
    const avgPrice = (predictionPrice + optionsImpliedProbability) / 2;
    const percentDiff = avgPrice > 0 ? (valueDiff / avgPrice) * 100 : 0;

    const direction = valueDiff > 0.02
        ? 'prediction-higher'
        : valueDiff < -0.02
            ? 'options-higher'
            : 'neutral';

    // Flag as opportunity if difference > 5%
    const opportunity = Math.abs(valueDiff) > 0.05;

    return { valueDiff, percentDiff, direction, opportunity };
}

/**
 * Calculate Greeks for an option
 */
export function calculateGreeks(params: BlackScholesParams, isCall: boolean): {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
} {
    const { S, K, T, r, sigma } = params;
    const { d1, d2 } = calculateD1D2(params);

    const sqrtT = Math.sqrt(T);
    const pdf_d1 = normalPDF(d1);
    const cdf_d1 = normalCDF(d1);
    const cdf_d2 = normalCDF(d2);
    const discount = Math.exp(-r * T);

    // Delta
    const delta = isCall ? cdf_d1 : cdf_d1 - 1;

    // Gamma (same for call and put)
    const gamma = pdf_d1 / (S * sigma * sqrtT);

    // Theta
    const theta_common = -(S * sigma * pdf_d1) / (2 * sqrtT);
    const theta = isCall
        ? theta_common - r * K * discount * cdf_d2
        : theta_common + r * K * discount * normalCDF(-d2);

    // Vega (same for call and put)
    const vega = S * sqrtT * pdf_d1;

    // Rho
    const rho = isCall
        ? K * T * discount * cdf_d2
        : -K * T * discount * normalCDF(-d2);

    return { delta, gamma, theta: theta / 365, vega: vega / 100, rho: rho / 100 };
}

/**
 * Convert days to years for time calculations
 */
export function daysToYears(days: number): number {
    return days / 365;
}

/**
 * Calculate time to expiration in years from date string
 */
export function timeToExpiration(expirationDate: string): number {
    const expiry = new Date(expirationDate);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return Math.max(0, daysToYears(diffDays));
}
