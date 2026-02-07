import { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'text' | 'circular' | 'rectangular';
  width?: string;
  height?: string;
}

const variantStyles = {
  default: 'rounded-lg',
  text: 'rounded h-4',
  circular: 'rounded-full',
  rectangular: 'rounded-xl',
};

export function Skeleton({ 
  variant = 'default',
  width,
  height,
  className = '', 
  style,
  ...props 
}: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-700/50 ${variantStyles[variant]} ${className}`}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" className="w-12 h-12" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    </div>
  );
}

export function MarketCardSkeleton() {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <Skeleton variant="rectangular" className="w-12 h-12" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}
