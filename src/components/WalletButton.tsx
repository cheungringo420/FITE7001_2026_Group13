'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

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
                        {...(!ready && {
                            'aria-hidden': true,
                            style: {
                                opacity: 0,
                                pointerEvents: 'none',
                                userSelect: 'none',
                            },
                        })}
                    >
                        {(() => {
                            if (!connected) {
                                return (
                                    <button
                                        onClick={openConnectModal}
                                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all text-sm"
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
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={openChainModal}
                                        className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                                    >
                                        {chain.hasIcon && chain.iconUrl && (
                                            <img
                                                src={chain.iconUrl}
                                                alt={chain.name ?? 'Chain'}
                                                className="w-4 h-4 rounded-full"
                                            />
                                        )}
                                        {chain.name}
                                    </button>

                                    <button
                                        onClick={openAccountModal}
                                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/30 text-white rounded-lg text-sm transition-colors"
                                    >
                                        {account.displayBalance && (
                                            <span className="text-slate-300">
                                                {account.displayBalance}
                                            </span>
                                        )}
                                        <span className="font-mono text-purple-400">
                                            {account.displayName}
                                        </span>
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                );
            }}
        </ConnectButton.Custom>
    );
}
