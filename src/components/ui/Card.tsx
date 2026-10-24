import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glow?: 'cyan' | 'pink' | 'none';
  variant?: 'default' | 'muted' | 'interactive';
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  glow = 'none',
  variant = 'default',
  ...props
}) => {
  const glowClasses = {
    none: '',
    cyan: 'hover:shadow-glow-cyan border-accent-cyan/40 transition-shadow duration-300',
    pink: 'hover:shadow-glow-pink border-accent-pink/40 transition-shadow duration-300',
  };

  const variantClasses = {
    default: 'bg-background-card border border-border',
    muted: 'bg-background-muted border border-border-subtle',
    interactive:
      'bg-background-card border border-border hover:border-border-active hover:bg-background-hover transition-all duration-200 cursor-pointer',
  };

  return (
    <div
      className={clsx(
        'rounded-xl p-5 shadow-card',
        variantClasses[variant],
        glowClasses[glow],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, className }) => (
  <div className={clsx('flex items-start justify-between gap-4 mb-4', className)}>
    <div>
      <h3 className="text-base font-semibold text-text-primary tracking-tight">{title}</h3>
      {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
