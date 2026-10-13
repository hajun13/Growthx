'use client';

/**
 * CompensationTable — 보상 현황 표 본체(스크롤 컨테이너 + sticky 헤더/좌측 2열/합계 행).
 * sticky-left·sticky-top 이 동작하도록 내부 스크롤 컨테이너를 이 컴포넌트가 직접 소유한다.
 */

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableFooter, TableHead, TableHeader, TableRow, TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { PositionDef } from '@/lib/types';
import type { CompensationSimulation, UpsertCompensationAdjustmentDto } from '../api';
import type { ColDef, SortKey } from './columns';
import { printMoney, sumOf } from './compensationPrint';
import { CompensationRow } from './CompensationRow';
import { EmptyState } from './StateViews';

export interface SortState { key: SortKey; dir: 'asc' | 'desc' }

interface Props {
  columns: ColDef[];
  minWidth: number;
  rows: CompensationSimulation[];
  /** 전체(필터 전) 행 수 — 최초 로딩 스켈레톤 판단. */
  totalRows: number;
  rowsLoading: boolean;
  cycleId: string;
  canEdit: boolean;
  positions: PositionDef[];
  sort: SortState | null;
  onToggleSort: (key: SortKey) => void;
  onSave: (dto: UpsertCompensationAdjustmentDto) => Promise<boolean>;
  /** 합계 행 라벨 보조 문구(필터 적용 여부). */
  filtered: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
}

export function CompensationTable({
  columns, minWidth, rows, totalRows, rowsLoading, cycleId, canEdit, positions,
  sort, onToggleSort, onSave, filtered, scrollRef, onScroll,
}: Props) {
  return (
    <div
      ref={scrollRef}
      className="gx-hide-horizontal-scrollbar relative max-h-(--table-h) max-w-full overflow-auto rounded-lg border border-border bg-card"
      style={{ '--table-h': 'calc(100vh - 172px)' } as React.CSSProperties}
      onScroll={onScroll}
    >
      {rowsLoading && totalRows > 0 && (
        <div className="absolute top-3 right-3 z-30 rounded-full border border-border bg-card/90 px-2.5 py-1 text-11 font-semibold text-muted-foreground">
          갱신 중
        </div>
      )}
      {rowsLoading && totalRows === 0 ? (
        <div className="p-4">
          <Skeleton className="h-80 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-8">
          <EmptyState title="표시할 보상 데이터가 없어요." description="평가 주기가 완료되면 보상 시뮬레이션 결과가 여기에 표시됩니다." />
        </div>
      ) : (
        <Table
          bare
          className="w-full min-w-(--tw) table-fixed border-separate border-spacing-0"
          style={{ '--tw': `${minWidth}px` } as React.CSSProperties}
        >
          <colgroup>
            {columns.map((col, idx) => (
              <col key={idx} className="w-(--cw)" style={{ '--cw': `${col.width}px` } as React.CSSProperties} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow plain>
              {columns.map((col, idx) => (
                <TableHead
                  key={idx}
                  sticky
                  textAlign={col.numeric ? 'right' : 'left'}
                  groupStart={!!col.groupStart}
                  edgeEnd={idx === 1}
                  className={cn('text-11 font-bold', idx === 0 && 'left-0 z-20', idx === 1 && 'left-38 z-20', col.sortKey && 'cursor-pointer select-none')}
                  onClick={col.sortKey ? () => onToggleSort(col.sortKey!) : undefined}
                  title={col.sortKey ? '클릭해 정렬 (내림차순 → 오름차순 → 해제)' : undefined}
                  aria-sort={
                    col.sortKey && sort?.key === col.sortKey
                      ? (sort.dir === 'desc' ? 'descending' : 'ascending')
                      : undefined
                  }
                >
                  {col.label}
                  {col.sortKey && (
                    <span className={`ml-0.75 text-9h ${sort?.key === col.sortKey ? 'text-primary' : 'text-neutral-500'}`} aria-hidden>
                      {sort?.key === col.sortKey ? (sort.dir === 'desc' ? '▼' : '▲') : '↕'}
                    </span>
                  )}
                  {col.sub && (
                    <><br /><span className="text-9h font-medium normal-case tracking-normal">{col.sub}</span></>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <CompensationRow
                key={`${cycleId}:${r.userId}`}
                row={r}
                rowIndex={i}
                isLast={i === rows.length - 1}
                cycleId={cycleId}
                canEdit={canEdit}
                positions={positions}
                onSave={onSave}
                columns={columns}
              />
            ))}
          </TableBody>
          {/* 합계 행 — 필터(본부·이름 검색) 반영 합계. sticky bottom 으로 스크롤 중에도 표시. */}
          <TableFooter>
            <TableRow plain>
              <TableCell colSpan={2} pin="foot" edgeEnd className="left-0 z-30 text-12 whitespace-nowrap">
                합계 · {rows.length}명{filtered ? ' (필터 반영)' : ''}
              </TableCell>
              {columns.slice(2).map((col, i) => {
                const idx = i + 2;
                let content = '';
                if (idx === 11) content = printMoney(sumOf(rows.map((r) => r.adjustmentAmount)));
                else if (idx === 12) content = printMoney(sumOf(rows.map((r) => r.finalProjectedSalary)));
                else if (idx === 15) {
                  content = printMoney(
                    sumOf(
                      rows.map((r) =>
                        r.finalProjectedSalary != null && r.currentSalary != null
                          ? r.finalProjectedSalary - r.currentSalary
                          : null,
                      ),
                    ),
                  );
                } else if (idx === 17) content = printMoney(sumOf(rows.map((r) => r.incentiveAmount)));
                return (
                  <TableCell
                    key={idx}
                    pin="foot"
                    textAlign={col.numeric ? 'right' : 'left'}
                    groupStart={!!col.groupStart}
                    className="text-12 whitespace-nowrap tabular-nums"
                  >
                    {content}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
