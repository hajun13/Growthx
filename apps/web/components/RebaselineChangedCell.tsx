'use client';

// ④-1 RebaselineChangedCell — 변경 셀 강조 래퍼.
// 새 값이 원본과 다르면 좌측 primary 바 + info-50 배경.
// 색만 의존 금지: aria-label "변경됨" + data-changed 표식.

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
      className={[
        'relative block rounded-sm transition-colors',
        changed
          ? 'border-l-[3px] border-l-primary bg-info-50 pl-[5px] pr-[6px] py-[2px]'
          : 'border-l-[3px] border-l-transparent px-[6px] py-[2px]',
      ].join(' ')}
    >
      {changed && (
        <span
          aria-hidden
          className="absolute top-[3px] right-[3px] h-1 w-1 rounded-full bg-primary"
        />
      )}
      {children}
    </span>
  );
}
