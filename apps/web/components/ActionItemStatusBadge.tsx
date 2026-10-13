'use client';

// 보완 조치 상태 배지(계획/진행중/완료/취소) — component-spec-midterm §4.
// 색+한글 라벨 병기, 대비 AA.
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { actionItemStatusLabel } from '@/lib/ui';
import type { ActionItemStatus } from '@/lib/types';

export interface ActionItemStatusBadgeProps {
  status: ActionItemStatus;
}

const STATUS_VARIANT: Record<ActionItemStatus, NonNullable<BadgeProps['variant']>> = {
  planned: 'secondary',
  in_progress: 'default',
  done: 'success',
  canceled: 'muted',
};

export function ActionItemStatusBadge({ status }: ActionItemStatusBadgeProps) {
  const label = actionItemStatusLabel[status];
  return (
    <Badge variant={STATUS_VARIANT[status]} size="xs" aria-label={`보완 조치 상태: ${label}`}>
      {label}
    </Badge>
  );
}
