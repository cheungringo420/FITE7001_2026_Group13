'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygon, mainnet } from 'wagmi/chains';

// WalletConnect Project ID - you should get your own at https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

export const wagmiConfig = getDefaultConfig({
    appName: 'PM Arbitrage',
    projectId,
    chains: [polygon, mainnet],
    ssr: true,
});

// Polymarket uses Polygon network
export const POLYMARKET_CHAIN = polygon;

// Contract addresses
export const CONTRACTS = {
    // Polymarket CTF Exchange on Polygon
    CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as const,
    // USDC on Polygon
    USDC_POLYGON: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const,
    // Conditional Tokens Framework
    CONDITIONAL_TOKENS: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as const,
};

// API endpoints
export const API_ENDPOINTS = {
    POLYMARKET_CLOB: 'https://clob.polymarket.com',
    POLYMARKET_GAMMA: 'https://gamma-api.polymarket.com',
    KALSHI: 'https://api.elections.kalshi.com/trade-api/v2',
};
