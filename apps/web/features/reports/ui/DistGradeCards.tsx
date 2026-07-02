'use client';

// 상단 S~D 등급 카드 — image 14: 등급 배지 + 인원 + 비율 강조.
import { Users2 } from 'lucide-react';
import { GradeChip } from '@/components/GradeChip';
import type { Grade } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export function DistGradeCards({ counts, total }: { counts: Record<Grade, number>; total: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {GRADES.map((g) => {
        const pct = total > 0 ? Math.round((counts[g] / total) * 100) : 0;
        return (
          <div key={g} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3.5 shadow-elev-1">
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <GradeChip grade={g} size="sm" />
                <span className="text-[12px] font-semibold text-muted-foreground">{g} 등급</span>
              </div>
              <p className="text-[20px] font-bold leading-none tabular-nums text-foreground">
                {counts[g]}명 <span className="text-[12px] font-semibold text-muted-foreground">{pct}%</span>
              </p>
            </div>
            <Users2 size={22} className="shrink-0 text-muted-foreground/50" aria-hidden />
          </div>
        );
      })}
    </div>
  );
}
