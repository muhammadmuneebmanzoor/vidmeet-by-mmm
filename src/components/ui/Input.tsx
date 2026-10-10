import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  id,
  ...props
}) => {
  const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={generatedId}
          className="text-xs font-semibold text-[var(--text)] block"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3.5 text-[var(--muted)] pointer-events-none flex items-center justify-center">
            {leftIcon}
          </span>
        )}

        <input
          id={generatedId}
          disabled={disabled}
          className={`w-full py-2.5 rounded-xl border text-sm transition-colors bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 ${
            leftIcon ? 'pl-10' : 'pl-3.5'
          } ${rightIcon ? 'pr-10' : 'pr-3.5'} ${
            error
              ? 'border-red-500 focus:border-red-500'
              : 'border-[var(--border)] focus:border-[var(--primary)]'
          } ${disabled ? 'bg-[var(--bg)] cursor-not-allowed opacity-60' : ''} ${className}`}
          {...props}
        />

        {rightIcon && (
          <span className="absolute right-3.5 text-[var(--muted)] flex items-center justify-center">
            {rightIcon}
          </span>
        )}
      </div>

      {error ? (
        <p className="text-xs font-medium text-red-500 animate-in fade-in duration-150">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-[var(--muted)]">{helperText}</p>
      ) : null}
    </div>
  );
};
