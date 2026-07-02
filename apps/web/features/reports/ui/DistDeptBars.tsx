'use client';

// 부서별 등급 분포 — 등급별 컬러 누적바 + 팀 인원수.
// 부서가 많아져도 카드가 무한정 길어지지 않게 목록에 상한(max-h)을 두고 내부 스크롤(2026-07-02).
import { Users } from 'lucide-react';
import { gradeChipColor } from '@/lib/palette';
import type { Grade } from '@/lib/types';
import { EmptyState } from '@/components/States';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export interface DeptDistEntry {
  dept: string;
  total: number;
  grades: Record<Grade, number>;
}

export function DistDeptBars({ deptDist }: { deptDist: DeptDistEntry[] }) {
  if (deptDist.length === 0) return <EmptyState title="부서 데이터가 없어요." />;

  return (
    <div className="space-y-2.5">
      <div className="grid gap-x-3 px-1 text-[11px] font-semibold text-muted-foreground" style={{ gridTemplateColumns: '132px 60px 1fr' }}>
        <span>부서</span>
        <span>인원</span>
        <span>등급 분포 (S/A/B/C/D)</span>
      </div>
      <div className="max-h-[520px] space-y-2.5 overflow-y-auto pr-0.5">
      {deptDist.map((d) => (
        <div key={d.dept} className="grid items-center gap-x-3 rounded-lg border border-border bg-card px-3 py-2.5" style={{ gridTemplateColumns: '132px 60px 1fr' }}>
          <span className="truncate text-[12.5px] font-semibold text-foreground">{d.dept}</span>
          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
            <Users size={12} aria-hidden /> {d.total}명
          </span>
          <div className="flex overflow-hidden rounded" style={{ height: 20 }}>
            {GRADES.map((g) => {
              const pct = d.total > 0 ? Math.round((d.grades[g] / d.total) * 100) : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={g}
                  className="flex items-center justify-center text-[9.5px] font-bold"
                  style={{ width: `${pct}%`, background: gradeChipColor[g].bg, color: gradeChipColor[g].color }}
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
