import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium" style={{ color: 'hsl(180 100% 3%)' }}>
            {label}
            {props.required && <span className="ml-0.5" style={{ color: 'hsl(0 84% 60%)' }} aria-hidden="true">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-3 py-2 text-sm rounded-lg border bg-white transition-colors outline-none
            focus:ring-2 focus:ring-offset-1
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-destructive focus:ring-destructive/30' : 'border-border focus:border-primary focus:ring-primary/20'}
            ${className}`}
          style={{ color: 'hsl(180 100% 3%)' }}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs" style={{ color: 'hsl(0 84% 60%)' }} role="alert">
            {error}
          </p>
        )}
        {helper && !error && (
          <p id={`${inputId}-helper`} className="text-xs" style={{ color: 'hsl(215 16% 47%)' }}>
            {helper}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
