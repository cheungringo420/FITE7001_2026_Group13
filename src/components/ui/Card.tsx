'use client';

import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outline' | 'glass';
  hover?: boolean;
  glow?: 'none' | 'purple' | 'cyan' | 'green';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantStyles = {
  default: 'bg-slate-800/50 border border-slate-700/50',
  elevated: 'bg-gradient-to-br from-slate-800/80 to-slate-900/90 border border-slate-700/30 shadow-xl',
  outline: 'bg-transparent border border-slate-700/50',
  glass: 'bg-slate-900/70 backdrop-blur-xl border border-slate-700/30',
};

const glowStyles = {
  none: '',
  purple: 'hover:shadow-glow-md hover:border-brand-500/30',
  cyan: 'hover:shadow-glow-cyan hover:border-accent-cyan/30',
  green: 'hover:shadow-glow-green hover:border-green-500/30',
};

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ 
    variant = 'default', 
    hover = true, 
    glow = 'purple',
    padding = 'md',
    className = '', 
    children, 
    ...props 
  }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          rounded-2xl backdrop-blur-sm transition-all duration-300
          ${variantStyles[variant]}
          ${hover ? 'hover:-translate-y-0.5' : ''}
          ${glowStyles[glow]}
          ${paddingStyles[padding]}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = ({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`mb-4 ${className}`} {...props}>{children}</div>
);

export const CardTitle = ({ className = '', children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`text-lg font-semibold text-white ${className}`} {...props}>{children}</h3>
);

export const CardDescription = ({ className = '', children, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`text-sm text-slate-400 ${className}`} {...props}>{children}</p>
);

export const CardContent = ({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={className} {...props}>{children}</div>
);

export const CardFooter = ({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`mt-4 pt-4 border-t border-slate-700/50 ${className}`} {...props}>{children}</div>
);
