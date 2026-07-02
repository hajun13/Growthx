'use client';

// 그래프 분리 — image 11: ①매출 목표 vs 실적(라인) ②매출총이익(바) vs 이익률(라인), 이중 Y축.
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from '@/components/States';

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

const tooltipStyle = { borderRadius: 8, borderColor: '#E7E9F3', boxShadow: '0 1px 3px rgba(22,19,38,0.06)', fontSize: 12 };

export function RevenueTrendChart({ data, hasData }: { data: PerfChartDatum[]; hasData: boolean }) {
  if (!hasData) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
        <EmptyState title="매출 목표·실적을 입력하면 추이가 표시돼요." />
      </div>
    );
  }
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9F3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6B6980' }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6B6980' }} width={50} tickFormatter={formatAmountShort} />
          <Tooltip formatter={(v) => (v === null ? '-' : formatAmountShort(Number(v)))} contentStyle={tooltipStyle} />
          <Legend verticalAlign="top" align="right" iconType="line" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
          <Line type="monotone" dataKey="revenueTarget" name="매출 목표" stroke="#0257CE" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="revenueActual" name="매출 실적" stroke="#0EA05E" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrossMarginChart({ data, hasData }: { data: PerfChartDatum[]; hasData: boolean }) {
  if (!hasData) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
        <EmptyState title="원가를 입력하면 매출총이익·이익률 추이가 표시돼요." />
      </div>
    );
  }
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E9F3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6B6980' }} />
          <YAxis yAxisId="amount" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6B6980' }} width={50} tickFormatter={formatAmountShort} />
          <YAxis yAxisId="rate" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#6B6980' }} width={38} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            formatter={(value, name) =>
              name === '이익률' ? [`${Number(value).toFixed(1)}%`, name] : [formatAmountShort(Number(value)), name]
            }
            contentStyle={tooltipStyle}
          />
          <Legend verticalAlign="top" align="right" iconType="line" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
          <Bar yAxisId="amount" dataKey="grossProfitActual" name="매출총이익(억원)" fill="#A78BFA" radius={[3, 3, 0, 0]} />
          <Line yAxisId="rate" type="monotone" dataKey="marginRate" name="이익률" stroke="#F97316" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
