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
import { T } from '@/lib/palette';
import { fmtScore } from '@/lib/ui';
import type { Grade, OrgSnapshot } from '@/lib/types';

// ── Notion Low Color 팔레트 ──────────────────────────────────
const K = {
  secondary: '#0075DE', // 라인 색
  onSurface: '#18181c',
  onSurfaceVariant: '#565660',
  outline: '#74747f',
  outlineVariant: '#ccccd4',
  surfaceLow: '#efeff2',
  white: '#ffffff',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(17,17,17,0.04)';

// GRADE_BADGE — 브리프 §4-1 기준 (S=ink, A=dark gray)
const GRADE_BADGE: Record<string, { bg: string; color: string }> = {
  S: { bg: '#111111', color: '#fff' },
  A: { bg: '#0075DE', color: '#fff' },
  B: { bg: '#615D59', color: '#fff' },
  C: { bg: '#9A948E', color: '#fff' },
  D: { bg: '#C8C3BE', color: '#fff' },
};

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
  const fill = payload.grade ? GRADE_BADGE[payload.grade].bg : K.outline;
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
  const swatch = d.grade ? GRADE_BADGE[d.grade].bg : K.outline;
  return (
    <div
      style={{
        background: K.white,
        border: `1px solid rgba(204,204,212,0.5)`,
        borderRadius: 0,
        padding: '8px 12px',
        boxShadow: CARD_SHADOW,
      }}
    >
      <div
        className="flex items-center gap-1.5"
        style={{ fontSize: 12, fontWeight: 700, color: K.onSurface }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            background: swatch,
            borderRadius: 3,
          }}
        />
        {d.year}년 · {d.grade ?? '미집계'}
        {!d.reflected && (
          <span style={{ color: K.outline, fontWeight: 500 }}> (미반영)</span>
        )}
      </div>
      <div
        className="tabular-nums"
        style={{ fontSize: 12, color: K.onSurfaceVariant, marginTop: 2 }}
      >
        {fmtScore(d.score)}점
      </div>
      {org && (
        <div style={{ fontSize: 11, color: K.outline, marginTop: 2 }}>{org}</div>
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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(204,204,212,0.3)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: K.onSurfaceVariant }}
            axisLine={false}
            tickLine={false}
            padding={{ left: 20, right: 20 }}
          />
          <YAxis
            type="number"
            domain={[0.5, 5.5]}
            ticks={[1, 2, 3, 4, 5]}
            tickFormatter={(v: number) => RANK_GRADE[v] ?? ''}
            tick={{ fontSize: 11, fontWeight: 700, fill: K.onSurfaceVariant }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: K.outlineVariant, strokeDasharray: '4 4' }}
          />
          <Line
            type="monotone"
            dataKey="rank"
            stroke={K.secondary}
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
