'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

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
  const invalidClass = error ? 'border-destructive focus-visible:ring-destructive' : '';

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={cn(hideLabel && 'sr-only')}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>

      <div className="relative">
        {multiline ? (
          <Textarea
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
            className={cn('resize-y', invalidClass)}
          />
        ) : (
          <Input
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
            className={cn(suffix && 'pr-10', invalidClass)}
          />
        )}
        {suffix && !multiline && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
