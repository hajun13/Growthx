'use client';

// 재조정 요청 상태 배지 — submitted(승인대기) · approved(반영완료) · rejected(반려).
import type { RebaselineRequestStatus } from '@/lib/types';

interface Config {
  className: string;
  label: string;
}

const STATUS_CFG: Record<RebaselineRequestStatus, Config> = {
  submitted: { className: 'bg-muted text-primary', label: '검토 대기' },
  approved: { className: 'bg-success-50 text-success-700', label: '반영 완료' },
  rejected: { className: 'bg-danger-50 text-danger-700', label: '반려' },
};

export function RebaselineStatusBadge({
  status,
  size = 'md',
}: {
  status: RebaselineRequestStatus;
  size?: 'sm' | 'md';
}) {
  const cfg = STATUS_CFG[status];
  return (
    <span
      className={`inline-flex rounded-md font-bold tracking-[0.01em] ${cfg.className} ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
      }`}
    >
      {cfg.label}
    </span>
  );
}
