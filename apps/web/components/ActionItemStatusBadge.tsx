'use client';

// 보완 조치 상태 배지(계획/진행중/완료/취소) — component-spec-midterm §4.
// 사각(radius 0), 색+한글 라벨 병기, 대비 AA.
import { actionItemStatusLabel } from '@/lib/ui';
import type { ActionItemStatus } from '@/lib/types';

export interface ActionItemStatusBadgeProps {
  status: ActionItemStatus;
}

// status → bg/fg HEX (DESIGN.md 토큰: neutral/primary/success).
const STATUS_STYLE: Record<ActionItemStatus, { bg: string; fg: string }> = {
  planned: { bg: '#efeff2', fg: '#565660' },
  in_progress: { bg: '#EAF1FE', fg: '#1D4FC4' },
  done: { bg: '#e9f8ef', fg: '#0e6633' },
  canceled: { bg: '#f7f7f9', fg: '#a0a0ac' },
};

export function ActionItemStatusBadge({ status }: ActionItemStatusBadgeProps) {
  const s = STATUS_STYLE[status];
  const label = actionItemStatusLabel[status];
  return (
    <span
      className="inline-flex items-center font-medium"
      style={{ background: s.bg, color: s.fg, padding: '2px 8px', fontSize: 11 }}
      aria-label={`보완 조치 상태: ${label}`}
    >
      {label}
    </span>
  );
}
