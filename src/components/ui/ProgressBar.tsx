'use client';

import { cn } from '@/lib/utils';

export function ProgressBar({ 
  value, 
  max = 100, 
  className,
  showLabel = true,
  variant = 'default',
  size = 'md',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  value: number;
  max?: number;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'cpu' | 'ram' | 'gpu';
  size?: 'sm' | 'md' | 'lg';
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const variants = {
    default: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    cpu: 'bg-gradient-to-r from-blue-500 to-cyan-400',
    ram: 'bg-gradient-to-r from-purple-500 to-pink-400',
    gpu: 'bg-gradient-to-r from-orange-500 to-red-400',
  };

  const sizes = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const labelSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className={cn('w-full', className)} {...props}>
      <div className="flex items-center justify-between mb-1">
        {showLabel && <span className={cn('font-medium text-gray-700 dark:text-gray-300', labelSizes[size])}>{percentage.toFixed(1)}%</span>}
      </div>
      <div className={cn('relative rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden', sizes[size])}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            variants[variant]
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}