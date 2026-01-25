'use client';

import { ReactNode } from 'react';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wallet/config';

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

interface WalletProviderProps {
    children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#a855f7',
                        accentColorForeground: 'white',
                        borderRadius: 'medium',
                        fontStack: 'system',
                        overlayBlur: 'small',
                    })}
                    modalSize="compact"
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
