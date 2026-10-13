'use client';

// 분포 모니터링 화면의 "월별 실적" 탭 — 부서 선택 + 요약 수치 + 달성률 추이 차트 + 카테고리 표 + 실적 입력(hr_admin).
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { useDepartments } from '@/hooks/useDepartments';
import { GradeChip } from '@/components/GradeChip';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { fmtPercent, fmtAmount, kpiCategoryLabel } from '@/lib/ui';
import type { MonthlyTrendPoint, MonthlyPerformanceSummaryCategory } from '@/lib/types';
import { useMonthlyPerformanceData } from '../hooks';
import { FilterSelect } from './FilterControls';
import { MonthlyPerfForm } from './MonthlyPerfForm';
import { ReportCard } from './ReportCard';
import { ReportEmpty, ReportError } from './ReportStates';

const TREND_CONFIG = {
  achievementRate: { label: '달성률', color: 'var(--color-primary)' },
} satisfies ChartConfig;

export function MonthlyPerfTab({ cycleId, editable }: { cycleId?: string; editable: boolean }) {
  const { data: deptData } = useDepartments({});
  const depts = (deptData?.data ?? []).filter((d) => d.type === 'group' || d.type === 'division');
  const [departmentId, setDepartmentId] = useState('');
  const activeDeptId = departmentId || depts[0]?.id || '';

  const { data: summary, loading, error, reload } = useMonthlyPerformanceData(cycleId, activeDeptId || undefined);

  const trend = useMemo(
    () => (summary?.monthlyTrend ?? []).map((p: MonthlyTrendPoint) => ({ month: `${p.month}월`, achievementRate: p.achievementRate })),
    [summary],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* 부서 선택 */}
      {depts.length > 0 && (
        <div className="gx-toolbar">
          <div className="w-full sm:w-70">
            <FilterSelect label="부서" value={activeDeptId} options={depts.map((d) => ({ value: d.id, label: d.name }))} onChange={setDepartmentId} />
          </div>
          <p className="text-12h leading-5 text-muted-foreground">
            선택한 조직의 월별 목표·실적·등급 흐름을 같은 화면에서 확인합니다.
          </p>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <ReportError onRetry={reload} />
      ) : !summary ? (
        <ReportEmpty title="월별 실적 데이터가 없어요." />
      ) : (
        <>
          {/* 요약 수치 스트립 */}
          <HeaderMetrics
            items={[
              { label: '누적 목표', value: fmtAmount(summary.targetAmount) },
              { label: '누적 실적', value: fmtAmount(summary.actualAmount), accent: 'text-primary' },
              { label: '누적 달성률', value: fmtPercent(summary.achievementRate), accent: summary.achievementRate >= 100 ? 'text-primary' : 'text-foreground' },
              { label: '현재 등급', value: <GradeChip grade={summary.currentGrade ?? null} variant="solid" /> },
            ]}
          />

          <div className="grid gap-5 xl:grid-cols-20">
            {/* 월별 추이 차트 */}
            <ReportCard title="월별 달성률 추이 (%)" className="xl:col-span-11">
              {trend.length === 0 ? (
                <ReportEmpty title="월별 추이 데이터가 없어요." />
              ) : (
                <ChartContainer config={TREND_CONFIG} className="aspect-auto h-65 w-full">
                  <LineChart data={trend} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                    <ChartTooltip
                      content={<ChartTooltipContent formatter={(v) => <span className="tabular-nums">달성률 {String(v)}%</span>} />}
                    />
                    <ReferenceLine y={100} stroke="var(--color-muted-foreground)" strokeDasharray="5 5" />
                    <Line
                      type="monotone"
                      dataKey="achievementRate"
                      name="달성률"
                      stroke="var(--color-achievementRate)"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: 'var(--color-achievementRate)' }}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </ReportCard>

            {/* 카테고리별 누적 실적 표 */}
            <ReportCard title="카테고리별 누적 실적" padding="sm" className="xl:col-span-9">
              {summary.byCategory.length === 0 ? (
                <ReportEmpty title="카테고리 데이터가 없어요." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow plain>
                      <TableHead className="text-11">카테고리</TableHead>
                      <TableHead textAlign="right" className="text-11">목표</TableHead>
                      <TableHead textAlign="right" className="text-11">실적</TableHead>
                      <TableHead textAlign="right" className="w-22.5 text-11">달성률</TableHead>
                      <TableHead textAlign="right" className="w-15 text-11">등급</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.byCategory.map((c: MonthlyPerformanceSummaryCategory) => (
                      <TableRow key={c.category} plain>
                        <TableCell className="text-13 font-semibold text-foreground">{kpiCategoryLabel[c.category]}</TableCell>
                        <TableCell textAlign="right" className="text-12h tabular-nums text-muted-foreground">{fmtAmount(c.targetAmount)}</TableCell>
                        <TableCell textAlign="right" className="text-12h tabular-nums text-muted-foreground">{fmtAmount(c.actualAmount)}</TableCell>
                        <TableCell textAlign="right" className={`text-12h font-semibold tabular-nums ${c.achievementRate >= 90 ? 'text-primary' : 'text-foreground'}`}>
                          {fmtPercent(c.achievementRate)}
                        </TableCell>
                        <TableCell textAlign="right">
                          <GradeChip grade={c.currentGrade ?? null} size="sm" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ReportCard>
          </div>
        </>
      )}

      {/* 실적 입력(hr_admin) */}
      {editable && activeDeptId && cycleId && (
        <MonthlyPerfForm cycleId={cycleId} departmentId={activeDeptId} onSaved={reload} />
      )}
    </div>
  );
}
