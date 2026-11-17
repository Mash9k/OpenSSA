'use client';

import { cn } from '@/lib/utils';

interface IndicatorBadgeProps {
  type: 'deletion-safety' | 'system-health';
  value: 'safe' | 'unsafe' | 'suspicious' | 'healthy' | 'mixed' | 'issue';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

interface BadgeConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
}

const deletionSafetyConfig: Record<string, BadgeConfig> = {
  safe: { label: 'Safe to Delete', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.15)', border: '#2563EB' },
  unsafe: { label: 'Unsafe / Critical', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.15)', border: '#DC2626' },
  suspicious: { label: 'Suspicious / Review', color: '#D97706', bg: 'rgba(217, 119, 6, 0.15)', border: '#D97706' },
};

const systemHealthConfig: Record<string, BadgeConfig> = {
  healthy: { label: 'No Issue', color: '#16A34A', bg: 'rgba(22, 163, 74, 0.15)', border: '#16A34A' },
  mixed: { label: 'Mixed', color: '#EA580C', bg: 'rgba(234, 88, 12, 0.15)', border: '#EA580C' },
  issue: { label: 'Issue', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.15)', border: '#DC2626' },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-3 py-1 text-sm gap-1.5',
  lg: 'px-4 py-1.5 text-base gap-2',
};

export function IndicatorBadge({ type, value, size = 'md', showLabel = true }: IndicatorBadgeProps) {
  const config = type === 'deletion-safety' ? deletionSafetyConfig : systemHealthConfig;
  const cfg = config[value];
  
  if (!cfg) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded border',
        'transition-colors',
        sizeClasses[size]
      )}
      style={{
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        color: cfg.color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: cfg.color }}
      />
      {showLabel && <span className="whitespace-nowrap">{cfg.label}</span>}
    </span>
  );
}