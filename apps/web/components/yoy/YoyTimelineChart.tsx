'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import { T, gradeChipColor } from '@/lib/toss';
import { fmtScore } from '@/lib/ui';
import type { Grade, OrgSnapshot } from '@/lib/types';

export interface YoyTimelinePoint {
  cycleId: string;
  year: number;
  grade: Grade | null; // null=미집계 → 회색 점, 라인 단절
  score: number | null; // 툴팁 표시용
  org: OrgSnapshot;
  reflected: boolean; // 점수 등급 반영 여부(역량 미반영 연도 등)
}
export interface YoyTimelineChartProps {
  points: YoyTimelinePoint[]; // 연도 오름차순
  height?: number; // 기본 220
}

// 등급 → Y 랭크(S 위, D 아래). null 은 중앙(B 라인)에 배치.
const GRADE_RANK: Record<Grade, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };
const RANK_GRADE: Record<number, Grade> = { 5: 'S', 4: 'A', 3: 'B', 2: 'C', 1: 'D' };

interface ChartDatum extends YoyTimelinePoint {
  rank: number;
  label: string; // X축 연도 라벨
}

// recharts 커스텀 점 — 등급 색으로 채우고, 등급 글자를 위에 병기(색만으로 구분 금지).
// 미반영(역량 참고용 등) 연도는 속을 비운 링으로 구분(색에만 의존하지 않음).
function GradeDot(props: {
  cx?: number;
  cy?: number;
  payload?: ChartDatum;
  active?: boolean;
}) {
  const { cx, cy, payload, active } = props;
  if (cx == null || cy == null || !payload) return null;
  const fill = payload.grade ? gradeChipColor[payload.grade].bg : T.grey400;
  const hollow = !payload.reflected;
  const r = active ? 6.5 : 5;
  return (
    <g>
      {active && (
        <circle cx={cx} cy={cy} r={r + 4} fill={fill} fillOpacity={0.14} />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={hollow ? '#fff' : fill}
        stroke={hollow ? fill : '#fff'}
        strokeWidth={hollow ? 2 : active ? 2.5 : 2}
        strokeDasharray={hollow ? '2 1.5' : undefined}
      />
      <text
        x={cx}
        y={cy - 12}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill={fill}
      >
        {payload.grade ?? '—'}
      </text>
    </g>
  );
}

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ChartDatum;
  const org = [d.org.group, d.org.division, d.org.team]
    .filter(Boolean)
    .join(' › ');
  const swatch = d.grade ? gradeChipColor[d.grade].bg : T.grey400;
  return (
    <div
      className="bg-white px-3 py-2 shadow-md"
      style={{ border: `1px solid ${T.grey200}` }}
    >
      <div
        className="flex items-center gap-1.5"
        style={{ fontSize: 12, fontWeight: 700, color: T.grey900 }}
      >
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5"
          style={{ background: swatch }}
        />
        {d.year}년 · {d.grade ?? '미집계'}
        {!d.reflected && (
          <span style={{ color: T.grey500, fontWeight: 500 }}> (미반영)</span>
        )}
      </div>
      <div
        className="tabular-nums"
        style={{ fontSize: 12, color: T.grey600, marginTop: 2 }}
      >
        {fmtScore(d.score)}점
      </div>
      {org && (
        <div style={{ fontSize: 11, color: T.grey500, marginTop: 2 }}>{org}</div>
      )}
    </div>
  );
}

// 개인 연도별 등급 추이 — recharts(reports 화면과 동일 패턴). 값은 백엔드 산정 표시만.
export function YoyTimelineChart({ points, height = 220 }: YoyTimelineChartProps) {
  if (points.length === 0) return null;

  const data: ChartDatum[] = points.map((p) => ({
    ...p,
    rank: p.grade ? GRADE_RANK[p.grade] : 3, // null=중앙(B 라인)
    label: `${p.year}`,
  }));

  const ariaLabel = `등급 추이 — ${points
    .map(
      (p) => `${p.year} ${p.grade ?? '미집계'}${p.reflected ? '' : '(미반영)'}`,
    )
    .join(', ')}`;

  return (
    <div className="w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 20, right: 24, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.grey100} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: T.grey500 }}
            axisLine={false}
            tickLine={false}
            padding={{ left: 20, right: 20 }}
          />
          <YAxis
            type="number"
            domain={[0.5, 5.5]}
            ticks={[1, 2, 3, 4, 5]}
            tickFormatter={(v: number) => RANK_GRADE[v] ?? ''}
            tick={{ fontSize: 11, fontWeight: 700, fill: T.grey600 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: T.grey300, strokeDasharray: '4 4' }}
          />
          <Line
            type="monotone"
            dataKey="rank"
            stroke={T.blue500}
            strokeWidth={2.5}
            dot={<GradeDot />}
            activeDot={<GradeDot active />}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
