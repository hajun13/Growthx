'use client';

// 전사 등급 분포 컬러 막대 — image 14: 등급별 색 구간 + %·인원 병기.
import type { Grade } from '@/lib/types';
import { GRADE_SOLID } from './gradeTone';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export function DistCompanyBar({ counts, total }: { counts: Record<Grade, number>; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex h-9 overflow-hidden rounded-lg">
      {GRADES.map((g) => {
        const pct = Math.round((counts[g] / total) * 100);
        if (pct === 0) return null;
        return (
          <div
            key={g}
            className={`flex w-(--w) items-center justify-center text-12 font-bold transition-all ${GRADE_SOLID[g]}`}
            style={{ '--w': `${pct}%` } as React.CSSProperties}
          >
            {pct >= 6 ? `${g} ${pct}% (${counts[g]}명)` : ''}
          </div>
        );
      })}
    </div>
  );
}
