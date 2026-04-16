import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider, PriceProvider, ErrorBoundary } from "@/components";
import { NavBar } from "@/components/NavBar";
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
                <NavBar />

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
