'use client';

// ④-1 RebaselineChangedCell — 변경 셀 강조 래퍼.
// 새 값이 원본과 다르면 좌측 primary 바 + primary-50 배경 + 우상단 점.
// 색만 의존 금지: aria-label "변경됨" + data-changed 표식(행 사유 활성이 보조 신호).
import { T } from '@/lib/toss';

export interface RebaselineChangedCellProps {
  changed: boolean;
  children: React.ReactNode;
}

export function RebaselineChangedCell({
  changed,
  children,
}: RebaselineChangedCellProps) {
  return (
    <span
      data-changed={changed || undefined}
      aria-label={changed ? '변경됨' : undefined}
      style={{
        position: 'relative',
        display: 'block',
        borderLeft: changed ? `3px solid ${T.blue500}` : '3px solid transparent',
        background: changed ? '#eaf1fe' : 'transparent',
        padding: changed ? '2px 6px 2px 5px' : '2px 6px',
      }}
    >
      {changed && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 4,
            height: 4,
            background: T.blue500,
          }}
        />
      )}
      {children}
    </span>
  );
}
