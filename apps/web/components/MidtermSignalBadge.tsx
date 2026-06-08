'use client';

// 진척 신호 배지(순항/주의/위험) — component-spec-midterm §1.
// 계약 enum: on_track | at_risk | off_track (디자인 스펙의 caution/at_risk 명칭과 다름 — 계약 우선).
// 사각(radius 0), 색+한글 라벨 병기(색만 의존 금지), 대비 AA. 등급(S~D) 색 토큰과 의도적 분리.
import { progressSignalLabel } from '@/lib/ui';
import type { ProgressSignal } from '@/lib/types';

export interface MidtermSignalBadgeProps {
  signal: ProgressSignal | null; // null = 산정 불가(정성/미입력)
  size?: 'sm' | 'md';
}

// signal → bg/fg/dot HEX (DESIGN.md 토큰: success/warning/danger/neutral).
const SIGNAL_STYLE: Record<
  ProgressSignal,
  { bg: string; fg: string; dot: string }
> = {
  on_track: { bg: '#E7F8EF', fg: '#0B7544', dot: '#0F9457' },
  at_risk: { bg: '#FEF6E6', fg: '#A66800', dot: '#C2670E' },
  off_track: { bg: '#FDECEC', fg: '#AE222E', dot: '#D6303D' },
};
const NULL_STYLE = { bg: '#F2F4F6', fg: '#8B95A1', dot: '#B0B8C1' };

export function MidtermSignalBadge({ signal, size = 'md' }: MidtermSignalBadgeProps) {
  const s = signal ? SIGNAL_STYLE[signal] : NULL_STYLE;
  const label = signal ? progressSignalLabel[signal] : '—';
  const fontSize = size === 'sm' ? 10.5 : 11;
  return (
    <span
      className="inline-flex items-center gap-1 font-medium"
      style={{
        background: s.bg,
        color: s.fg,
        padding: '2px 8px',
        fontSize,
      }}
      aria-label={`신호: ${label}`}
    >
      {signal && (
        <span
          aria-hidden
          style={{ width: 6, height: 6, background: s.dot, flexShrink: 0 }}
        />
      )}
      {label}
    </span>
  );
}
