'use client';

import { GradeChip } from '@/components/GradeChip';
import { T } from '@/lib/toss';
import type { Grade } from '@/lib/types';
import type { YoyDistRow } from './YoyDistributionGroup';

export interface DistRatioTableProps {
  rows: YoyDistRow[]; // 연도 오름차순
}

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

function ratioOf(row: YoyDistRow, g: Grade): number {
  if (row.ratios && row.ratios[g] != null) return row.ratios[g];
  return row.total > 0 ? (row.counts[g] / row.total) * 100 : 0;
}

// 등급 비율 테이블(결론 시트 재현). 셀 = 인원(비율%). 백엔드 값 표시만.
export function DistRatioTable({ rows }: DistRatioTableProps) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.year - b.year);

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-toss-grey50">
            <th className="border-b border-border px-3 py-2 text-left font-semibold text-toss-grey600">
              연도
            </th>
            <th className="border-b border-border px-3 py-2 text-right font-semibold text-toss-grey600">
              총원
            </th>
            {GRADES.map((g) => (
              <th
                key={g}
                className="border-b border-border px-3 py-2 text-right font-semibold text-toss-grey600"
              >
                <span className="inline-flex justify-end">
                  <GradeChip grade={g} size="sm" variant="soft" />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const isLatest = i === sorted.length - 1 && sorted.length > 1;
            const YearCell = (
              <td className="px-3 py-2.5 font-bold tabular-nums text-toss-grey900">
                <span className="inline-flex items-center gap-1.5">
                  {row.year}
                  {isLatest && (
                    <span
                      className="rounded-none px-1 py-px text-[9.5px] font-bold"
                      style={{ background: T.blue50, color: T.blue700 }}
                    >
                      최근
                    </span>
                  )}
                </span>
              </td>
            );
            return row.missing ? (
              <tr
                key={row.cycleId}
                className="border-b border-border transition-colors hover:bg-toss-grey50"
              >
                {YearCell}
                <td
                  colSpan={GRADES.length + 1}
                  className="px-3 py-2.5 text-left text-[12px] text-toss-grey500"
                >
                  해당 연도 데이터 없음
                </td>
              </tr>
            ) : (
              <tr
                key={row.cycleId}
                className="border-b border-border transition-colors hover:bg-toss-grey50"
              >
                {YearCell}
                <td className="px-3 py-2.5 text-right tabular-nums text-toss-grey700">
                  {row.total}명
                </td>
                {GRADES.map((g) => {
                  const pct = ratioOf(row, g);
                  return (
                    <td
                      key={g}
                      className="px-3 py-2.5 text-right tabular-nums text-toss-grey800"
                    >
                      {row.counts[g]}
                      <span className="ml-1 text-[11px] text-toss-grey500">
                        ({pct.toFixed(1)}%)
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
