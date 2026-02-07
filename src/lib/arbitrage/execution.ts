// Unified Arbitrage Execution Service
// Handles simultaneous order placement across platforms

import {
    PolymarketCredentials,
    placeOrder as placePolymarketOrder,
} from '../polymarket/trading';
import {
    KalshiCredentials,
    placeKalshiOrder,
} from '../kalshi/trading';
import { ArbitrageOpportunity } from '../kalshi/types';

export interface ExecutionCredentials {
    polymarket?: PolymarketCredentials;
    kalshi?: KalshiCredentials;
}

export interface ExecutionResult {
    success: boolean;
    opportunity: ArbitrageOpportunity;
    orders: {
        platform: 'polymarket' | 'kalshi';
        side: 'yes' | 'no';
        status: 'pending' | 'filled' | 'partial' | 'failed';
        orderId?: string;
        filledAmount?: number;
        averagePrice?: number;
        error?: string;
    }[];
    totalCost: number;
    estimatedProfit: number;
    executedAt: string;
}

export type ExecutionStatus =
    | 'idle'
    | 'signing'
    | 'placing-orders'
    | 'confirming'
    | 'completed'
    | 'failed';

export interface ExecutionProgress {
    status: ExecutionStatus;
    message: string;
    orders: {
        platform: string;
        status: 'pending' | 'placing' | 'filled' | 'partial' | 'failed';
    }[];
}

/**
 * Execute an arbitrage opportunity by placing orders on both platforms
 */
export async function executeArbitrage(
    opportunity: ArbitrageOpportunity,
    credentials: ExecutionCredentials,
    amount: number, // Amount in USDC to invest
    onProgress?: (progress: ExecutionProgress) => void
): Promise<ExecutionResult> {
    const orders: ExecutionResult['orders'] = [];
    const updateProgress = (status: ExecutionStatus, message: string) => {
        onProgress?.({
            status,
            message,
            orders: orders.map(o => ({
                platform: o.platform,
                status: o.status,
            })),
        });
    };

    // Validate credentials
    if (opportunity.type === 'cross-platform') {
        if (!credentials.polymarket || !credentials.kalshi) {
            return {
                success: false,
                opportunity,
                orders: [],
                totalCost: 0,
                estimatedProfit: 0,
                executedAt: new Date().toISOString(),
            };
        }
    }

    updateProgress('placing-orders', 'Placing orders on both platforms...');

    // Determine order parameters based on strategy
    const { platform1, platform2, strategy } = opportunity;

    try {
        // For single-platform arbitrage
        if (opportunity.type === 'single-platform') {
            const platform = platform1.name;
            const contracts = Math.floor(amount / opportunity.totalCost);

            if (platform === 'polymarket' && credentials.polymarket) {
                // Place YES order
                const yesOrder = await placePolymarketOrder(credentials.polymarket, {
                    tokenId: platform1.marketId, // This would need the actual yes token ID
                    side: 'BUY',
                    size: contracts,
                    price: platform1.yesPrice,
                });

                orders.push({
                    platform: 'polymarket',
                    side: 'yes',
                    status: yesOrder.success ? 'filled' : 'failed',
                    orderId: yesOrder.orderId,
                    filledAmount: yesOrder.filledAmount,
                    averagePrice: yesOrder.averagePrice,
                    error: yesOrder.error,
                });

                // Place NO order
                const noOrder = await placePolymarketOrder(credentials.polymarket, {
                    tokenId: platform1.marketId, // This would need the actual no token ID
                    side: 'BUY',
                    size: contracts,
                    price: platform1.noPrice,
                });

                orders.push({
                    platform: 'polymarket',
                    side: 'no',
                    status: noOrder.success ? 'filled' : 'failed',
                    orderId: noOrder.orderId,
                    filledAmount: noOrder.filledAmount,
                    averagePrice: noOrder.averagePrice,
                    error: noOrder.error,
                });
            } else if (platform === 'kalshi' && credentials.kalshi) {
                // Place YES order on Kalshi
                const yesOrder = await placeKalshiOrder(credentials.kalshi, {
                    ticker: platform1.marketId,
                    side: 'yes',
                    action: 'buy',
                    count: contracts,
                    type: 'limit',
                    yesPrice: Math.round(platform1.yesPrice * 100),
                });

                orders.push({
                    platform: 'kalshi',
                    side: 'yes',
                    status: yesOrder.success ? 'filled' : 'failed',
                    orderId: yesOrder.orderId,
                    filledAmount: yesOrder.filledCount,
                    averagePrice: yesOrder.averagePrice,
                    error: yesOrder.error,
                });

                // Place NO order on Kalshi
                const noOrder = await placeKalshiOrder(credentials.kalshi, {
                    ticker: platform1.marketId,
                    side: 'no',
                    action: 'buy',
                    count: contracts,
                    type: 'limit',
                    noPrice: Math.round(platform1.noPrice * 100),
                });

                orders.push({
                    platform: 'kalshi',
                    side: 'no',
                    status: noOrder.success ? 'filled' : 'failed',
                    orderId: noOrder.orderId,
                    filledAmount: noOrder.filledCount,
                    averagePrice: noOrder.averagePrice,
                    error: noOrder.error,
                });
            }
        } else {
            // Cross-platform arbitrage
            const contracts = Math.floor(amount / opportunity.totalCost);

            // Determine which side to buy on each platform
            const buyYesOnPlatform1 = strategy === 'buy-yes-a-no-b';

            // Place order on platform 1
            if (platform1.name === 'polymarket' && credentials.polymarket) {
                const order = await placePolymarketOrder(credentials.polymarket, {
                    tokenId: platform1.marketId,
                    side: 'BUY',
                    size: contracts,
                    price: buyYesOnPlatform1 ? platform1.yesPrice : platform1.noPrice,
                });

                orders.push({
                    platform: 'polymarket',
                    side: buyYesOnPlatform1 ? 'yes' : 'no',
                    status: order.success ? 'filled' : 'failed',
                    orderId: order.orderId,
                    filledAmount: order.filledAmount,
                    averagePrice: order.averagePrice,
                    error: order.error,
                });
            } else if (platform1.name === 'kalshi' && credentials.kalshi) {
                const order = await placeKalshiOrder(credentials.kalshi, {
                    ticker: platform1.marketId,
                    side: buyYesOnPlatform1 ? 'yes' : 'no',
                    action: 'buy',
                    count: contracts,
                    type: 'limit',
                    ...(buyYesOnPlatform1
                        ? { yesPrice: Math.round(platform1.yesPrice * 100) }
                        : { noPrice: Math.round(platform1.noPrice * 100) }),
                });

                orders.push({
                    platform: 'kalshi',
                    side: buyYesOnPlatform1 ? 'yes' : 'no',
                    status: order.success ? 'filled' : 'failed',
                    orderId: order.orderId,
                    filledAmount: order.filledCount,
                    averagePrice: order.averagePrice,
                    error: order.error,
                });
            }

            // Place order on platform 2 (opposite side)
            if (platform2.name === 'polymarket' && credentials.polymarket) {
                const order = await placePolymarketOrder(credentials.polymarket, {
                    tokenId: platform2.marketId,
                    side: 'BUY',
                    size: contracts,
                    price: buyYesOnPlatform1 ? platform2.noPrice : platform2.yesPrice,
                });

                orders.push({
                    platform: 'polymarket',
                    side: buyYesOnPlatform1 ? 'no' : 'yes',
                    status: order.success ? 'filled' : 'failed',
                    orderId: order.orderId,
                    filledAmount: order.filledAmount,
                    averagePrice: order.averagePrice,
                    error: order.error,
                });
            } else if (platform2.name === 'kalshi' && credentials.kalshi) {
                const order = await placeKalshiOrder(credentials.kalshi, {
                    ticker: platform2.marketId,
                    side: buyYesOnPlatform1 ? 'no' : 'yes',
                    action: 'buy',
                    count: contracts,
                    type: 'limit',
                    ...(buyYesOnPlatform1
                        ? { noPrice: Math.round(platform2.noPrice * 100) }
                        : { yesPrice: Math.round(platform2.yesPrice * 100) }),
                });

                orders.push({
                    platform: 'kalshi',
                    side: buyYesOnPlatform1 ? 'no' : 'yes',
                    status: order.success ? 'filled' : 'failed',
                    orderId: order.orderId,
                    filledAmount: order.filledCount,
                    averagePrice: order.averagePrice,
                    error: order.error,
                });
            }
        }

        updateProgress('confirming', 'Confirming order execution...');

        // Calculate actual results
        const allFilled = orders.every(o => o.status === 'filled');
        const actualCost = orders.reduce((sum, o) => {
            const price = o.averagePrice || 0;
            const amount = o.filledAmount || 0;
            return sum + (price * amount);
        }, 0);

        updateProgress(allFilled ? 'completed' : 'failed',
            allFilled ? 'Arbitrage executed successfully!' : 'Some orders failed');

        return {
            success: allFilled,
            opportunity,
            orders,
            totalCost: actualCost,
            estimatedProfit: allFilled ? (1 - opportunity.totalCost) * amount : 0,
            executedAt: new Date().toISOString(),
        };
    } catch (error) {
        updateProgress('failed', error instanceof Error ? error.message : 'Execution failed');

        return {
            success: false,
            opportunity,
            orders,
            totalCost: 0,
            estimatedProfit: 0,
            executedAt: new Date().toISOString(),
        };
    }
}
