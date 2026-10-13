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
  /**
   * 래퍼 최대 높이 — 지정(또는 stickyHeader 기본값) 시 래퍼가 내부 스크롤 컨테이너가 되어
   * th 의 sticky top-0 이 동작한다. stickyHeader=true 인데 미지정이면 calc(100vh - 240px).
   */
  maxHeight?: number | string;
  /** 헤더 행을 더 또렷하게(솔리드 bg-muted + 2px 보더 + 진한 텍스트) */
  emphasizeHeader?: boolean;
  empty?: React.ReactNode;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
  /** 테이블 래퍼에 추가 클래스 */
  wrapperClassName?: string;
}

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
  maxHeight,
  emphasizeHeader = false,
  empty,
  className,
  rowClassName,
  wrapperClassName,
}: DataTableProps<T>) {
  const isEmpty = rows.length === 0;

  // stickyHeader 는 내부 스크롤 컨테이너가 있어야 동작 — 미지정이면 뷰포트 기반 기본값.
  const effectiveMaxHeight = maxHeight ?? (stickyHeader ? 'calc(100vh - 240px)' : undefined);
  // 동적 값은 CSS 변수로 전달(인라인 스타일 규칙) — 미지정이면 변수 미정의 → max-height 무효(=none).
  const wrapperVars =
    effectiveMaxHeight === undefined
      ? undefined
      : ({
          '--dt-max-h':
            typeof effectiveMaxHeight === 'number' ? `${effectiveMaxHeight}px` : effectiveMaxHeight,
        } as React.CSSProperties);
  const headTone = emphasizeHeader ? 'strong' : stickyHeader ? 'default' : 'soft';

  return (
    <div
      className={cn('gx-work-surface relative w-full max-h-(--dt-max-h) overflow-auto', wrapperClassName)}
      style={wrapperVars}
    >
      {/* ui/table 내부 overflow 래퍼는 bare 로 제거 — 스크롤 컨테이너를 이 래퍼로 단일화(sticky th 기준). */}
      <Table className={className} bare>
        <TableHeader>
          <TableRow plain rule={emphasizeHeader ? 'strong' : 'default'}>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                tone={headTone}
                sticky={stickyHeader}
                textAlign={col.align ?? 'left'}
                style={col.width ? ({ '--col-w': col.width } as React.CSSProperties) : undefined}
                // eslint-disable-next-line shadcn/require-static-classes -- 호출부가 넘기는 column.className(공개 API) 패스스루
                className={cn('h-9 w-(--col-w) text-11h', col.className)}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {isEmpty ? (
            <TableRow plain>
              <TableCell colSpan={columns.length} flush>
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
                interactive={Boolean(onRowClick)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        // 행 자체에 포커스가 있을 때만 — 셀 안 입력/버튼의 키 입력이 버블돼
                        // 행 네비게이션을 오발하지 않도록 가드.
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                // eslint-disable-next-line shadcn/require-static-classes -- 호출부가 넘기는 rowClassName(공개 API) 패스스루
                className={cn(rowClassName?.(row))}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    textAlign={col.align ?? 'left'}
                    // eslint-disable-next-line shadcn/require-static-classes -- 호출부가 넘기는 column.className(공개 API) 패스스루
                    className={cn('text-13 leading-5', col.className)}
                  >
                    {col.render
                      ? col.render(row)
                      : ((row as Record<string, unknown>)[col.key] as React.ReactNode)}
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
