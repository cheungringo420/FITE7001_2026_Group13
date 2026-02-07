'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { polygon, mainnet } from 'wagmi/chains';

// WalletConnect Project ID - you should get your own at https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const hasWalletConnect = Boolean(projectId && projectId !== 'demo-project-id');
const chains = [polygon, mainnet] as const;

const transports = {
    [polygon.id]: http(),
    [mainnet.id]: http(),
};

type WagmiConfig = ReturnType<typeof createConfig>;

declare global {
    var __wagmiConfig: WagmiConfig | undefined;
}

const buildWagmiConfig = (): WagmiConfig => {
    if (hasWalletConnect) {
        return getDefaultConfig({
            appName: 'PM Arbitrage',
            projectId: projectId as string,
            chains,
            ssr: true,
        });
    }

    if (process.env.NODE_ENV !== 'production') {
        console.warn('[Wallet] WalletConnect project ID not set. Falling back to injected wallets only.');
    }

    return createConfig({
        chains,
        transports,
        connectors: [injected()],
        ssr: true,
    });
};

export const wagmiConfig = globalThis.__wagmiConfig ?? (globalThis.__wagmiConfig = buildWagmiConfig());
export const walletConnectEnabled = hasWalletConnect;

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
