/**
 * Portfolio Types - Position and Trade Tracking
 */

// Position on a specific market
export interface Position {
    id: string;
    platform: 'polymarket' | 'kalshi';
    marketId: string;
    marketTitle: string;
    side: 'yes' | 'no';

    // Entry details
    entryPrice: number;
    quantity: number;  // Number of shares/contracts
    entryTimestamp: number;

    // Current state
    currentPrice?: number;
    lastPriceUpdate?: number;

    // Calculated fields
    costBasis: number;       // entryPrice * quantity
    currentValue?: number;   // currentPrice * quantity
    unrealizedPnL?: number;  // currentValue - costBasis
    unrealizedPnLPercent?: number;

    // Status
    status: 'open' | 'closed' | 'partially_closed';
    closedQuantity?: number;
    realizedPnL?: number;
}

// Individual trade record
export interface Trade {
    id: string;
    platform: 'polymarket' | 'kalshi';
    marketId: string;
    marketTitle: string;

    // Trade details
    type: 'buy' | 'sell';
    side: 'yes' | 'no';
    price: number;
    quantity: number;
    total: number;  // price * quantity
    fee?: number;

    // Timestamps
    timestamp: number;
    executedAt: Date;

    // Transaction info
    txHash?: string;
    orderId?: string;

    // Status
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    errorMessage?: string;

    // Associated position
    positionId?: string;
}

export interface TradeTrustSnapshot {
    evaluatedAt: number;
    legs: Array<{
        platform: 'polymarket' | 'kalshi';
        marketId: string;
        trustScore: number;
        resolutionConfidence: number;
        disputeRisk: number;
        integrityRisk: number;
        evidenceCount: number;
    }>;
}

// Arbitrage-specific trade pair
export interface ArbitrageTrade {
    id: string;
    timestamp: number;

    // The matched market
    matchedQuestion: string;
    similarity: number;

    // Individual legs
    polymarketTrade: Trade;
    kalshiTrade: Trade;

    // P&L
    totalCost: number;
    expectedProfit: number;
    expectedProfitPercent: number;
    actualProfit?: number;
    actualProfitPercent?: number;

    // Status
    status: 'executed' | 'partial' | 'failed';

    // Trust snapshot (optional audit metadata)
    trustSnapshot?: TradeTrustSnapshot;
}

// Portfolio summary stats
export interface PortfolioStats {
    // Position summary
    totalPositions: number;
    openPositions: number;
    closedPositions: number;

    // Value
    totalValue: number;
    totalCostBasis: number;

    // P&L
    totalUnrealizedPnL: number;
    totalRealizedPnL: number;
    totalPnL: number;
    totalPnLPercent: number;

    // By platform
    polymarketValue: number;
    kalshiValue: number;
    polymarketPositions: number;
    kalshiPositions: number;

    // Trading stats
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    averageProfit: number;

    // Time-based
    todayPnL: number;
    weekPnL: number;
    monthPnL: number;
}

// Portfolio state for context
export interface PortfolioState {
    positions: Position[];
    trades: Trade[];
    arbitrageTrades: ArbitrageTrade[];
    stats: PortfolioStats;

    // Loading states
    isLoading: boolean;
    lastUpdated?: number;
    error?: string;
}

// Initial empty state
export const INITIAL_PORTFOLIO_STATE: PortfolioState = {
    positions: [],
    trades: [],
    arbitrageTrades: [],
    stats: {
        totalPositions: 0,
        openPositions: 0,
        closedPositions: 0,
        totalValue: 0,
        totalCostBasis: 0,
        totalUnrealizedPnL: 0,
        totalRealizedPnL: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        polymarketValue: 0,
        kalshiValue: 0,
        polymarketPositions: 0,
        kalshiPositions: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        averageProfit: 0,
        todayPnL: 0,
        weekPnL: 0,
        monthPnL: 0,
    },
    isLoading: false,
};

// Helper to calculate portfolio stats from positions and trades
export function calculatePortfolioStats(
    positions: Position[],
    trades: Trade[]
): PortfolioStats {
    const openPositions = positions.filter(p => p.status === 'open');
    const closedPositions = positions.filter(p => p.status === 'closed');

    const polyPositions = openPositions.filter(p => p.platform === 'polymarket');
    const kalshiPositions = openPositions.filter(p => p.platform === 'kalshi');

    const totalValue = openPositions.reduce((sum, p) => sum + (p.currentValue || p.costBasis), 0);
    const totalCostBasis = openPositions.reduce((sum, p) => sum + p.costBasis, 0);
    const totalUnrealizedPnL = openPositions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0);
    const totalRealizedPnL = closedPositions.reduce((sum, p) => sum + (p.realizedPnL || 0), 0);

    const completedTrades = trades.filter(t => t.status === 'completed');
    const profitableTrades = completedTrades.filter(t => t.type === 'sell' && t.total > 0);

    // Time-based P&L
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    const monthStart = now - 30 * 24 * 60 * 60 * 1000;

    const todayTrades = completedTrades.filter(t => t.timestamp >= todayStart);
    const weekTrades = completedTrades.filter(t => t.timestamp >= weekStart);
    const monthTrades = completedTrades.filter(t => t.timestamp >= monthStart);

    return {
        totalPositions: positions.length,
        openPositions: openPositions.length,
        closedPositions: closedPositions.length,
        totalValue,
        totalCostBasis,
        totalUnrealizedPnL,
        totalRealizedPnL,
        totalPnL: totalUnrealizedPnL + totalRealizedPnL,
        totalPnLPercent: totalCostBasis > 0
            ? ((totalUnrealizedPnL + totalRealizedPnL) / totalCostBasis) * 100
            : 0,
        polymarketValue: polyPositions.reduce((sum, p) => sum + (p.currentValue || p.costBasis), 0),
        kalshiValue: kalshiPositions.reduce((sum, p) => sum + (p.currentValue || p.costBasis), 0),
        polymarketPositions: polyPositions.length,
        kalshiPositions: kalshiPositions.length,
        totalTrades: completedTrades.length,
        winningTrades: profitableTrades.length,
        losingTrades: completedTrades.length - profitableTrades.length,
        winRate: completedTrades.length > 0
            ? (profitableTrades.length / completedTrades.length) * 100
            : 0,
        averageProfit: completedTrades.length > 0
            ? totalRealizedPnL / completedTrades.length
            : 0,
        todayPnL: todayTrades.reduce((sum, t) => sum + (t.type === 'sell' ? t.total : -t.total), 0),
        weekPnL: weekTrades.reduce((sum, t) => sum + (t.type === 'sell' ? t.total : -t.total), 0),
        monthPnL: monthTrades.reduce((sum, t) => sum + (t.type === 'sell' ? t.total : -t.total), 0),
    };
}
