'use client';

// 진척 신호 배지(순항/주의/위험) — component-spec-midterm §1.
// 계약 enum: on_track | at_risk | off_track (디자인 스펙의 caution/at_risk 명칭과 다름 — 계약 우선).
// 색+한글 라벨 병기(색만 의존 금지), 대비 AA. 등급(S~D) 색 토큰과 의도적 분리.
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { progressSignalLabel } from '@/lib/ui';
import type { ProgressSignal } from '@/lib/types';

export interface MidtermSignalBadgeProps {
  signal: ProgressSignal | null; // null = 산정 불가(정성/미입력)
  size?: 'sm' | 'md'; // 호환용 — Badge xs 로 통일(패리티 메모 참고)
}

const SIGNAL_STYLE: Record<
  ProgressSignal,
  { variant: NonNullable<BadgeProps['variant']>; dot: string }
> = {
  on_track: { variant: 'success', dot: 'bg-success-600' },
  at_risk: { variant: 'warning', dot: 'bg-warning-600' },
  off_track: { variant: 'destructive', dot: 'bg-danger-600' },
};
const NULL_STYLE = { variant: 'muted' as const, dot: 'bg-neutral-400' };

export function MidtermSignalBadge({ signal }: MidtermSignalBadgeProps) {
  const s = signal ? SIGNAL_STYLE[signal] : NULL_STYLE;
  const label = signal ? progressSignalLabel[signal] : '—';
  return (
    <Badge variant={s.variant} size="xs" aria-label={`신호: ${label}`}>
      {signal && <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${s.dot}`} />}
      {label}
    </Badge>
  );
}
