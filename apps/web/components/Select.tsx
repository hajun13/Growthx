'use client';

import { useId } from 'react';
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-col gap-1.5">
      {label && (
        <Label htmlFor={id} className={cn(hideLabel && 'sr-only')}>
          {label}
        </Label>
      )}
      {/* Radix Select 는 빈 문자열 value 를 허용하지 않아 undefined 로 전달. */}
      <UISelect
        value={value || undefined}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-invalid={!!error || undefined}
          className={cn(error && 'border-destructive')}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </UISelect>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
