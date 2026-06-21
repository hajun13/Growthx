'use client';

// 진척 신호 배지(순항/주의/위험) — component-spec-midterm §1.
// 계약 enum: on_track | at_risk | off_track (디자인 스펙의 caution/at_risk 명칭과 다름 — 계약 우선).
// 사각(radius 0), 색+한글 라벨 병기(색만 의존 금지), 대비 AA. 등급(S~D) 색 토큰과 의도적 분리.
import { progressSignalLabel } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { ProgressSignal } from '@/lib/types';

export interface MidtermSignalBadgeProps {
  signal: ProgressSignal | null; // null = 산정 불가(정성/미입력)
  size?: 'sm' | 'md';
}

const SIGNAL_STYLE: Record<
  ProgressSignal,
  { className: string; dot: string }
> = {
  on_track: { className: 'bg-success-50 text-success-700', dot: 'bg-success-600' },
  at_risk: { className: 'bg-warning-50 text-warning-700', dot: 'bg-warning-600' },
  off_track: { className: 'bg-danger-50 text-danger-700', dot: 'bg-danger-600' },
};
const NULL_STYLE = { className: 'bg-muted text-muted-foreground', dot: 'bg-neutral-400' };

export function MidtermSignalBadge({ signal, size = 'md' }: MidtermSignalBadgeProps) {
  const s = signal ? SIGNAL_STYLE[signal] : NULL_STYLE;
  const label = signal ? progressSignalLabel[signal] : '—';
  const fontSize = size === 'sm' ? 10.5 : 11;
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md font-medium', s.className)}
      style={{
        padding: '2px 8px',
        fontSize,
      }}
      aria-label={`신호: ${label}`}
    >
      {signal && (
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.dot)}
        />
      )}
      {label}
    </span>
  );
}
