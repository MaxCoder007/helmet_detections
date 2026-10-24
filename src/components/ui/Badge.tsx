import React from 'react';
import { clsx } from 'clsx';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'cyan' | 'pink' | 'purple';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'default',
  size = 'md',
  dot = false,
  ...props
}) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variantClasses = {
    default: 'bg-background-hover text-text-secondary border-border',
    success: 'bg-status-success/10 text-status-success border-status-success/30',
    warning: 'bg-status-warning/10 text-status-warning border-status-warning/30',
    error: 'bg-status-error/10 text-status-error border-status-error/30',
    cyan: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30',
    pink: 'bg-accent-pink/10 text-accent-pink border-accent-pink/30',
    purple: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  };

  const dotColorClasses = {
    default: 'bg-text-secondary',
    success: 'bg-status-success',
    warning: 'bg-status-warning',
    error: 'bg-status-error',
    cyan: 'bg-accent-cyan',
    pink: 'bg-accent-pink',
    purple: 'bg-purple-400',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium rounded-full border tracking-wide select-none',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={clsx('w-1.5 h-1.5 rounded-full shrink-0 animate-pulse', dotColorClasses[variant])}
        />
      )}
      <span>{children}</span>
    </span>
  );
};
