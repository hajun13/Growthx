'use client';

// 평가 규칙 에디터 숫자 입력 — +/− 버튼 + 키보드(blur/Enter 커밋). 빈 값 처리는 allowEmpty/emptyValue.
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

export function Stepper({
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  className,
  big = false,
  allowEmpty = false,
  emptyValue = null,
  placeholder,
  ariaLabel,
  invalid = false,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  /** 폭 클래스(예: w-33) — 호출부에서 정적 문자열로 전달. */
  className?: string;
  big?: boolean;
  allowEmpty?: boolean;
  emptyValue?: number | null;
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
}) {
  const clamp = (n: number) => {
    let r = n;
    if (typeof min === 'number') r = Math.max(min, r);
    if (typeof max === 'number') r = Math.min(max, r);
    return r;
  };
  const current = value ?? 0;
  // 편집 중 로컬 문자열 — 타이핑 중 빈 값을 0으로 강제하지 않고 blur/Enter 시 커밋.
  // 빈 값 커밋 시 allowEmpty 면 emptyValue(∞ 등), 아니면 이전 값 복원.
  const [editText, setEditText] = useState<string | null>(null);
  const bump = (dir: 1 | -1) => {
    setEditText(null);
    onChange(clamp(current + dir * step));
  };
  const commitEdit = () => {
    if (editText === null) return;
    const raw = editText.trim();
    setEditText(null);
    if (raw === '') {
      if (allowEmpty) onChange(emptyValue);
      return; // 이전 값 복원(변경 없음)
    }
    const n = Number(raw);
    if (Number.isNaN(n)) return; // 이전 값 복원
    onChange(clamp(n));
  };
  return (
    <InputGroup className={cn(big ? 'h-11' : 'h-9', className)}>
      <InputGroupButton
        size="icon-xs"
        aria-label={`${ariaLabel ?? ''} 감소`}
        onClick={() => bump(-1)}
        className="order-first ml-1"
      >
        <Minus />
      </InputGroupButton>
      <InputGroupInput
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        type="number"
        value={
          editText !== null
            ? editText
            : value === null || value === undefined
              ? ''
              : String(value)
        }
        placeholder={placeholder}
        onChange={(ev) => setEditText(ev.target.value)}
        onBlur={commitEdit}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') ev.currentTarget.blur();
        }}
        className={cn(
          'min-w-0 text-center tabular-nums',
          big ? 'text-20 font-bold' : 'text-13 font-semibold',
        )}
      />
      {suffix && (
        <InputGroupAddon align="inline-end" className="pr-1">
          <span className={big ? 'text-12' : 'text-11'}>{suffix}</span>
        </InputGroupAddon>
      )}
      <InputGroupButton
        size="icon-xs"
        aria-label={`${ariaLabel ?? ''} 증가`}
        onClick={() => bump(1)}
        className="order-last mr-1"
      >
        <Plus />
      </InputGroupButton>
    </InputGroup>
  );
}

