'use client';

// 상단 등급 분포 — 단일 통합 카드: [등급 분포 라벨 | S~D 세그먼트(칩+인원+비율+미니바) | 전체 대상자].
import { Users } from 'lucide-react';
import { GradeChip } from '@/components/GradeChip';
import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Grade } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

const GRADE_BG: Record<Grade, string> = {
  S: 'bg-grade-s',
  A: 'bg-grade-a',
  B: 'bg-grade-b',
  C: 'bg-grade-c',
  D: 'bg-grade-d',
};

export function SummaryGradeStats({
  counts,
  total,
  provisional = false,
}: {
  counts: Record<Grade, number>;
  total: number;
  // 주기 closed 전(잠정 집계) 여부 — 툴팁의 "확정" 표현을 완화.
  provisional?: boolean;
}) {
  return (
    <Card className="flex items-stretch overflow-x-auto">
      <div className="flex shrink-0 items-center gap-1.5 border-r border-border px-5 text-13 font-bold text-foreground">
        등급 분포
        <TooltipProvider delayDuration={150} skipDelayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="help" size="icon-2xs" aria-label="등급 분포 설명 보기">
                <CircleHelp aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent variant="rich" side="bottom" align="start" sideOffset={4}>
              {provisional
                ? '현재 주기 전체 대상자의 잠정 최종등급 분포예요(확정 전 — 조정 과정에서 바뀔 수 있어요). 비율은 전체 대상자 기준.'
                : '현재 주기 전체 대상자의 확정 최종등급 분포예요. 비율은 전체 대상자 기준.'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {GRADES.map((g) => {
        const pct = total > 0 ? Math.round((counts[g] / total) * 1000) / 10 : 0;
        return (
          <div key={g} className="min-w-37.5 flex-1 border-r border-border px-5 py-3">
            <div className="flex items-center gap-2.5">
              <GradeChip grade={g} />
              <span className="text-18 font-bold leading-none tabular-nums text-foreground">
                {counts[g]}
                <span className="ml-0.5 text-12 font-semibold text-muted-foreground">명</span>
              </span>
              <span className="ml-auto text-12 tabular-nums text-muted-foreground">{pct}%</span>
            </div>
            <div className="mt-2 h-1.25 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full w-(--w) rounded-full ${GRADE_BG[g]}`}
                style={{ '--w': `${pct}%` } as React.CSSProperties}
              />
            </div>
          </div>
        );
      })}
      <div className="flex shrink-0 flex-col justify-center gap-1 px-5 py-3">
        <div className="text-11 text-muted-foreground">전체 대상자</div>
        <div className="flex items-center gap-1.5">
          <Users size={16} className="text-primary" aria-hidden />
          <span className="text-18 font-bold leading-none tabular-nums text-foreground">{total}명</span>
        </div>
      </div>
    </Card>
  );
}
