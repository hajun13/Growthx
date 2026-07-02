'use client';

// 상단 등급 분포 — 단일 통합 카드: [등급 분포 라벨 | S~D 세그먼트(칩+인원+비율+미니바) | 전체 대상자].
import { Users } from 'lucide-react';
import { GradeChip } from '@/components/GradeChip';
import { HelpTooltip } from '@/components/HelpTooltip';
import { gradeChipColor } from '@/lib/palette';
import type { Grade } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export function SummaryGradeStats({
  counts,
  total,
}: {
  counts: Record<Grade, number>;
  total: number;
}) {
  return (
    <div className="flex items-stretch overflow-x-auto rounded-lg border border-border bg-card shadow-elev-1">
      <div className="flex shrink-0 items-center gap-1.5 border-r border-border px-5 text-[13px] font-bold text-foreground">
        등급 분포
        <HelpTooltip label="등급 분포 설명 보기" content="현재 주기 전체 대상자의 확정 최종등급 분포예요. 비율은 전체 대상자 기준." />
      </div>
      {GRADES.map((g) => {
        const pct = total > 0 ? Math.round((counts[g] / total) * 1000) / 10 : 0;
        const c = gradeChipColor[g];
        return (
          <div key={g} className="min-w-[150px] flex-1 border-r border-border px-5 py-3">
            <div className="flex items-center gap-2.5">
              <GradeChip grade={g} />
              <span className="text-[18px] font-bold leading-none tabular-nums text-foreground">
                {counts[g]}
                <span className="ml-0.5 text-[12px] font-semibold text-muted-foreground">명</span>
              </span>
              <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">{pct}%</span>
            </div>
            <div className="mt-2 h-[5px] w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: c.bg }}
              />
            </div>
          </div>
        );
      })}
      <div className="flex shrink-0 flex-col justify-center gap-1 px-5 py-3">
        <div className="text-[11px] text-muted-foreground">전체 대상자</div>
        <div className="flex items-center gap-1.5">
          <Users size={16} className="text-primary" aria-hidden />
          <span className="text-[18px] font-bold leading-none tabular-nums text-foreground">{total}명</span>
        </div>
      </div>
    </div>
  );
}
