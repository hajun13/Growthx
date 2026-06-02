'use client';

import { fmtScore, tierLabel } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { Grade, PoolTier } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

const gradeSolid: Record<Grade, string> = {
  S: 'bg-grade-s',
  A: 'bg-grade-a',
  B: 'bg-grade-b',
  C: 'bg-grade-c',
  D: 'bg-grade-d',
};

const tierTone: Record<PoolTier, string> = {
  excellent: 'bg-status-finalized-bg text-status-finalized-fg',
  standard: 'bg-status-not-started-bg text-status-not-started-fg',
  poor: 'bg-warning-50 text-warning-700',
};

export interface DistributionBarChartProps {
  counts: Record<Grade, number>;
  // 그룹 풀 상한(인원). 초과 시 danger.
  caps?: Record<Grade, number>;
  tier?: PoolTier;
  total: number;
  avg?: number | null;
}

// S~D 등급 분포 막대 + 그룹 풀 상한 마커. 부서장 평가·그룹풀·모니터링 공용.
export function DistributionBarChart({
  counts,
  caps,
  tier,
  total,
  avg,
}: DistributionBarChartProps) {
  const maxScale = Math.max(
    total,
    ...GRADES.map((g) => counts[g] ?? 0),
    ...(caps ? GRADES.map((g) => caps[g] ?? 0) : [0]),
    1,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          총 {total}명
          {avg !== undefined && avg !== null && (
            <span className="ml-2 tabular-nums">평균 {fmtScore(avg)}</span>
          )}
        </span>
        {tier && (
          <Badge className={cn('border-transparent font-medium', tierTone[tier])}>
            {tierLabel[tier]} 그룹
          </Badge>
        )}
      </div>

      <ul
        role="img"
        aria-label={`등급 분포 — ${GRADES.map((g) => `${g} ${counts[g] ?? 0}명${caps ? `/상한 ${caps[g] ?? 0}` : ''}`).join(', ')}`}
        className="flex flex-col gap-2"
      >
        {GRADES.map((g) => {
          const c = counts[g] ?? 0;
          const cap = caps?.[g];
          const over = cap !== undefined && c > cap;
          const widthPct = (c / maxScale) * 100;
          const capPct = cap !== undefined ? (cap / maxScale) * 100 : null;
          return (
            <li key={g} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-sm font-semibold text-foreground">
                {g}
              </span>
              <div className="relative h-6 flex-1 rounded-sm bg-muted">
                <div
                  className={cn(
                    'h-6 rounded-sm',
                    over ? 'bg-danger-500' : gradeSolid[g],
                  )}
                  style={{ width: `${Math.min(100, widthPct)}%` }}
                />
                {capPct !== null && (
                  <div
                    className="absolute top-[-3px] bottom-[-3px] w-0 border-l-2 border-dashed border-pool-cap-marker"
                    style={{ left: `${Math.min(100, capPct)}%` }}
                    aria-hidden
                  />
                )}
              </div>
              <span className="w-24 shrink-0 text-right text-sm tabular-nums text-foreground">
                {c}
                {cap !== undefined && (
                  <span className="text-muted-foreground"> / {cap}</span>
                )}
                {over && (
                  <span className="ml-1 text-xs font-medium text-danger-600">
                    초과
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {caps && (
        <p className="text-xs text-muted-foreground">
          점선은 그룹 풀 상한이에요.
        </p>
      )}
    </div>
  );
}
