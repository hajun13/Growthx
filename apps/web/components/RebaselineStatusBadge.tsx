'use client';

// 재조정 요청 상태 배지 — submitted(승인대기) · approved(반영완료) · rejected(반려).
// 색 토큰은 기존 StatusBadge 패턴 재사용.
import { T } from '@/lib/toss';
import type { RebaselineRequestStatus } from '@/lib/types';

interface Config {
  bg: string;
  color: string;
  label: string;
}

const STATUS_CFG: Record<RebaselineRequestStatus, Config> = {
  submitted: { bg: T.grey100, color: T.blue700, label: '검토 대기' },
  approved: { bg: '#c9eed7', color: '#0e6633', label: '반영 완료' },
  rejected: { bg: '#fdecec', color: '#a0282d', label: '반려' },
};

export function RebaselineStatusBadge({
  status,
  size = 'md',
}: {
  status: RebaselineRequestStatus;
  size?: 'sm' | 'md';
}) {
  const cfg = STATUS_CFG[status];
  const px = size === 'sm' ? '6px' : '8px';
  const py = size === 'sm' ? '2px' : '3px';
  const fs = size === 'sm' ? 10 : 11;
  return (
    <span
      style={{
        display: 'inline-block',
        background: cfg.bg,
        color: cfg.color,
        fontSize: fs,
        fontWeight: 700,
        padding: `${py} ${px}`,
        letterSpacing: '0.01em',
      }}
    >
      {cfg.label}
    </span>
  );
}
