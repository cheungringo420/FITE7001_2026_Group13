'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { OrderBook, TradingPanel } from '@/components';
import {
    Market,
    OrderBook as OrderBookType,
    parseMarket,
    ParsedMarket,
    getPolymarketWebSocket,
    WebSocketEvent,
    BookEvent
} from '@/lib/polymarket';

interface Props {
    params: Promise<{ conditionId: string }>;
}

export default function MarketPage({ params }: Props) {
    const resolvedParams = use(params);
    const { conditionId } = resolvedParams;

    const [market, setMarket] = useState<ParsedMarket | null>(null);
    const [orderBooks, setOrderBooks] = useState<{ [tokenId: string]: OrderBookType }>({});
    const [selectedOutcome, setSelectedOutcome] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch market data
    useEffect(() => {
        const fetchMarket = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const response = await fetch(`/api/markets/${conditionId}`);

                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('Market not found');
                    }
                    throw new Error('Failed to fetch market');
                }

                const data: Market = await response.json();
                const parsed = parseMarket(data);
                setMarket(parsed);

                // Fetch initial orderbooks for all tokens
                if (parsed.clobTokenIds.length > 0) {
                    const books: { [tokenId: string]: OrderBookType } = {};

                    await Promise.all(
                        parsed.clobTokenIds.map(async (tokenId) => {
                            try {
                                const obResponse = await fetch(`/api/orderbook/${tokenId}`);
                                if (obResponse.ok) {
                                    books[tokenId] = await obResponse.json();
                                }
                            } catch (e) {
                                console.error(`Failed to fetch orderbook for ${tokenId}:`, e);
                            }
                        })
                    );

                    setOrderBooks(books);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        fetchMarket();
    }, [conditionId]);

    // WebSocket connection for real-time updates
    const handleWsEvent = useCallback((event: WebSocketEvent) => {
        if (event.event_type === 'book') {
            const bookEvent = event as BookEvent;
            setOrderBooks(prev => ({
                ...prev,
                [bookEvent.asset_id]: {
                    market: bookEvent.market,
                    asset_id: bookEvent.asset_id,
                    hash: '',
                    timestamp: bookEvent.timestamp,
                    bids: bookEvent.bids,
                    asks: bookEvent.asks,
                }
            }));
        }
    }, []);

    useEffect(() => {
        if (!market || market.clobTokenIds.length === 0) return;

        const ws = getPolymarketWebSocket();

        // Set up event handlers
        const removeEventHandler = ws.onEvent(handleWsEvent);
        const removeConnectionHandler = ws.onConnectionChange(setIsWsConnected);

        // Subscribe to market's token IDs
        ws.subscribe(market.clobTokenIds);

        return () => {
            removeEventHandler();
            removeConnectionHandler();
            ws.unsubscribe(market.clobTokenIds);
        };
    }, [market, handleWsEvent]);

    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="animate-pulse">
                    <div className="h-8 bg-slate-800 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-slate-800 rounded w-1/2 mb-8"></div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 h-96 bg-slate-800 rounded-2xl"></div>
                        <div className="h-96 bg-slate-800 rounded-2xl"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !market) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
                    <h2 className="text-xl font-semibold text-red-400 mb-2">
                        {error || 'Market not found'}
                    </h2>
                    <p className="text-slate-400 mb-4">
                        The market you&apos;re looking for doesn&apos;t exist or has been removed.
                    </p>
                    <a
                        href="/"
                        className="inline-block px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors"
                    >
                        ← Back to Markets
                    </a>
                </div>
            </div>
        );
    }

    const currentTokenId = market.clobTokenIds[selectedOutcome];
    const currentOrderBook = orderBooks[currentTokenId];
    const yesPrice = market.outcomePrices[0] || 0.5;
    const noPrice = market.outcomePrices[1] || 0.5;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Back button */}
            <a
                href="/"
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Markets
            </a>

            {/* Market Header */}
            <div className="mb-8">
                <div className="flex items-start gap-4 mb-4">
                    {market.image && (
                        <img
                            src={market.image}
                            alt=""
                            className="w-16 h-16 rounded-xl ring-2 ring-slate-700"
                        />
                    )}
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-white mb-2">
                            {market.question}
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                            {market.category && (
                                <span className="px-2 py-1 bg-slate-800 rounded-full">
                                    {market.category}
                                </span>
                            )}
                            <span>
                                Volume: ${parseFloat(market.volume).toLocaleString()}
                            </span>
                            {market.volume24hr > 0 && (
                                <span>
                                    24h: ${market.volume24hr.toLocaleString()}
                                </span>
                            )}
                            <span className={`flex items-center gap-1 ${isWsConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                                <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                                {isWsConnected ? 'Live' : 'Connecting...'}
                            </span>
                        </div>
                    </div>
                </div>

                {market.description && (
                    <p className="text-slate-400 max-w-3xl">
                        {market.description}
                    </p>
                )}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Order Book */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Outcome Selector */}
                    <div className="flex gap-2">
                        {market.outcomes.map((outcome, index) => (
                            <button
                                key={index}
                                onClick={() => setSelectedOutcome(index)}
                                className={`
                  flex-1 py-3 px-4 rounded-xl font-semibold transition-all
                  ${selectedOutcome === index
                                        ? index === 0
                                            ? 'bg-green-500 text-white'
                                            : 'bg-red-500 text-white'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }
                `}
                            >
                                {outcome} @ {(market.outcomePrices[index] * 100).toFixed(1)}¢
                            </button>
                        ))}
                    </div>

                    {/* Order Book */}
                    <OrderBook
                        bids={currentOrderBook?.bids || []}
                        asks={currentOrderBook?.asks || []}
                        isLoading={!currentOrderBook}
                    />

                    {/* Market Stats */}
                    <div className="bg-slate-800/50 rounded-xl p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                            <div className="text-sm text-slate-400 mb-1">Best Bid (Yes)</div>
                            <div className="text-xl font-bold text-green-400">
                                {market.bestBid ? `${(market.bestBid * 100).toFixed(1)}¢` : '—'}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-400 mb-1">Best Ask (Yes)</div>
                            <div className="text-xl font-bold text-red-400">
                                {market.bestAsk ? `${(market.bestAsk * 100).toFixed(1)}¢` : '—'}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-400 mb-1">Last Trade</div>
                            <div className="text-xl font-bold text-white">
                                {market.lastTradePrice ? `${(market.lastTradePrice * 100).toFixed(1)}¢` : '—'}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-400 mb-1">Liquidity</div>
                            <div className="text-xl font-bold text-white">
                                ${parseFloat(market.liquidity).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Trading Panel */}
                <div className="lg:col-span-1">
                    <TradingPanel
                        yesPrice={yesPrice}
                        noPrice={noPrice}
                        marketQuestion={market.question}
                        outcomes={market.outcomes}
                        disabled={true}
                    />
                </div>
            </div>
        </div>
    );
}
