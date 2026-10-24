import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'accent-pink';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  const variantClasses = {
    primary:
      'bg-accent-cyan text-background font-semibold hover:bg-accent-cyan/90 focus:ring-accent-cyan/50 shadow-glow-cyan/50 shadow-sm',
    'accent-pink':
      'bg-accent-pink text-background font-semibold hover:bg-accent-pink/90 focus:ring-accent-pink/50 shadow-glow-pink/50 shadow-sm',
    secondary:
      'bg-background-card hover:bg-background-hover text-text-primary border border-border focus:ring-accent-cyan/30',
    outline:
      'bg-transparent hover:bg-background-card text-text-secondary hover:text-text-primary border border-border focus:ring-accent-cyan/30',
    danger:
      'bg-status-error/15 text-status-error border border-status-error/30 hover:bg-status-error/25 focus:ring-status-error/40',
    ghost:
      'bg-transparent hover:bg-background-card/80 text-text-secondary hover:text-text-primary focus:ring-accent-cyan/20',
  };

  return (
    <button
      className={clsx(
        baseClasses,
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && (
        <span className="inline-flex shrink-0">{rightIcon}</span>
      )}
    </button>
  );
};
