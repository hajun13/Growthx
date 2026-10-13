'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
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

/** @deprecated — L1(@/components/ui/field·input·textarea) 사용으로 이관 대상. */
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
  // 에러 표시(border/ring)는 L1 의 aria-invalid 스타일이 담당한다.
  const common = {
    id,
    value,
    placeholder,
    required,
    readOnly,
    disabled,
    'aria-required': required || undefined,
    'aria-invalid': !!error || undefined,
    'aria-describedby': describedBy,
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={cn(hideLabel && 'sr-only')}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>

      {multiline ? (
        <Textarea
          {...common}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          className="resize-y"
        />
      ) : suffix ? (
        <InputGroup>
          <InputGroupInput {...common} type={type} onChange={(e) => onChange(e.target.value)} />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{suffix}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      ) : (
        <Input {...common} type={type} onChange={(e) => onChange(e.target.value)} />
      )}

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
