import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider, WalletButton } from "@/components";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

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
        className={`${inter.variable} font-sans antialiased bg-slate-950 text-white min-h-screen`}
      >
        <WalletProvider>
          {/* Navigation */}
          <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <a href="/" className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <span className="font-bold text-xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    PM Arbitrage
                  </span>
                </a>

                <div className="flex items-center gap-6">
                  <a href="/" className="text-slate-300 hover:text-white transition-colors">
                    Markets
                  </a>
                  <a href="/compare" className="text-slate-300 hover:text-white transition-colors flex items-center gap-1">
                    <span className="flex items-center gap-1">
                      <span className="w-4 h-4 rounded bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center font-bold">P</span>
                      <span className="text-slate-500">vs</span>
                      <span className="w-4 h-4 rounded bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-bold">K</span>
                    </span>
                    Compare
                  </a>
                  <a href="/arbitrage" className="text-slate-300 hover:text-white transition-colors flex items-center gap-1">
                    Arbitrage
                    <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">SCAN</span>
                  </a>
                  <WalletButton />
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="pt-16">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-800/50 py-8 mt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-slate-500 text-sm">
                  Prediction Market Arbitrage Discovery Platform
                </p>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span>Data from Polymarket & Kalshi</span>
                  <span>•</span>
                  <span>Not financial advice</span>
                </div>
              </div>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
