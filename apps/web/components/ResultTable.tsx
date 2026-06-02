'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

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

  const alignClass = (a?: ResultTableColumn['align']) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          {columns.map((c) => (
            <TableHead
              key={c.key}
              className={cn('font-medium text-muted-foreground', alignClass(c.align))}
            >
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
              className={cn(
                clickable &&
                  'cursor-pointer outline-none focus-visible:bg-muted/60',
              )}
            >
              {columns.map((c) => (
                <TableCell key={c.key} className={alignClass(c.align)}>
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
