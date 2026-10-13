'use client';

// 연봉갱신 Index 임포트 미리보기 표 — 행별 편집(입사일·연봉·조정분·승격·인센티브·Note) + 동명이인 수동 매칭.
import { DesignLabel } from '@/components/DesignLabel';
import { UserCombobox } from '@/components/UserCombobox';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import type { User } from '@/lib/types';
import type { CompensationIndexRow } from '../api';

function toNum(value: string): number | null {
  const cleaned = value.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function money(value: number | null): string {
  return value == null ? '' : value.toLocaleString();
}

interface Props {
  rows: CompensationIndexRow[];
  /** 업로드 시점에 동명이인이었던 행 — 매칭 후에도 콤보박스를 유지해 되돌리기 가능. */
  ambiguousRowNos: Set<number>;
  users: User[];
  /** 헤더 연도 라벨(2자리). */
  y1: string;
  y2: string;
  onPatch: (rowNo: number, patch: Partial<CompensationIndexRow>) => void;
  onMatchAmbiguous: (rowNo: number, userId: string | null) => void;
}

export function IndexPreviewTable({ rows, ambiguousRowNos, users, y1, y2, onPatch, onMatchAmbiguous }: Props) {
  const heads = ['상태', '이름', '그룹', '본부', '팀', '입사일', `${y2}년 연봉`, `${y1}년 이전제외A`, `${y1}년 이전포함B`, '조정분', '승격', '인센티브', 'Note'];
  return (
    <div className="max-h-90 overflow-auto rounded-lg border border-border">
      {/* bare — 이 div 가 스크롤 컨테이너이므로 sticky 헤더가 동작하도록 래퍼 없이 렌더 */}
      <Table bare className="min-w-280">
        <TableHeader>
          <TableRow plain>
            {heads.map((h) => (
              <TableHead key={h} sticky className="text-11h">{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.rowNo}>
              <TableCell dense className="text-11h">
                <DesignLabel
                  tone={row.status === 'matched' ? 'green' : row.status === 'missing' ? 'amber' : 'red'}
                >
                  {row.status === 'matched' ? '매칭' : row.status === 'missing' ? '미등록' : '동명이인'}
                </DesignLabel>
              </TableCell>
              <TableCell dense className="text-11h font-semibold">
                {ambiguousRowNos.has(row.rowNo) ? (
                  <div className="flex flex-col gap-1">
                    <span>{row.name}</span>
                    {/* 동명이인 — 대상자 직접 선택으로 해소 */}
                    <UserCombobox
                      users={users}
                      value={row.userId}
                      placeholder="대상자 직접 선택"
                      onChange={(id) => onMatchAmbiguous(row.rowNo, id)}
                    />
                  </div>
                ) : (
                  row.name
                )}
              </TableCell>
              <TableCell dense className="text-11h">{row.groupName ?? '-'}</TableCell>
              <TableCell dense className="text-11h">{row.divisionName ?? '-'}</TableCell>
              <TableCell dense className="text-11h">{row.teamName ?? '-'}</TableCell>
              <TableCell dense className="text-11h">
                <Input className="h-7 w-28 text-11h" value={row.hireDate ?? ''} onChange={(e) => onPatch(row.rowNo, { hireDate: e.target.value || null })} />
              </TableCell>
              <TableCell dense className="text-11h"><Input inputMode="numeric" className="h-7 w-28 text-right text-11h tabular-nums" value={money(row.previousSalary)} onChange={(e) => onPatch(row.rowNo, { previousSalary: toNum(e.target.value) })} /></TableCell>
              <TableCell dense className="text-11h"><Input inputMode="numeric" className="h-7 w-28 text-right text-11h tabular-nums" value={money(row.currentSalaryExclTransfer)} onChange={(e) => onPatch(row.rowNo, { currentSalaryExclTransfer: toNum(e.target.value) })} /></TableCell>
              <TableCell dense className="text-11h"><Input inputMode="numeric" className="h-7 w-28 text-right text-11h tabular-nums" value={money(row.currentSalary)} onChange={(e) => onPatch(row.rowNo, { currentSalary: toNum(e.target.value) })} /></TableCell>
              <TableCell dense className="text-11h"><Input inputMode="numeric" className="h-7 w-24 text-right text-11h tabular-nums" value={money(row.adjustmentAmount)} onChange={(e) => onPatch(row.rowNo, { adjustmentAmount: toNum(e.target.value) })} /></TableCell>
              <TableCell dense className="text-11h"><Input className="h-7 w-24 text-11h" value={row.promotionPositionLabel ?? ''} onChange={(e) => onPatch(row.rowNo, { promotionPositionLabel: e.target.value || null, promotionPositionCode: e.target.value || null })} /></TableCell>
              <TableCell dense className="text-11h"><Input inputMode="numeric" className="h-7 w-28 text-right text-11h tabular-nums" value={money(row.incentiveAmount)} onChange={(e) => onPatch(row.rowNo, { incentiveAmount: toNum(e.target.value) })} /></TableCell>
              <TableCell dense className="text-11h"><Input className="h-7 w-48 text-11h" value={row.note ?? ''} onChange={(e) => onPatch(row.rowNo, { note: e.target.value || null })} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
