'use client';

import { Info } from 'lucide-react';
import { fmtScore, fmtPercent } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { Grade, MeasureType } from '@/lib/types';
import { GradeChip } from './GradeChip';

export interface ScoreCardProps {
  score: number;
  measureType?: MeasureType;
  achievementRate?: number; // amount/rate
  count?: number; // count
  grade?: Grade;
  weight?: number;
  label?: string;
  // 우측 레일 강조용(레퍼런스의 컬러 점수 카드). 기본은 흰 카드.
  prominent?: boolean;
  hint?: string;
}

// 점수·달성률/건수 표시만(백엔드 산정값). 프론트 재계산 없음.
export function ScoreCard({
  score,
  measureType,
  achievementRate,
  count,
  grade,
  weight,
  label = '과제 최종점수',
  prominent = false,
  hint,
}: ScoreCardProps) {
  const showCount = measureType === 'count';

  if (prominent) {
    return (
      <div className="overflow-hidden rounded-none border border-border bg-card">
        <div className="border-b border-border bg-primary px-5 py-5 text-primary-foreground">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-primary-foreground/85">{label}</p>
            {grade && <GradeChip grade={grade} size="sm" variant="solid" />}
          </div>
          <p className="mt-1 text-4xl font-extrabold tabular-nums">
            {fmtScore(score)}
          </p>
          {hint && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-foreground/80">
              <Info className="h-3.5 w-3.5" aria-hidden />
              {hint}
            </p>
          )}
        </div>
        <dl className="flex flex-col gap-2 bg-card px-5 py-4 text-sm">
          {showCount && count !== undefined && (
            <Row label="실적 건수" value={`${count}건`} />
          )}
          {!showCount && achievementRate !== undefined && (
            <Row label="목표 달성률" value={fmtPercent(achievementRate)} />
          )}
          {weight !== undefined && <Row label="가중치" value={`${weight}%`} />}
        </dl>
      </div>
    );
  }

  return (
    <div className="rounded-none border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {grade && <GradeChip grade={grade} size="sm" showScore={score} />}
      </div>
      <p className="mt-2 text-3xl font-extrabold tabular-nums text-foreground">
        {fmtScore(score)}
      </p>
      <dl className="mt-4 flex flex-col gap-1.5 text-sm">
        {showCount && count !== undefined && (
          <Row label="실적 건수" value={`${count}건`} />
        )}
        {!showCount && achievementRate !== undefined && (
          <Row label="목표 달성률" value={fmtPercent(achievementRate)} />
        )}
        {weight !== undefined && <Row label="가중치" value={`${weight}%`} />}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
