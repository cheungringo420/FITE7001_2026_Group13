import { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'brand';
  size?: 'sm' | 'md';
  pulse?: boolean;
  dot?: boolean;
}

const variantStyles = {
  default: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  brand: 'bg-brand-500/10 text-brand-300 border-brand-500/20',
};

const dotColors = {
  default: 'bg-slate-400',
  success: 'bg-green-500',
  danger: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-cyan-500',
  brand: 'bg-brand-500',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export function Badge({ 
  variant = 'default', 
  size = 'sm', 
  pulse = false,
  dot = false,
  className = '', 
  children,
  ...props 
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full border
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {(pulse || dot) && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors[variant]}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColors[variant]}`} />
        </span>
      )}
      {children}
    </span>
  );
}
