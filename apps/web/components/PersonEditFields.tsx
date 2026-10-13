'use client';

// 조직·구성원 모달 공용 폼 행 — L1 Field/Input/Select 조합(레이블 연결·aria-invalid·에러/힌트 문구).
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { FieldError } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function TextFieldRow({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  error,
  hint,
  readOnly,
  max,
  compactHint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'date';
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  readOnly?: boolean;
  max?: string;
  compactHint?: boolean;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        max={max}
        aria-required={required || undefined}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : hint ? (
        <p id={`${id}-hint`} className={cn('text-sm text-muted-foreground', compactHint && 'text-11')}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface SelectRowOption {
  value: string;
  label: string;
}

export function SelectFieldRow({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  value: string;
  options: SelectRowOption[];
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {/* Radix Select 는 빈 문자열 value 를 허용하지 않아 undefined 로 전달. */}
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} aria-invalid={!!error || undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
