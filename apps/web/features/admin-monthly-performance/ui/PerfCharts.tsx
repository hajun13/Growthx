'use client';

// 그래프 분리 — image 11: ①매출 목표 vs 실적(라인) ②매출총이익(바) vs 이익률(라인), 이중 Y축.
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { EmptyState } from './StateBlocks';

export interface PerfChartDatum {
  month: number;
  label: string;
  revenueTarget: number | null;
  revenueActual: number | null;
  grossProfitActual: number | null;
  marginRate: number | null;
}

function formatAmountShort(value: number) {
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${Math.round(value / 100_000_000)}억`;
  if (abs >= 10_000) return `${Math.round(value / 10_000)}만`;
  return `${value}`;
}

// 색은 ChartConfig → --color-<key> CSS 변수(테마 차트 토큰)로. 구 하드코딩 hex 와 1:1(마지막 막대색만 chart-2).
const revenueConfig = {
  revenueTarget: { label: '매출 목표', color: 'var(--color-chart-1)' },
  revenueActual: { label: '매출 실적', color: 'var(--color-chart-4)' },
} satisfies ChartConfig;
const grossConfig = {
  grossProfitActual: { label: '매출총이익(억원)', color: 'var(--color-chart-2)' },
  marginRate: { label: '이익률', color: 'var(--color-chart-5)' },
} satisfies ChartConfig;

const tooltipStyle = { borderRadius: 8, borderColor: 'var(--color-border)', boxShadow: '0 1px 3px rgba(22,19,38,0.06)', fontSize: 12 };
const TICK = { fontSize: 11, fill: 'var(--color-muted-foreground)' };

export function RevenueTrendChart({ data, hasData }: { data: PerfChartDatum[]; hasData: boolean }) {
  if (!hasData) {
    return (
      <div className="flex h-65 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
        <EmptyState title="매출 목표·실적을 입력하면 추이가 표시돼요." />
      </div>
    );
  }
  return (
    <ChartContainer config={revenueConfig} className="aspect-auto h-65 w-full">
      <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-chart-grid)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} />
        <YAxis tickLine={false} axisLine={false} tick={TICK} width={50} tickFormatter={formatAmountShort} />
        <ChartTooltip formatter={(v) => (v === null ? '-' : formatAmountShort(Number(v)))} contentStyle={tooltipStyle} />
        <Legend verticalAlign="top" align="right" iconType="line" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
        <Line type="monotone" dataKey="revenueTarget" name="매출 목표" stroke="var(--color-revenueTarget)" strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="revenueActual" name="매출 실적" stroke="var(--color-revenueActual)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ChartContainer>
  );
}

export function GrossMarginChart({ data, hasData }: { data: PerfChartDatum[]; hasData: boolean }) {
  if (!hasData) {
    return (
      <div className="flex h-65 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
        <EmptyState title="원가를 입력하면 매출총이익·이익률 추이가 표시돼요." />
      </div>
    );
  }
  return (
    <ChartContainer config={grossConfig} className="aspect-auto h-65 w-full">
      <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-chart-grid)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} />
        <YAxis yAxisId="amount" tickLine={false} axisLine={false} tick={TICK} width={50} tickFormatter={formatAmountShort} />
        <YAxis yAxisId="rate" orientation="right" tickLine={false} axisLine={false} tick={TICK} width={38} tickFormatter={(v) => `${v}%`} />
        <ChartTooltip
          formatter={(value, name) =>
            name === '이익률' ? [`${Number(value).toFixed(1)}%`, name] : [formatAmountShort(Number(value)), name]
          }
          contentStyle={tooltipStyle}
        />
        <Legend verticalAlign="top" align="right" iconType="line" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
        <Bar yAxisId="amount" dataKey="grossProfitActual" name="매출총이익(억원)" fill="var(--color-grossProfitActual)" radius={[3, 3, 0, 0]} />
        <Line yAxisId="rate" type="monotone" dataKey="marginRate" name="이익률" stroke="var(--color-marginRate)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </ComposedChart>
    </ChartContainer>
  );
}
