'use client';

import { fmtPercent, monthLabel } from '@/lib/ui';
import type { MonthlyTrendPoint } from '@/lib/types';

export interface MonthlyTrendChartProps {
  points: MonthlyTrendPoint[];
  height?: number;
}

// 월별 누적 달성률 트렌드 — 간단 SVG 라인(차트 라이브러리 없이).
// 값은 백엔드 산정 그대로 표시(재계산 금지).
export function MonthlyTrendChart({
  points,
  height = 160,
}: MonthlyTrendChartProps) {
  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        표시할 월별 데이터가 없어요.
      </p>
    );
  }

  const W = 640;
  const H = height;
  const padX = 32;
  const padY = 20;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const maxRate = Math.max(100, ...points.map((p) => p.achievementRate));
  const n = points.length;
  const x = (i: number) => (n === 1 ? W / 2 : padX + (innerW * i) / (n - 1));
  const y = (rate: number) => padY + innerH * (1 - rate / maxRate);

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.achievementRate)}`)
    .join(' ');

  // 100% 기준선.
  const baselineY = y(100);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`월별 달성률 트렌드 — ${points
          .map((p) => `${monthLabel(p.month)} ${fmtPercent(p.achievementRate)}`)
          .join(', ')}`}
        className="min-w-[480px]"
      >
        {/* 100% 기준선 */}
        <line
          x1={padX}
          x2={W - padX}
          y1={baselineY}
          y2={baselineY}
          className="stroke-border"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text
          x={W - padX}
          y={baselineY - 4}
          textAnchor="end"
          className="fill-muted-foreground text-[10px]"
        >
          100%
        </text>

        <path
          d={linePath}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <g key={p.month}>
            <circle
              cx={x(i)}
              cy={y(p.achievementRate)}
              r={3.5}
              className="fill-primary"
            />
            <text
              x={x(i)}
              y={H - 4}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {p.month}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
