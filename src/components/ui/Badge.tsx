import { clsx } from 'clsx';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
  children: React.ReactNode;
  className?: string;
}

const variants = {
  default: 'bg-muted text-muted-fg border-transparent',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  error:   'bg-destructive/10 text-destructive border-destructive/20',
  info:    'bg-primary/10 text-primary border-primary/20',
  outline: 'bg-transparent text-primary border-primary/40',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
