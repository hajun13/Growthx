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
  title?: React.ReactNode;
  description?: React.ReactNode;
  toolbar?: React.ReactNode;
  actions?: React.ReactNode;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
  /** 헤더 행을 더 또렷하게(솔리드 bg-muted + 2px 보더 + 진한 텍스트) */
  emphasizeHeader?: boolean;
  empty?: React.ReactNode;
  loading?: boolean;
  loadingRows?: number;
  footer?: React.ReactNode;
  className?: string;
  /** 테이블 래퍼에 추가 클래스 */
  wrapperClassName?: string;
  density?: 'comfortable' | 'compact';
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
  title,
  description,
  toolbar,
  actions,
  columns,
  rows,
  rowKey,
  onRowClick,
  stickyHeader = false,
  emphasizeHeader = false,
  empty,
  loading = false,
  loadingRows = 6,
  footer,
  className,
  wrapperClassName,
  density = 'comfortable',
}: DataTableProps<T>) {
  const isEmpty = rows.length === 0;
  const hasChrome = title || description || toolbar || actions || footer;
  const cellPadding = density === 'compact' ? 'px-3 py-2.5' : 'px-4 py-3';
  const headPadding = density === 'compact' ? 'h-9 px-3' : 'h-10 px-4';

  return (
    <section
      className={cn(
        hasChrome && 'overflow-hidden rounded-lg border border-border/80 bg-card',
        wrapperClassName,
      )}
    >
      {(title || description || toolbar || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 px-4 py-3">
          {(title || description) && (
            <div className="min-w-0">
              {title && <h2 className="text-[15px] font-bold leading-6 text-foreground">{title}</h2>}
              {description && (
                <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{description}</p>
              )}
            </div>
          )}
          {(toolbar || actions) && (
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {toolbar}
              {actions}
            </div>
          )}
        </div>
      )}

      <div className={cn('relative w-full overflow-auto', !hasChrome && wrapperClassName)}>
        <Table className={cn('min-w-full', className)}>
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
                    headPadding,
                    'text-xs font-semibold',
                    emphasizeHeader
                      ? 'bg-muted text-foreground'
                      : 'bg-muted/60 text-muted-foreground',
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
            {loading ? (
              Array.from({ length: loadingRows }).map((_, rowIndex) => (
                <TableRow key={`loading-${rowIndex}`} className="hover:bg-transparent">
                  {columns.map((col, colIndex) => (
                    <TableCell key={`${col.key}-${rowIndex}`} className={cellPadding}>
                      <div
                        className={cn(
                          'h-4 animate-pulse rounded-lg bg-muted',
                          colIndex === 0 ? 'w-2/3' : 'w-full',
                        )}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isEmpty ? (
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
                    'border-b border-border/80 last:border-0 hover:bg-muted/45',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        cellPadding,
                        'text-[13px] leading-5',
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

      {footer && (
        <div className="border-t border-border/80 px-4 py-3">
          {footer}
        </div>
      )}
    </section>
  );
}
