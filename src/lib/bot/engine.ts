/**
 * Arbitrage Bot Engine
 * 
 * Core engine that scans for opportunities and manages trading execution.
 * Implements safety controls, rate limiting, and event-driven architecture.
 */

import {
    BotConfig,
    BotState,
    BotOpportunity,
    BotTrade,
    BotEvent,
    BotStatus,
    INITIAL_BOT_STATE,
    STRATEGY_PRESETS,
} from './types';
import { ArbitrageOpportunity, NormalizedMarket } from '../kalshi/types';
import { executeArbitrage, ExecutionCredentials, ExecutionResult } from '../arbitrage/execution';

type EventCallback = (event: BotEvent) => void;
type StateCallback = (state: BotState) => void;

export class ArbitrageBot {
    private config: BotConfig;
    private state: BotState;
    private credentials: ExecutionCredentials;

    private eventCallbacks: EventCallback[] = [];
    private stateCallbacks: StateCallback[] = [];

    private scanInterval: NodeJS.Timeout | null = null;
    private cooldownMarkets: Map<string, number> = new Map(); // marketId -> cooldown end time
    private pendingConfirmations: Map<string, BotOpportunity> = new Map();

    private apiBaseUrl: string;

    constructor(
        config: BotConfig,
        credentials: ExecutionCredentials,
        apiBaseUrl = ''
    ) {
        this.config = { ...config };
        this.credentials = credentials;
        this.state = { ...INITIAL_BOT_STATE };
        this.apiBaseUrl = apiBaseUrl;
    }

    // Configuration
    updateConfig(newConfig: Partial<BotConfig>): void {
        this.config = { ...this.config, ...newConfig };

        // If strategy changed, apply preset
        if (newConfig.strategy && STRATEGY_PRESETS[newConfig.strategy]) {
            this.config = {
                ...this.config,
                ...STRATEGY_PRESETS[newConfig.strategy],
                strategy: newConfig.strategy,
            };
        }

        this.emitEvent({
            type: 'warning',
            timestamp: new Date().toISOString(),
            message: 'Bot configuration updated',
            data: { config: this.config },
        });
    }

    getConfig(): BotConfig {
        return { ...this.config };
    }

    // State management
    getState(): BotState {
        return { ...this.state };
    }

    private updateState(updates: Partial<BotState>): void {
        this.state = { ...this.state, ...updates };
        this.stateCallbacks.forEach(cb => cb(this.state));
    }

    // Event system
    onEvent(callback: EventCallback): () => void {
        this.eventCallbacks.push(callback);
        return () => {
            this.eventCallbacks = this.eventCallbacks.filter(cb => cb !== callback);
        };
    }

    onStateChange(callback: StateCallback): () => void {
        this.stateCallbacks.push(callback);
        return () => {
            this.stateCallbacks = this.stateCallbacks.filter(cb => cb !== callback);
        };
    }

    private emitEvent(event: BotEvent): void {
        this.eventCallbacks.forEach(cb => cb(event));
    }

    // Bot lifecycle
    async start(): Promise<void> {
        if (this.state.status === 'running' || this.state.status === 'scanning') {
            return;
        }

        // Safety checks
        if (!this.validateCredentials()) {
            this.updateState({
                status: 'error',
                statusMessage: 'Missing trading credentials',
                lastError: 'Please connect your wallet to enable trading',
            });
            return;
        }

        this.updateState({
            status: 'starting',
            statusMessage: 'Starting bot...',
            startedAt: new Date().toISOString(),
            tradesCount: 0,
            profitToday: 0,
            lossToday: 0,
        });

        this.emitEvent({
            type: 'started',
            timestamp: new Date().toISOString(),
            message: 'Arbitrage bot started',
        });

        // Start scanning loop
        this.startScanLoop();

        this.updateState({
            status: 'running',
            statusMessage: 'Scanning for opportunities...',
        });
    }

    stop(): void {
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }

        this.updateState({
            status: 'stopped',
            statusMessage: 'Bot stopped',
        });

        this.emitEvent({
            type: 'stopped',
            timestamp: new Date().toISOString(),
            message: 'Arbitrage bot stopped',
        });
    }

    pause(): void {
        this.updateState({
            status: 'paused',
            statusMessage: 'Bot paused',
        });
    }

    resume(): void {
        if (this.state.status === 'paused') {
            this.updateState({
                status: 'running',
                statusMessage: 'Scanning for opportunities...',
            });
        }
    }

    // Scanning
    private startScanLoop(): void {
        // Initial scan
        this.scan();

        // Set up interval (every 5 seconds)
        this.scanInterval = setInterval(() => {
            if (this.state.status === 'running') {
                this.scan();
            }
        }, 5000);
    }

    private async scan(): Promise<void> {
        if (this.state.status !== 'running') return;

        // Check daily limits
        if (this.state.tradesCount >= this.config.maxDailyTrades) {
            this.updateState({
                status: 'paused',
                statusMessage: 'Daily trade limit reached',
            });
            this.emitEvent({
                type: 'daily_limit_reached',
                timestamp: new Date().toISOString(),
                message: `Daily trade limit of ${this.config.maxDailyTrades} reached`,
            });
            return;
        }

        if (this.state.lossToday >= this.config.maxDailyLoss) {
            this.updateState({
                status: 'paused',
                statusMessage: 'Daily loss limit reached',
            });
            this.emitEvent({
                type: 'daily_limit_reached',
                timestamp: new Date().toISOString(),
                message: `Daily loss limit of $${this.config.maxDailyLoss} reached`,
            });
            return;
        }

        this.updateState({
            status: 'scanning',
            statusMessage: 'Scanning for arbitrage opportunities...',
        });

        try {
            // Fetch opportunities from API
            const response = await fetch(`${this.apiBaseUrl}/api/arbitrage/scan`);
            if (!response.ok) throw new Error(`API error: ${response.status}`);

            const data = await response.json();
            const opportunities: ArbitrageOpportunity[] = data.opportunities || [];

            // Filter opportunities based on config
            const validOpportunities = opportunities.filter(opp => {
                // Check profit threshold
                const profitPercent = (1 - opp.totalCost) * 100;
                if (profitPercent < this.config.minProfitPercent) return false;

                // Check similarity threshold
                const similarity = opp.similarity ?? 1.0;
                if (similarity < this.config.similarityThreshold) return false;

                // Check cooldown
                const market1Key = `${opp.platform1.name}-${opp.platform1.marketId}`;
                const market2Key = `${opp.platform2.name}-${opp.platform2.marketId}`;
                const now = Date.now();

                if (this.cooldownMarkets.has(market1Key) &&
                    this.cooldownMarkets.get(market1Key)! > now) return false;
                if (this.cooldownMarkets.has(market2Key) &&
                    this.cooldownMarkets.get(market2Key)! > now) return false;

                // Check platform filter
                if (!this.config.platforms.includes(opp.platform1.name as 'polymarket' | 'kalshi')) return false;
                if (opp.type === 'cross-platform' &&
                    !this.config.platforms.includes(opp.platform2.name as 'polymarket' | 'kalshi')) return false;

                return true;
            });

            // Update state with opportunities
            const botOpportunities: BotOpportunity[] = validOpportunities.map(opp => ({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                type: opp.type,
                polymarket: opp.platform1.name === 'polymarket' ? {
                    marketId: opp.platform1.marketId,
                    question: opp.platform1.question || opp.question,
                    yesPrice: opp.platform1.yesPrice,
                    noPrice: opp.platform1.noPrice,
                } : opp.platform2.name === 'polymarket' ? {
                    marketId: opp.platform2.marketId,
                    question: opp.platform2.question || opp.question,
                    yesPrice: opp.platform2.yesPrice,
                    noPrice: opp.platform2.noPrice,
                } : undefined,
                kalshi: opp.platform1.name === 'kalshi' ? {
                    ticker: opp.platform1.marketId,
                    question: opp.platform1.question || opp.question,
                    yesPrice: opp.platform1.yesPrice,
                    noPrice: opp.platform1.noPrice,
                } : opp.platform2.name === 'kalshi' ? {
                    ticker: opp.platform2.marketId,
                    question: opp.platform2.question || opp.question,
                    yesPrice: opp.platform2.yesPrice,
                    noPrice: opp.platform2.noPrice,
                } : undefined,
                strategy: opp.strategy as BotOpportunity['strategy'],
                totalCost: opp.totalCost,
                profitPercent: (1 - opp.totalCost) * 100,
                similarity: opp.similarity ?? 1.0,
            }));

            this.updateState({
                recentOpportunities: botOpportunities.slice(0, 10),
            });

            // Handle opportunities based on execution mode
            for (const opp of botOpportunities) {
                if (this.config.executionMode === 'auto') {
                    await this.executeOpportunity(opp);
                } else if (this.config.executionMode === 'semi-auto') {
                    this.requestConfirmation(opp);
                } else {
                    // Manual mode - just emit event
                    this.emitEvent({
                        type: 'opportunity_found',
                        timestamp: new Date().toISOString(),
                        message: `Opportunity found: ${opp.profitPercent.toFixed(2)}% profit`,
                        data: opp,
                    });
                }
            }

            this.updateState({
                status: 'running',
                statusMessage: botOpportunities.length > 0
                    ? `Found ${botOpportunities.length} opportunities`
                    : 'Scanning for opportunities...',
            });

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.updateState({
                lastError: message,
                errorCount: this.state.errorCount + 1,
            });

            this.emitEvent({
                type: 'error',
                timestamp: new Date().toISOString(),
                message: `Scan error: ${message}`,
            });
        }
    }

    // Execution
    private async executeOpportunity(opportunity: BotOpportunity): Promise<void> {
        this.updateState({
            status: 'executing',
            statusMessage: `Executing trade: ${opportunity.profitPercent.toFixed(2)}% profit`,
        });

        this.emitEvent({
            type: 'trade_pending',
            timestamp: new Date().toISOString(),
            message: `Executing opportunity with ${opportunity.profitPercent.toFixed(2)}% profit`,
            data: opportunity,
        });

        try {
            // Calculate position size
            const positionSize = Math.min(
                this.config.maxPositionSize,
                this.config.maxTotalExposure - this.getTotalExposure()
            );

            if (positionSize <= 0) {
                this.emitEvent({
                    type: 'warning',
                    timestamp: new Date().toISOString(),
                    message: 'Max exposure reached, skipping trade',
                });
                return;
            }

            // Build arbitrage opportunity object for execution
            const arbOpp: ArbitrageOpportunity = {
                id: opportunity.id,
                question: opportunity.polymarket?.question || opportunity.kalshi?.question || '',
                type: opportunity.type,
                platform1: {
                    name: opportunity.polymarket ? 'polymarket' : 'kalshi',
                    marketId: opportunity.polymarket?.marketId || opportunity.kalshi?.ticker || '',
                    question: opportunity.polymarket?.question || opportunity.kalshi?.question || '',
                    yesPrice: opportunity.polymarket?.yesPrice || opportunity.kalshi?.yesPrice || 0,
                    noPrice: opportunity.polymarket?.noPrice || opportunity.kalshi?.noPrice || 0,
                },
                platform2: {
                    name: opportunity.kalshi ? 'kalshi' : 'polymarket',
                    marketId: opportunity.kalshi?.ticker || opportunity.polymarket?.marketId || '',
                    question: opportunity.kalshi?.question || opportunity.polymarket?.question || '',
                    yesPrice: opportunity.kalshi?.yesPrice || opportunity.polymarket?.yesPrice || 0,
                    noPrice: opportunity.kalshi?.noPrice || opportunity.polymarket?.noPrice || 0,
                },
                strategy: opportunity.strategy === 'buy-yes-poly-no-kalshi' ? 'buy-yes-a-no-b' : 'buy-no-a-yes-b',
                totalCost: opportunity.totalCost,
                profitPercentage: opportunity.profitPercent,
                guaranteedProfit: opportunity.profitPercent / 100,
                similarity: opportunity.similarity,
                detectedAt: new Date().toISOString(),
            };

            // Execute the trade
            const result = await executeArbitrage(
                arbOpp,
                this.credentials,
                positionSize
            );

            // Record trade
            const trade: BotTrade = {
                id: `trade-${Date.now()}`,
                timestamp: new Date().toISOString(),
                type: opportunity.type,
                markets: result.orders.map(o => ({
                    platform: o.platform,
                    marketId: o.platform === 'polymarket'
                        ? opportunity.polymarket?.marketId || ''
                        : opportunity.kalshi?.ticker || '',
                    question: o.platform === 'polymarket'
                        ? opportunity.polymarket?.question || ''
                        : opportunity.kalshi?.question || '',
                    side: o.side,
                    price: o.averagePrice || 0,
                    quantity: o.filledAmount || 0,
                })),
                totalCost: result.totalCost,
                expectedProfit: result.estimatedProfit,
                status: result.success ? 'executed' : 'failed',
                error: result.orders.find(o => o.error)?.error,
            };

            // Update state
            this.updateState({
                tradesCount: this.state.tradesCount + 1,
                profitToday: this.state.profitToday + (result.success ? result.estimatedProfit : 0),
                tradeHistory: [trade, ...this.state.tradeHistory].slice(0, 50),
            });

            // Set cooldowns
            const cooldownEnd = Date.now() + (this.config.cooldownPeriod * 1000);
            if (opportunity.polymarket) {
                this.cooldownMarkets.set(`polymarket-${opportunity.polymarket.marketId}`, cooldownEnd);
            }
            if (opportunity.kalshi) {
                this.cooldownMarkets.set(`kalshi-${opportunity.kalshi.ticker}`, cooldownEnd);
            }

            this.emitEvent({
                type: result.success ? 'trade_executed' : 'trade_failed',
                timestamp: new Date().toISOString(),
                message: result.success
                    ? `Trade executed! Profit: $${result.estimatedProfit.toFixed(2)}`
                    : `Trade failed: ${trade.error}`,
                data: trade,
            });

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.emitEvent({
                type: 'trade_failed',
                timestamp: new Date().toISOString(),
                message: `Execution failed: ${message}`,
            });
        }

        this.updateState({
            status: 'running',
            statusMessage: 'Scanning for opportunities...',
        });
    }

    private requestConfirmation(opportunity: BotOpportunity): void {
        this.pendingConfirmations.set(opportunity.id, opportunity);

        this.emitEvent({
            type: 'opportunity_found',
            timestamp: new Date().toISOString(),
            message: `Confirmation required: ${opportunity.profitPercent.toFixed(2)}% profit opportunity`,
            data: { opportunity, timeout: this.config.confirmationTimeout },
        });

        // Auto-expire after timeout
        setTimeout(() => {
            if (this.pendingConfirmations.has(opportunity.id)) {
                this.pendingConfirmations.delete(opportunity.id);
                this.emitEvent({
                    type: 'opportunity_expired',
                    timestamp: new Date().toISOString(),
                    message: 'Opportunity confirmation timed out',
                    data: opportunity,
                });
            }
        }, this.config.confirmationTimeout * 1000);
    }

    async confirmOpportunity(opportunityId: string): Promise<void> {
        const opportunity = this.pendingConfirmations.get(opportunityId);
        if (opportunity) {
            this.pendingConfirmations.delete(opportunityId);
            await this.executeOpportunity(opportunity);
        }
    }

    rejectOpportunity(opportunityId: string): void {
        this.pendingConfirmations.delete(opportunityId);
        this.emitEvent({
            type: 'opportunity_expired',
            timestamp: new Date().toISOString(),
            message: 'Opportunity rejected by user',
        });
    }

    // Helpers
    private validateCredentials(): boolean {
        // For now, just check if any credentials are provided
        // In production, would validate API keys, signatures, etc.
        return true; // Allow bot to run in demo mode
    }

    private getTotalExposure(): number {
        return this.state.activePositions.reduce(
            (sum, pos) => sum + (pos.entryPrice * pos.quantity),
            0
        );
    }
}

// Singleton instance for app-wide use
let botInstance: ArbitrageBot | null = null;

export function getArbitrageBot(
    config?: BotConfig,
    credentials?: ExecutionCredentials
): ArbitrageBot {
    if (!botInstance && config && credentials) {
        botInstance = new ArbitrageBot(config, credentials);
    }
    if (!botInstance) {
        throw new Error('Bot not initialized. Call with config and credentials first.');
    }
    return botInstance;
}

export function initializeBot(
    config: BotConfig,
    credentials: ExecutionCredentials,
    apiBaseUrl = ''
): ArbitrageBot {
    botInstance = new ArbitrageBot(config, credentials, apiBaseUrl);
    return botInstance;
}
