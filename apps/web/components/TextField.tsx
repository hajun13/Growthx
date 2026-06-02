'use client';

import { useId } from 'react';
import { cx } from '@/lib/ui';

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'password' | 'number';
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  readOnly?: boolean;
  disabled?: boolean;
  suffix?: string;
  hideLabel?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  multiline,
  rows = 4,
  placeholder,
  required,
  error,
  hint,
  readOnly,
  disabled,
  suffix,
  hideLabel,
}: TextFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const baseField = cx(
    'w-full rounded-md border bg-neutral-0 px-4 py-2 text-base text-neutral-900 outline-none transition-colors duration-fast placeholder:text-neutral-400 focus:border-primary-500 focus-visible:shadow-focus',
    error ? 'border-danger-500' : 'border-neutral-300',
    disabled && 'cursor-not-allowed bg-neutral-100 text-neutral-400',
  );

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className={cx(
          'text-sm font-medium text-neutral-700',
          hideLabel && 'sr-only',
        )}
      >
        {label}
        {required && <span className="ml-1 text-danger-500">*</span>}
      </label>

      <div className="relative">
        {multiline ? (
          <textarea
            id={id}
            value={value}
            rows={rows}
            placeholder={placeholder}
            required={required}
            readOnly={readOnly}
            disabled={disabled}
            aria-required={required || undefined}
            aria-invalid={!!error || undefined}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
            className={cx(baseField, 'resize-y')}
          />
        ) : (
          <input
            id={id}
            type={type}
            value={value}
            placeholder={placeholder}
            required={required}
            readOnly={readOnly}
            disabled={disabled}
            aria-required={required || undefined}
            aria-invalid={!!error || undefined}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
            className={cx(baseField, suffix && 'pr-10')}
          />
        )}
        {suffix && !multiline && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
            {suffix}
          </span>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
