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
  planned: { bg: '#F2F4F6', fg: '#6B7684' },
  in_progress: { bg: '#EBF3FE', fg: '#1B64DA' },
  done: { bg: '#E7F8EF', fg: '#0B7544' },
  canceled: { bg: '#F9FAFB', fg: '#B0B8C1' },
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
