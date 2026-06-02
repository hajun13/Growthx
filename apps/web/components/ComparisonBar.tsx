'use client';

import { evalTypeBarClass, fmtScore } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { EvalType, Grade } from '@/lib/types';
import { GradeChip } from './GradeChip';

export interface ComparisonRow {
  type: EvalType;
  round?: 1 | 2;
  label: string;
  score: number;
  // 미집계(집계 전) 등급은 null — GradeChip이 "—"로 표시(QA B-1).
  grade: Grade | null;
}

export interface ComparisonBarProps {
  rows: ComparisonRow[];
  // 전사 평균 미집계 시 null — 마커 숨김 처리(QA B-1).
  companyAvg: number | null;
  max?: number;
}

function barClass(type: EvalType, round?: 1 | 2): string {
  if (type === 'downward') {
    return round === 2 ? 'bg-chart-downward-2' : 'bg-chart-downward-1';
  }
  return evalTypeBarClass[type];
}

export function ComparisonBar({
  rows,
  companyAvg,
  max = 100,
}: ComparisonBarProps) {
  // 전사 평균이 미집계(null)면 마커를 숨긴다.
  const hasAvg = companyAvg !== null;
  const avgPct = hasAvg
    ? Math.min(100, Math.max(0, (companyAvg / max) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => {
        const widthPct = Math.min(100, Math.max(0, (row.score / max) * 100));
        const gradeText = row.grade ?? '집계 전';
        return (
          <div
            key={`${row.type}-${row.round ?? 0}-${i}`}
            className="flex items-center gap-3"
          >
            <span className="w-24 shrink-0 text-sm text-foreground">
              {row.label}
            </span>
            <div className="relative h-6 flex-1 rounded-sm bg-muted">
              <div
                className={cn('h-6 rounded-sm', barClass(row.type, row.round))}
                style={{ width: `${widthPct}%` }}
                aria-label={`${row.label}, ${gradeText} ${fmtScore(
                  row.score,
                )}점${hasAvg ? `, 전사평균 ${fmtScore(companyAvg)}점` : ''}`}
              />
              {/* 전사평균 세로 마커(평균 집계 시에만) */}
              {hasAvg && (
                <div
                  className="absolute top-[-4px] bottom-[-4px] w-[2px] bg-chart-company-avg"
                  style={{ left: `${avgPct}%` }}
                  aria-hidden
                />
              )}
            </div>
            <span className="w-20 shrink-0 text-right">
              <GradeChip grade={row.grade} size="sm" showScore={row.score} />
            </span>
          </div>
        );
      })}
      {hasAvg && (
        <p className="text-xs text-muted-foreground">
          세로선은 전사 평균 {fmtScore(companyAvg)}점이에요.
        </p>
      )}
    </div>
  );
}
