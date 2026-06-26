import { clsx } from 'clsx';
import { type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'google';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variants = {
  primary:   'bg-primary text-white hover:bg-primary-hover active:bg-primary-hover disabled:opacity-50',
  secondary: 'bg-white text-foreground border border-border hover:bg-muted active:bg-muted disabled:opacity-50',
  ghost:     'text-muted-fg hover:bg-muted hover:text-foreground active:bg-muted disabled:opacity-50',
  danger:    'bg-destructive text-white hover:bg-destructive/90 active:bg-destructive/80 disabled:opacity-50',
  google:    'bg-card text-foreground border border-border hover:bg-muted shadow-card',
};

const sizes = {
  sm: 'h-7 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-sm gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-colors dk-press',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'cursor-pointer select-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
          style={{ animation: 'dk-spin 0.75s linear infinite' }}
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
