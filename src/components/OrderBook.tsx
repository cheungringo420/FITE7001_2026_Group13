'use client';

import { OrderBookLevel } from '@/lib/polymarket/types';

interface OrderBookProps {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    isLoading?: boolean;
}

export function OrderBook({ bids, asks, isLoading }: OrderBookProps) {
    // Sort bids descending by price, asks ascending
    const sortedBids = [...bids].sort((a, b) => parseFloat(b.price) - parseFloat(a.price)).slice(0, 10);
    const sortedAsks = [...asks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price)).slice(0, 10);

    // Calculate max size for bar width scaling
    const allSizes = [...sortedBids, ...sortedAsks].map(o => parseFloat(o.size));
    const maxSize = Math.max(...allSizes, 1);

    if (isLoading) {
        return (
            <div className="order-book bg-slate-900 rounded-xl p-4 animate-pulse">
                <div className="h-6 bg-slate-700 rounded mb-4 w-32"></div>
                <div className="space-y-2">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="h-6 bg-slate-800 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="order-book bg-slate-900/80 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Order Book
            </h3>

            {/* Header */}
            <div className="grid grid-cols-2 gap-4 mb-2 text-xs text-slate-400 uppercase tracking-wider">
                <div className="grid grid-cols-2">
                    <span>Size</span>
                    <span className="text-right">Bid</span>
                </div>
                <div className="grid grid-cols-2">
                    <span>Ask</span>
                    <span className="text-right">Size</span>
                </div>
            </div>

            {/* Order Book Rows */}
            <div className="space-y-1">
                {Array.from({ length: 10 }).map((_, index) => {
                    const bid = sortedBids[index];
                    const ask = sortedAsks[index];

                    return (
                        <div key={index} className="grid grid-cols-2 gap-4 text-sm">
                            {/* Bid Side */}
                            <div className="relative grid grid-cols-2 py-1">
                                {bid && (
                                    <>
                                        <div
                                            className="absolute inset-y-0 right-0 bg-green-500/20 rounded-l"
                                            style={{ width: `${(parseFloat(bid.size) / maxSize) * 100}%` }}
                                        />
                                        <span className="relative z-10 text-slate-300">
                                            {parseFloat(bid.size).toFixed(2)}
                                        </span>
                                        <span className="relative z-10 text-right text-green-400 font-mono">
                                            ${parseFloat(bid.price).toFixed(2)}
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Ask Side */}
                            <div className="relative grid grid-cols-2 py-1">
                                {ask && (
                                    <>
                                        <div
                                            className="absolute inset-y-0 left-0 bg-red-500/20 rounded-r"
                                            style={{ width: `${(parseFloat(ask.size) / maxSize) * 100}%` }}
                                        />
                                        <span className="relative z-10 text-red-400 font-mono">
                                            ${parseFloat(ask.price).toFixed(2)}
                                        </span>
                                        <span className="relative z-10 text-right text-slate-300">
                                            {parseFloat(ask.size).toFixed(2)}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Spread */}
            {sortedBids.length > 0 && sortedAsks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between text-sm">
                    <span className="text-slate-400">Spread</span>
                    <span className="text-slate-300 font-mono">
                        ${(parseFloat(sortedAsks[0].price) - parseFloat(sortedBids[0].price)).toFixed(4)}
                    </span>
                </div>
            )}
        </div>
    );
}
