/**
 * Auto Trading Bot Types
 * 
 * Defines configuration, state, and event types for the arbitrage trading bot.
 */

export type BotStrategy = 'conservative' | 'balanced' | 'aggressive';

export interface BotConfig {
    enabled: boolean;
    strategy: BotStrategy;

    // Profit thresholds
    minProfitPercent: number;      // Minimum profit % to execute (e.g., 0.5 = 0.5%)
    maxSlippage: number;           // Maximum allowed slippage (e.g., 0.02 = 2%)

    // Position limits
    maxPositionSize: number;       // Max USDC per trade
    maxTotalExposure: number;      // Max total USDC across all positions
    maxDailyTrades: number;        // Max trades per day
    maxDailyLoss: number;          // Stop trading if daily loss exceeds this

    // Platform settings
    platforms: ('polymarket' | 'kalshi')[];

    // Execution mode
    executionMode: 'auto' | 'semi-auto' | 'manual';
    confirmationTimeout: number;   // Seconds to wait for confirmation in semi-auto mode

    // Advanced
    autoRebalance: boolean;        // Auto-close positions when opportunity disappears
    cooldownPeriod: number;        // Seconds between trades on same market
    similarityThreshold: number;   // Min similarity for cross-platform matching
}

export interface BotPosition {
    id: string;
    marketId: string;
    marketQuestion: string;
    platform: 'polymarket' | 'kalshi';
    side: 'yes' | 'no';
    entryPrice: number;
    quantity: number;
    currentPrice: number;
    unrealizedPnl: number;
    enteredAt: string;
}

export interface BotTrade {
    id: string;
    timestamp: string;
    type: 'cross-platform' | 'single-platform';
    markets: {
        platform: 'polymarket' | 'kalshi';
        marketId: string;
        question: string;
        side: 'yes' | 'no';
        price: number;
        quantity: number;
    }[];
    totalCost: number;
    expectedProfit: number;
    realizedProfit?: number;
    status: 'pending' | 'executed' | 'partial' | 'failed' | 'closed';
    error?: string;
}

export interface BotOpportunity {
    id: string;
    timestamp: string;
    type: 'cross-platform' | 'single-platform';
    polymarket?: {
        marketId: string;
        question: string;
        yesPrice: number;
        noPrice: number;
    };
    kalshi?: {
        ticker: string;
        question: string;
        yesPrice: number;
        noPrice: number;
    };
    strategy: 'buy-yes-poly-no-kalshi' | 'buy-no-poly-yes-kalshi' | 'buy-yes-no-single';
    totalCost: number;
    profitPercent: number;
    similarity: number;
    expiresAt?: string;
}

export type BotStatus =
    | 'stopped'
    | 'starting'
    | 'running'
    | 'scanning'
    | 'executing'
    | 'paused'
    | 'error'
    | 'cooldown';

export interface BotState {
    status: BotStatus;
    statusMessage: string;

    // Current session stats
    startedAt: string | null;
    tradesCount: number;
    profitToday: number;
    lossToday: number;

    // Positions and opportunities
    activePositions: BotPosition[];
    recentOpportunities: BotOpportunity[];
    tradeHistory: BotTrade[];

    // Error tracking
    lastError: string | null;
    errorCount: number;

    // Connection status
    polymarketConnected: boolean;
    kalshiConnected: boolean;
}

export interface BotEvent {
    type:
    | 'started'
    | 'stopped'
    | 'opportunity_found'
    | 'opportunity_expired'
    | 'trade_pending'
    | 'trade_executed'
    | 'trade_failed'
    | 'position_opened'
    | 'position_closed'
    | 'error'
    | 'warning'
    | 'daily_limit_reached';
    timestamp: string;
    message: string;
    data?: unknown;
}

// Strategy presets
export const STRATEGY_PRESETS: Record<BotStrategy, Partial<BotConfig>> = {
    conservative: {
        minProfitPercent: 2.0,
        maxSlippage: 0.01,
        maxPositionSize: 50,
        maxTotalExposure: 200,
        maxDailyTrades: 5,
        maxDailyLoss: 20,
        similarityThreshold: 0.7,
        cooldownPeriod: 300,
    },
    balanced: {
        minProfitPercent: 1.0,
        maxSlippage: 0.02,
        maxPositionSize: 200,
        maxTotalExposure: 1000,
        maxDailyTrades: 20,
        maxDailyLoss: 100,
        similarityThreshold: 0.5,
        cooldownPeriod: 120,
    },
    aggressive: {
        minProfitPercent: 0.5,
        maxSlippage: 0.03,
        maxPositionSize: 500,
        maxTotalExposure: 5000,
        maxDailyTrades: 50,
        maxDailyLoss: 500,
        similarityThreshold: 0.4,
        cooldownPeriod: 30,
    },
};

export const DEFAULT_BOT_CONFIG: BotConfig = {
    enabled: false,
    strategy: 'balanced',
    minProfitPercent: 1.0,
    maxSlippage: 0.02,
    maxPositionSize: 200,
    maxTotalExposure: 1000,
    maxDailyTrades: 20,
    maxDailyLoss: 100,
    platforms: ['polymarket', 'kalshi'],
    executionMode: 'semi-auto',
    confirmationTimeout: 10,
    autoRebalance: false,
    cooldownPeriod: 120,
    similarityThreshold: 0.5,
};

export const INITIAL_BOT_STATE: BotState = {
    status: 'stopped',
    statusMessage: 'Bot is not running',
    startedAt: null,
    tradesCount: 0,
    profitToday: 0,
    lossToday: 0,
    activePositions: [],
    recentOpportunities: [],
    tradeHistory: [],
    lastError: null,
    errorCount: 0,
    polymarketConnected: false,
    kalshiConnected: false,
};
