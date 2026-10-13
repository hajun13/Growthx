'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  const textAlign = (a?: ResultTableColumn['align']) => a ?? 'left';

  return (
    <Table>
      <TableHeader>
        <TableRow plain>
          {columns.map((c) => (
            <TableHead key={c.key} tone="soft" textAlign={textAlign(c.align)}>
              {c.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => {
          const clickable = !!onRowClick;
          return (
            <TableRow
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
              interactive={clickable}
            >
              {columns.map((c) => (
                <TableCell key={c.key} textAlign={textAlign(c.align)}>
                  {row[c.key] ?? '—'}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
