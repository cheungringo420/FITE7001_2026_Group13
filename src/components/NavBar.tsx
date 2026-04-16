'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectionStatusIndicator } from '@/components/ConnectionStatusIndicator';
import { WalletButton } from '@/components/WalletButton';

/* ─────────────────────────────────────────
   Nav data
───────────────────────────────────────── */

const MAIN_NAV = [
  {
    href: '/',
    exact: true,
    label: 'Markets',
    featured: false,
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" />
      </svg>
    ),
  },
  {
    href: '/terminal',
    exact: false,
    label: 'Terminal',
    featured: false,
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/compare',
    exact: false,
    label: 'Compare',
    featured: false,
    icon: (
      <span className="flex items-center gap-0.5 flex-shrink-0">
        <span className="w-3.5 h-3.5 rounded bg-brand-500/30 text-brand-300 text-[9px] flex items-center justify-center font-bold leading-none">P</span>
        <span className="text-slate-600 text-[9px] leading-none">vs</span>
        <span className="w-3.5 h-3.5 rounded bg-cyan-500/30 text-cyan-400 text-[9px] flex items-center justify-center font-bold leading-none">K</span>
      </span>
    ),
  },
  {
    href: '/arbitrage',
    exact: false,
    label: 'Arbitrage',
    featured: true,
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    href: '/research',
    exact: false,
    label: 'Research',
    featured: false,
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/signals',
    exact: false,
    label: 'Signals',
    featured: false,
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
];

const TOOLS_NAV = [
  {
    href: '/bot',
    label: 'Auto Bot',
    desc: 'Automated trading',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
      </svg>
    ),
  },
  {
    href: '/portfolio',
    label: 'Portfolio',
    desc: 'Track positions & P&L',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
  },
  {
    href: '/options',
    label: 'Options IV',
    desc: 'Volatility analysis',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
  {
    href: '/learn',
    label: 'Learn',
    desc: 'How prediction markets work',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */

function useIsActive(pathname: string) {
  return (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };
}

/* ─────────────────────────────────────────
   NavBar
───────────────────────────────────────── */

export function NavBar() {
  const pathname = usePathname();
  const isActive = useIsActive(pathname);
  const toolsActive = TOOLS_NAV.some((t) => isActive(t.href));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
      {/* Ambient gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-brand-500/[0.07] via-transparent to-cyan-500/[0.07] pointer-events-none" />
      {/* Micro grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(23,227,193,1) 1px, transparent 1px), linear-gradient(90deg, rgba(23,227,193,1) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ─────────────────────────── */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-cyan-400 rounded-xl blur-md opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
              <div className="relative w-9 h-9 bg-gradient-to-br from-brand-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col">
              <span
                className="font-bold text-lg bg-gradient-to-r from-brand-300 to-cyan-300 bg-clip-text text-transparent"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                PM Arbitrage
              </span>
              <span className="text-[10px] text-slate-500 -mt-0.5 tracking-[0.22em] font-mono">
                PREDICTION MARKETS
              </span>
            </div>
          </Link>

          {/* ── Main Nav ─────────────────────── */}
          <div className="hidden md:flex items-center gap-0.5">
            {MAIN_NAV.map((item) => {
              const active = isActive(item.href, item.exact);

              if (item.featured) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'relative px-3.5 py-[7px] text-[11px] font-medium flex items-center gap-1.5 rounded-lg transition-all duration-200 border nav-item',
                      active
                        ? 'bg-gradient-to-r from-brand-500/20 to-cyan-500/20 text-[#17e3c1] border-[rgba(23,227,193,0.5)] nav-featured-active'
                        : 'bg-gradient-to-r from-brand-500/10 to-cyan-500/10 text-brand-200 border-brand-500/25 hover:from-brand-500/18 hover:to-cyan-500/18 hover:border-brand-500/40 hover:text-[#17e3c1]',
                    ].join(' ')}
                    style={{ fontFamily: 'var(--font-jetbrains-mono)' }}
                  >
                    {active && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-[1.5px] bg-gradient-to-r from-transparent via-[#17e3c1] to-transparent nav-indicator-line" />
                    )}
                    {item.icon}
                    {item.label}
                  </Link>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'relative px-3.5 py-[7px] text-[11px] font-medium flex items-center gap-1.5 rounded-lg transition-all duration-200 nav-item',
                    active
                      ? 'text-[#17e3c1] bg-[rgba(23,227,193,0.07)] nav-active'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]',
                  ].join(' ')}
                  style={{ fontFamily: 'var(--font-jetbrains-mono)' }}
                >
                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-[1.5px] bg-gradient-to-r from-transparent via-[#17e3c1] to-transparent nav-indicator-line" />
                  )}
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}

            {/* Divider */}
            <div className="w-px h-5 bg-slate-700/50 mx-1.5" />

            {/* ── Tools Dropdown ───────────────── */}
            <div className="relative group">
              <button
                className={[
                  'relative px-3.5 py-[7px] text-[11px] font-medium flex items-center gap-1.5 rounded-lg transition-all duration-200 nav-item',
                  toolsActive
                    ? 'text-[#17e3c1] bg-[rgba(23,227,193,0.07)] nav-active'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]',
                ].join(' ')}
                style={{ fontFamily: 'var(--font-jetbrains-mono)' }}
              >
                {toolsActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-[1.5px] bg-gradient-to-r from-transparent via-[#17e3c1] to-transparent nav-indicator-line" />
                )}
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Tools
                <svg
                  className="w-2.5 h-2.5 opacity-40 transition-transform duration-200 group-hover:rotate-180"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown panel */}
              <div className="absolute top-full left-0 mt-2 w-60 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-2 group-hover:translate-y-0 z-50">
                <div className="bg-[rgba(13,18,26,0.98)] border border-slate-700/40 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl web3-glow">
                  {/* Terminal chrome bar */}
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-800/60 bg-slate-900/40">
                    <span className="w-2 h-2 rounded-full bg-red-500/40" />
                    <span className="w-2 h-2 rounded-full bg-amber-500/40" />
                    <span className="w-2 h-2 rounded-full bg-green-500/40" />
                    <span
                      className="text-slate-600 text-[10px] ml-2 select-none"
                      style={{ fontFamily: 'var(--font-jetbrains-mono)' }}
                    >
                      ~/tools
                    </span>
                  </div>
                  <div className="p-1.5 flex flex-col gap-0.5">
                    {TOOLS_NAV.map((tool) => {
                      const active = isActive(tool.href);
                      return (
                        <Link
                          key={tool.href}
                          href={tool.href}
                          className={[
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 border',
                            active
                              ? 'bg-[rgba(23,227,193,0.07)] border-[rgba(23,227,193,0.2)]'
                              : 'border-transparent hover:bg-white/[0.04]',
                          ].join(' ')}
                        >
                          <span className={active ? 'text-[#17e3c1]' : 'text-slate-500'}>
                            {tool.icon}
                          </span>
                          <div>
                            <div
                              className={[
                                'text-[11px] font-medium flex items-center gap-1',
                                active ? 'text-[#17e3c1]' : 'text-slate-200',
                              ].join(' ')}
                              style={{ fontFamily: 'var(--font-jetbrains-mono)' }}
                            >
                              {active && (
                                <span className="text-[#17e3c1] opacity-70">›</span>
                              )}
                              {tool.label}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{tool.desc}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right side ───────────────────── */}
          <div className="flex items-center gap-3">
            <ConnectionStatusIndicator />
            <WalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
