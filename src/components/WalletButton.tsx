'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Image from 'next/image';

export function WalletButton() {
    return (
        <ConnectButton.Custom>
            {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                mounted,
            }) => {
                const ready = mounted;
                const connected = ready && account && chain;

                return (
                    <div
                    >
                        {(() => {
                            if (!ready) {
                                return (
                                    <button
                                        className="px-4 py-2 bg-slate-800 text-slate-400 font-semibold rounded-lg text-sm cursor-wait"
                                        disabled
                                    >
                                        Initializing...
                                    </button>
                                );
                            }
                            if (!connected) {
                                return (
                                    <button
                                        onClick={openConnectModal}
                                        className="px-4 py-2 bg-gradient-to-r from-brand-500 to-accent-cyan hover:from-brand-600 hover:to-accent-cyan text-white font-semibold rounded-lg transition-all text-sm shadow-glow-sm"
                                    >
                                        Connect Wallet
                                    </button>
                                );
                            }

                            if (chain.unsupported) {
                                return (
                                    <button
                                        onClick={openChainModal}
                                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all text-sm"
                                    >
                                        Wrong Network
                                    </button>
                                );
                            }

                            return (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={openChainModal}
                                        className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                                    >
                                        {chain.hasIcon && chain.iconUrl && (
                                            <Image
                                                src={chain.iconUrl}
                                                alt={chain.name ?? 'Chain'}
                                                width={16}
                                                height={16}
                                                className="w-4 h-4 rounded-full"
                                            />
                                        )}
                                        <span className="hidden xl:inline">{chain.name}</span>
                                    </button>

                                    <button
                                        onClick={openAccountModal}
                                        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-brand-500/15 to-accent-cyan/15 hover:from-brand-500/25 hover:to-accent-cyan/25 border border-brand-500/30 text-white rounded-lg text-sm transition-colors"
                                    >
                                        {account.displayBalance && (
                                            <span className="hidden 2xl:inline text-slate-300">
                                                {account.displayBalance}
                                            </span>
                                        )}
                                        <span className="font-mono text-brand-300">
                                            {account.displayName}
                                        </span>
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                );
            }}
        </ConnectButton.Custom >
    );
}
