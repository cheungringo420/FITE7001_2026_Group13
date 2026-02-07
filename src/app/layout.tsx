import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { WalletProvider, WalletButton, PriceProvider, ConnectionStatusIndicator, ErrorBoundary } from "@/components";
import { PortfolioProvider } from "@/contexts/PortfolioContext";

export const metadata: Metadata = {
  title: "Prediction Market Arbitrage | Real-time Orderbook",
  description: "Discover arbitrage opportunities across prediction markets with real-time orderbook data from Polymarket and more.",
  keywords: ["prediction market", "arbitrage", "polymarket", "orderbook", "trading"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className="antialiased text-white min-h-screen"
        style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}
      >
        <WalletProvider>
          <PriceProvider>
            <PortfolioProvider>
              <ErrorBoundary>
                {/* Premium Navigation */}
                <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-500/10 via-transparent to-accent-cyan/10 pointer-events-none" />
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="flex items-center justify-between h-16">
                      {/* Logo */}
                      <Link href="/" className="flex items-center gap-3 group">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-accent-cyan rounded-xl blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
                          <div className="relative w-9 h-9 bg-gradient-to-br from-brand-500 to-accent-cyan rounded-xl flex items-center justify-center shadow-lg">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-lg bg-gradient-to-r from-brand-300 to-accent-cyan bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                            PM Arbitrage
                          </span>
                          <span className="text-[10px] text-slate-500 -mt-0.5 tracking-[0.2em]">PREDICTION MARKETS</span>
                        </div>
                      </Link>

                      {/* Main Navigation - Consolidated */}
                      <div className="hidden md:flex items-center gap-1">
                        {/* Primary Nav Links */}
                        <Link href="/" className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                          Markets
                        </Link>
                        <Link href="/terminal" className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                          Terminal
                        </Link>

                        {/* Compare - Key Feature */}
                        <Link href="/compare" className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all flex items-center gap-2">
                          <span className="flex items-center gap-0.5">
                            <span className="w-3.5 h-3.5 rounded bg-brand-500/30 text-brand-300 text-[9px] flex items-center justify-center font-bold">P</span>
                            <span className="text-slate-600 text-xs">vs</span>
                            <span className="w-3.5 h-3.5 rounded bg-accent-cyan/30 text-accent-cyan text-[9px] flex items-center justify-center font-bold">K</span>
                          </span>
                          Compare
                        </Link>

                        {/* Arbitrage - Highlighted Feature */}
                        <Link href="/arbitrage" className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-brand-500/15 to-accent-cyan/15 text-brand-200 hover:from-brand-500/25 hover:to-accent-cyan/25 rounded-lg transition-all flex items-center gap-2 border border-brand-500/30 border-glow-accent">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          Arbitrage
                        </Link>

                        {/* Divider */}
                        <div className="w-px h-6 bg-slate-700/50 mx-2"></div>

                        {/* Tools Dropdown Group */}
                        <div className="relative group">
                          <button className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            Tools
                            <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {/* Dropdown Menu */}
                          <div className="absolute top-full left-0 mt-1 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 z-50">
                          <div className="bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl web3-glow">
                            <div className="p-2">
                              <Link href="/bot" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-lg">⚙</span>
                                <div>
                                  <div className="text-sm font-medium text-white">Auto Bot</div>
                                  <div className="text-xs text-slate-500">Automated trading</div>
                                </div>
                              </Link>
                              <Link href="/portfolio" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-lg">◎</span>
                                <div>
                                  <div className="text-sm font-medium text-white">Portfolio</div>
                                  <div className="text-xs text-slate-500">Track positions & P&L</div>
                                </div>
                              </Link>
                              <Link href="/options" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-lg">∑</span>
                                <div>
                                  <div className="text-sm font-medium text-white">Options IV</div>
                                  <div className="text-xs text-slate-500">Volatility analysis</div>
                                </div>
                              </Link>
                            </div>
                          </div>
                        </div>
                        </div>
                      </div>

                      {/* Right Side - Status & Wallet */}
                      <div className="flex items-center gap-3">
                        <ConnectionStatusIndicator />
                        <WalletButton />
                      </div>
                    </div>
                  </div>
                </nav>

                {/* Main Content */}
                <main className="pt-16">
                  {children}
                </main>

                {/* Premium Footer */}
                <footer className="border-t border-slate-800/30 py-12 mt-20 relative overflow-hidden">
                  <div className="absolute inset-0 terminal-bg opacity-40" />
                  <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-brand-500/20 to-accent-cyan/20 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                        <p className="text-slate-400 text-sm">
                          PM Arbitrage — Cross-Platform Prediction Market Intelligence
                        </p>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-slate-500">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-brand-500/50"></span>
                          Polymarket
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-accent-cyan/50"></span>
                          Kalshi
                        </span>
                        <span className="text-slate-600">•</span>
                        <span>Not financial advice</span>
                      </div>
                    </div>
                  </div>
                </footer>
              </ErrorBoundary>
            </PortfolioProvider>
          </PriceProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
