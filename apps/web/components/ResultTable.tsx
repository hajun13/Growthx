'use client';

import { cx } from '@/lib/ui';

export interface ResultTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
}

export interface ResultTableProps {
  columns: ResultTableColumn[];
  // 셀 값(GradeChip·StatusBadge 등 노드 허용). 각 행은 식별용 _key 권장.
  rows: Array<Record<string, React.ReactNode> & { _key?: string }>;
  onRowClick?: (row: Record<string, React.ReactNode>) => void;
  emptyLabel?: string;
}

// 평가 결과 표(직책 체계). 모니터링·결과 과제별·보상 공용.
export function ResultTable({
  columns,
  rows,
  onRowClick,
  emptyLabel = '표시할 데이터가 없어요.',
}: ResultTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-500">{emptyLabel}</p>
    );
  }

  const alignClass = (a?: ResultTableColumn['align']) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cx(
                  'px-3 py-2 font-medium text-neutral-600',
                  alignClass(c.align),
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const clickable = !!onRowClick;
            return (
              <tr
                key={row._key ?? i}
                onClick={clickable ? () => onRowClick?.(row) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick?.(row);
                        }
                      }
                    : undefined
                }
                tabIndex={clickable ? 0 : undefined}
                role={clickable ? 'button' : undefined}
                className={cx(
                  'border-b border-neutral-100',
                  clickable &&
                    'cursor-pointer outline-none hover:bg-neutral-50 focus-visible:bg-neutral-50',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cx(
                      'px-3 py-2 text-neutral-800',
                      alignClass(c.align),
                    )}
                  >
                    {row[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
