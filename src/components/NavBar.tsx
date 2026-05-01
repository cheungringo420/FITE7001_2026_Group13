'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectionStatusIndicator } from '@/components/ConnectionStatusIndicator';

/* ─────────────────────────────────────────
   Nav data — six items, each mapped 1-to-1
   to a contribution declared in the report.
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
        href: '/trust',
        exact: false,
        label: 'Trust',
        featured: false,
        icon: (
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
        ),
    },
    {
        href: '/options',
        exact: false,
        label: 'Cross-Asset',
        featured: false,
        icon: (
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
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
];

function useIsActive(pathname: string) {
    return (href: string, exact = false) => {
        if (exact) return pathname === href;
        return pathname === href || pathname.startsWith(href + '/');
    };
}

export function NavBar() {
    const pathname = usePathname();
    const isActive = useIsActive(pathname);

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
                    </div>

                    {/* ── Right side: connection status only (paper-trade demo, no wallet) ───── */}
                    <div className="flex items-center gap-3">
                        <ConnectionStatusIndicator />
                    </div>
                </div>
            </div>
        </nav>
    );
}
