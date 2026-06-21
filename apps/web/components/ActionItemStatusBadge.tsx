'use client';

// 보완 조치 상태 배지(계획/진행중/완료/취소) — component-spec-midterm §4.
// 사각(radius 0), 색+한글 라벨 병기, 대비 AA.
import { actionItemStatusLabel } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { ActionItemStatus } from '@/lib/types';

export interface ActionItemStatusBadgeProps {
  status: ActionItemStatus;
}

const STATUS_STYLE: Record<ActionItemStatus, string> = {
  planned: 'bg-muted text-muted-foreground',
  in_progress: 'bg-muted text-primary',
  done: 'bg-success-50 text-success-700',
  canceled: 'bg-neutral-50 text-neutral-400',
};

export function ActionItemStatusBadge({ status }: ActionItemStatusBadgeProps) {
  const label = actionItemStatusLabel[status];
  return (
    <span
      className={cn('inline-flex items-center rounded-md px-2 py-0.5 font-medium', STATUS_STYLE[status])}
      style={{ fontSize: 11 }}
      aria-label={`보완 조치 상태: ${label}`}
    >
      {label}
    </span>
  );
}
