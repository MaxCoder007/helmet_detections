import React from 'react';
import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  glowColor?: 'cyan' | 'pink' | 'emerald' | 'amber' | 'red';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  glowColor,
  className,
}) => {
  const borderClasses = {
    cyan: 'hover:border-accent-cyan/50',
    pink: 'hover:border-accent-pink/50',
    emerald: 'hover:border-status-success/50',
    amber: 'hover:border-status-warning/50',
    red: 'hover:border-status-error/50',
  };

  return (
    <div
      className={clsx(
        'bg-background-card border border-border rounded-xl p-5 shadow-card transition-all duration-200 flex flex-col justify-between relative overflow-hidden',
        glowColor && borderClasses[glowColor],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-medium text-text-secondary">{title}</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-text-primary mt-1.5 tracking-tight">
            {value}
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-background-hover border border-border text-text-primary shrink-0">
          {icon}
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
          {subtitle && <span className="text-text-muted">{subtitle}</span>}
          {trend && (
            <span
              className={clsx(
                'font-medium text-[11px]',
                trend.isPositive ? 'text-status-success' : 'text-status-error'
              )}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
