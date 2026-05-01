import React from 'react';

type EmptyStateType = 'search' | 'arbitrage' | 'match';

interface EmptyStateProps {
    title: string;
    description: string;
    type?: EmptyStateType;
}

export function EmptyState({ title, description, type = 'search' }: EmptyStateProps) {
    // Premium SVG illustrations based on the type of empty state
    const Illustration = () => {
        switch (type) {
            case 'arbitrage':
                return (
                    <div className="relative w-40 h-40 mx-auto mb-6 group">
                        {/* Background glow */}
                        <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl group-hover:bg-green-500/30 transition-all duration-700"></div>

                        {/* Center circle */}
                        <div className="absolute inset-4 rounded-full border border-slate-700/50 bg-slate-800/80 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                            {/* Animated scanner line */}
                            <div className="absolute left-0 right-0 h-0.5 bg-green-500/50 shadow-[0_0_8px_2px_rgba(34,197,94,0.4)] animate-[scan_3s_ease-in-out_infinite]"></div>

                            <svg className="w-16 h-16 text-slate-500 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>

                        {/* Orbiting elements */}
                        <div className="absolute inset-0 animate-[spin_10s_linear_infinite]">
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.5)]"></div>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-brand-400 shadow-[0_0_10px_2px_rgba(99,102,241,0.5)]"></div>
                        </div>
                    </div>
                );
            case 'match':
                return (
                    <div className="relative w-40 h-40 mx-auto mb-6 group">
                        <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-2xl group-hover:bg-brand-500/30 transition-all duration-700"></div>

                        <div className="absolute inset-4 rounded-full border border-slate-700/50 bg-slate-800/80 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                <svg className="w-full h-full text-brand-400 animate-[spin_20s_linear_infinite]" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="5,5" />
                                    <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="10,10" />
                                </svg>
                            </div>

                            <svg className="w-16 h-16 text-slate-500 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 10l-2 2m0 0l2 2m-2-2h6" />
                            </svg>
                        </div>
                    </div>
                );
            case 'search':
            default:
                return (
                    <div className="relative w-40 h-40 mx-auto mb-6 group">
                        <div className="absolute inset-0 bg-slate-500/20 rounded-full blur-2xl group-hover:bg-slate-500/30 transition-all duration-700"></div>

                        <div className="absolute inset-4 rounded-full border border-slate-700/50 bg-slate-800/80 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                            {/* Floating elements */}
                            <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
                            <div className="absolute bottom-1/3 right-1/4 w-3 h-3 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '500ms' }}></div>
                            <div className="absolute top-1/2 right-1/3 w-1.5 h-1.5 rounded-full bg-slate-400 animate-ping"></div>

                            <svg className="w-16 h-16 text-slate-500 relative z-10 animate-[bounce_3s_ease-in-out_infinite]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="bg-slate-800/30 rounded-2xl p-12 text-center border border-slate-700/50 backdrop-blur-sm overflow-hidden relative">
            {/* Subtle background texture */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

            <Illustration />

            <h3 className="text-xl font-semibold text-white mb-3 tracking-tight">
                {title}
            </h3>
            <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
                {description}
            </p>
        </div>
    );
}
