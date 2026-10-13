'use client';

// 부서별 등급 분포 — 등급별 컬러 누적바 + 팀 인원수.
// 부서가 많아져도 카드가 무한정 길어지지 않게 목록에 상한(max-h)을 두고 내부 스크롤(2026-07-02).
import { Users } from 'lucide-react';
import type { Grade } from '@/lib/types';
import { ReportEmpty } from './ReportStates';
import { GRADE_SOLID } from './gradeTone';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export interface DeptDistEntry {
  dept: string;
  total: number;
  grades: Record<Grade, number>;
}

export function DistDeptBars({ deptDist }: { deptDist: DeptDistEntry[] }) {
  if (deptDist.length === 0) return <ReportEmpty title="부서 데이터가 없어요." />;

  return (
    <div className="space-y-2.5">
      <div className="flex gap-x-3 px-1 text-11 font-semibold text-muted-foreground">
        <span className="w-33 shrink-0">부서</span>
        <span className="w-15 shrink-0">인원</span>
        <span className="min-w-0 flex-1">등급 분포 (S/A/B/C/D)</span>
      </div>
      <div className="max-h-130 space-y-2.5 overflow-y-auto pr-0.5">
      {deptDist.map((d) => (
        <div key={d.dept} className="flex items-center gap-x-3 rounded-lg border border-border bg-card px-3 py-2.5">
          <span className="w-33 shrink-0 truncate text-12h font-semibold text-foreground">{d.dept}</span>
          <span className="flex w-15 shrink-0 items-center gap-1 text-12 text-muted-foreground">
            <Users size={12} aria-hidden /> {d.total}명
          </span>
          <div className="flex h-5 min-w-0 flex-1 overflow-hidden rounded-xs">
            {GRADES.map((g) => {
              const pct = d.total > 0 ? Math.round((d.grades[g] / d.total) * 100) : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={g}
                  className={`flex w-(--w) items-center justify-center text-9h font-bold ${GRADE_SOLID[g]}`}
                  style={{ '--w': `${pct}%` } as React.CSSProperties}
                >
                  {pct >= 14 ? `${pct}%` : ''}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
