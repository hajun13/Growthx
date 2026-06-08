'use client';

import { T, gradeChipColor } from '@/lib/toss';
import type { Grade } from '@/lib/types';

// 계약 distribution.buckets[*] / overall 과 호환. ratios 는 % (소수1) — 계약 그대로.
export interface YoyDistRow {
  cycleId: string;
  year: number;
  total: number;
  counts: Record<Grade, number>;
  ratios?: Record<Grade, number>; // % (없으면 counts/total*100 로 폴백 — 표시만)
  // 선택 조직에 대한 해당 연도 버킷이 없을 때 true — overall 로 무단 대체하지 않고 빈 상태로 표시.
  missing?: boolean;
}
export interface YoyDistributionGroupProps {
  rows: YoyDistRow[]; // 연도 오름차순
  showRatio?: boolean; // 막대 안 비율 라벨(기본 true)
}

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// 비율(%) 산출 — 백엔드 ratios 우선, 없으면 counts/total(표시용 폴백, 점수 재계산 아님).
function ratioOf(row: YoyDistRow, g: Grade): number {
  if (row.ratios && row.ratios[g] != null) return row.ratios[g];
  return row.total > 0 ? (row.counts[g] / row.total) * 100 : 0;
}

// 조직 연도별 등급분포 비교 — 연도별 100% 누적 가로 막대(reports 분포 모니터링과 동일 패턴).
export function YoyDistributionGroup({
  rows,
  showRatio = true,
}: YoyDistributionGroupProps) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.year - b.year);

  return (
    <div className="flex flex-col gap-4">
      {/* 범례 — 색만으로 구분 금지 → 라벨 필수 */}
      <div className="flex flex-wrap items-center gap-3">
        {GRADES.map((g) => (
          <div key={g} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-3 w-3"
              style={{ background: gradeChipColor[g].bg }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: T.grey700 }}>
              {g}
            </span>
          </div>
        ))}
      </div>

      {/* 연도별 누적 막대 */}
      <div className="flex flex-col gap-3">
        {sorted.map((row) => (
          <div key={row.cycleId} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span
                style={{ fontSize: 12.5, fontWeight: 700, color: T.grey900 }}
                className="tabular-nums"
              >
                {row.year}
              </span>
              <span style={{ fontSize: 11, color: T.grey500 }}>
                {row.missing ? '데이터 없음' : `총 ${row.total}명`}
              </span>
            </div>

            {row.missing || row.total === 0 ? (
              <div
                className="flex items-center px-3"
                style={{ height: 26, background: T.grey50, fontSize: 11, color: T.grey400 }}
              >
                해당 연도 데이터 없음
              </div>
            ) : (
              <div
                className="flex overflow-hidden"
                style={{ height: 26, background: T.grey100 }}
              >
                {GRADES.map((g) => {
                  const pct = ratioOf(row, g);
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={g}
                      className="flex items-center justify-center transition-all"
                      style={{
                        width: `${pct}%`,
                        background: gradeChipColor[g].bg,
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#fff',
                        whiteSpace: 'nowrap',
                      }}
                      title={`${g} ${row.counts[g]}명 (${pct.toFixed(1)}%)`}
                    >
                      {pct >= 9
                        ? `${g} ${showRatio ? `${Math.round(pct)}%` : row.counts[g]}`
                        : ''}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
