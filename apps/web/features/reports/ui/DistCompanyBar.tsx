'use client';

// 전사 등급 분포 컬러 막대 — image 14: 등급별 색 구간 + %·인원 병기.
import { gradeChipColor } from '@/lib/palette';
import type { Grade } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export function DistCompanyBar({ counts, total }: { counts: Record<Grade, number>; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex overflow-hidden rounded-lg" style={{ height: 36 }}>
      {GRADES.map((g) => {
        const pct = Math.round((counts[g] / total) * 100);
        if (pct === 0) return null;
        return (
          <div
            key={g}
            className="flex items-center justify-center text-[12px] font-bold transition-all"
            style={{ width: `${pct}%`, background: gradeChipColor[g].bg, color: gradeChipColor[g].color }}
          >
            {pct >= 6 ? `${g} ${pct}% (${counts[g]}명)` : ''}
          </div>
        );
      })}
    </div>
  );
}
