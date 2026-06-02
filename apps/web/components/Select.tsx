'use client';

import { useId } from 'react';
import { cx } from '@/lib/ui';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  hideLabel?: boolean;
}

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  error,
  hideLabel,
}: SelectProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={id}
          className={cx(
            'text-sm font-medium text-neutral-700',
            hideLabel && 'sr-only',
          )}
        >
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={!!error || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          'h-10 rounded-md border bg-neutral-0 px-3 text-base text-neutral-900 outline-none transition-colors duration-fast focus:border-primary-500 focus-visible:shadow-focus',
          error ? 'border-danger-500' : 'border-neutral-300',
          disabled && 'cursor-not-allowed bg-neutral-100 text-neutral-400',
        )}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-danger-600">{error}</p>}
    </div>
  );
}
