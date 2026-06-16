'use client';

import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/States';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
  /** 헤더 행을 더 또렷하게(솔리드 bg-muted + 2px 보더 + 진한 텍스트) */
  emphasizeHeader?: boolean;
  empty?: React.ReactNode;
  className?: string;
  /** 테이블 래퍼에 추가 클래스 */
  wrapperClassName?: string;
}

const alignClass = {
  left:   'text-left',
  right:  'text-right',
  center: 'text-center',
};

/**
 * DataTable — 제네릭 데이터 테이블.
 * components/ui/table.tsx 기반. rows 빈 배열이면 empty 슬롯 표시.
 * 숫자 열: align='right' + column.className에 tabular-nums 지정 권장.
 *
 * 사용 예:
 * <DataTable
 *   columns={[{key:'name',header:'이름',render:(r)=>r.name},{key:'score',header:'점수',align:'right',className:'tabular-nums'}]}
 *   rows={users}
 *   rowKey={(r)=>r.id}
 *   onRowClick={(r)=>router.push(`/users/${r.id}`)}
 * />
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  stickyHeader = false,
  emphasizeHeader = false,
  empty,
  className,
  wrapperClassName,
}: DataTableProps<T>) {
  const isEmpty = rows.length === 0;

  return (
    <div className={cn('relative w-full overflow-auto', wrapperClassName)}>
      <Table className={className}>
        <TableHeader
          className={cn(stickyHeader && 'sticky top-0 z-10 bg-card')}
        >
          <TableRow
            className={cn(
              'hover:bg-transparent',
              emphasizeHeader && 'border-b-2 border-border',
            )}
          >
            {columns.map((col) => (
              <TableHead
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  'h-11 px-4 text-xs font-semibold',
                  emphasizeHeader
                    ? 'bg-muted text-foreground'
                    : 'bg-muted/50 text-muted-foreground',
                  col.align ? alignClass[col.align] : 'text-left',
                  col.className,
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {isEmpty ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="p-0"
              >
                {empty ?? (
                  <EmptyState
                    title="데이터가 없어요"
                    description="조건을 변경하거나 데이터를 추가해 보세요."
                  />
                )}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-border',
                  onRowClick && 'cursor-pointer hover:bg-accent',
                )}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      'px-4 py-3',
                      col.align ? alignClass[col.align] : 'text-left',
                      col.className,
                    )}
                  >
                    {col.render
                      ? col.render(row)
                      : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
