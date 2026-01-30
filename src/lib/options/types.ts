// Options and Implied Volatility Types

export interface OptionData {
    symbol: string;
    underlying: string;
    strikePrice: number;
    expirationDate: string;
    optionType: 'call' | 'put';
    lastPrice: number;
    bid: number;
    ask: number;
    volume: number;
    openInterest: number;
    impliedVolatility: number;
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
    underlyingPrice: number;
    daysToExpiration: number;
}

export interface OptionsChain {
    underlying: string;
    underlyingPrice: number;
    expirationDates: string[];
    options: OptionData[];
    fetchedAt: number;
}

export interface IVComparison {
    id: string;
    predictionMarket: {
        platform: 'polymarket' | 'kalshi';
        marketId: string;
        question: string;
        yesPrice: number;  // Implied probability
        expiry?: string;
    };
    optionsData: {
        underlying: string;
        strikePrice: number;
        expirationDate: string;
        impliedVolatility: number;
        impliedProbability: number;  // Probability from options pricing
        callPrice: number;
        putPrice: number;
    };
    discrepancy: {
        valueDiff: number;  // Prediction price - Options-implied probability
        percentDiff: number;  // As percentage
        direction: 'prediction-higher' | 'options-higher' | 'neutral';
        opportunity: boolean;  // If > threshold
    };
    matchedAt: number;
}

export interface IVAnalysisConfig {
    riskFreeRate: number;  // Default ~4.5% for US
    minDiscrepancy: number;  // Minimum % difference to flag
    underlyingSymbols: string[];  // Stocks to compare
}

// Black-Scholes parameters
export interface BlackScholesParams {
    S: number;  // Current stock price
    K: number;  // Strike price
    T: number;  // Time to expiration (years)
    r: number;  // Risk-free rate
    sigma: number;  // Implied volatility
}

// Implied probability calculation result
export interface ImpliedProbabilityResult {
    probability: number;
    method: 'binary-option' | 'black-scholes' | 'risk-neutral';
    confidence: 'high' | 'medium' | 'low';
    notes?: string;
}

// Event matching between prediction markets and options
export interface EventMatch {
    predictionMarketId: string;
    predictionQuestion: string;
    optionsSymbol: string;
    strikeCondition: {
        type: 'above' | 'below' | 'between';
        value: number;
        secondValue?: number;  // For 'between'
    };
    expirationDate: string;
    matchConfidence: number;  // 0-1
}

export const DEFAULT_IV_CONFIG: IVAnalysisConfig = {
    riskFreeRate: 0.045,  // 4.5%
    minDiscrepancy: 0.05,  // 5%
    underlyingSymbols: ['SPY', 'QQQ', 'TSLA', 'NVDA', 'BTC-USD', 'ETH-USD'],
};
