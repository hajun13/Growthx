'use client';

// 분포 모니터링 화면의 "월별 실적" 탭 — P18 범위 밖(분포 모니터링만 재스킨 대상)이라 기존 구조 그대로 이관.
import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useDepartments } from '@/hooks/useDepartments';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Select } from '@/components/Select';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { Card } from '@/components/Card';
import { GradeChip } from '@/components/GradeChip';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { fmtPercent, fmtAmount, kpiCategoryLabel } from '@/lib/ui';
import type { KpiCategory, MonthlyTrendPoint, MonthlyPerformanceSummaryCategory } from '@/lib/types';
import { useMonthlyPerformanceData } from '../hooks';
import { createMonthlyPerformance } from '../api';

export function MonthlyPerfTab({ cycleId, editable }: { cycleId?: string; editable: boolean }) {
  const toast = useToast();
  const { data: deptData } = useDepartments({});
  const depts = (deptData?.data ?? []).filter((d) => d.type === 'group' || d.type === 'division');
  const [departmentId, setDepartmentId] = useState('');
  const activeDeptId = departmentId || depts[0]?.id || '';

  const { data: summary, loading, error, reload } = useMonthlyPerformanceData(cycleId, activeDeptId || undefined);

  const [month, setMonth] = useState('');
  const [category, setCategory] = useState<KpiCategory>('revenue');
  const [target, setTarget] = useState('');
  const [actual, setActual] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!cycleId || !activeDeptId) return;
    const m = Number(month);
    if (!m || m < 1 || m > 12) {
      toast.show({ variant: 'danger', message: '월(1-12)을 입력해 주세요.' });
      return;
    }
    setBusy(true);
    try {
      await createMonthlyPerformance({
        cycleId,
        departmentId: activeDeptId,
        year: new Date().getFullYear(),
        month: m,
        category,
        targetAmount: Number(target) || 0,
        actualAmount: Number(actual) || 0,
      });
      toast.show({ variant: 'success', message: '월별 실적을 저장했어요.' });
      setMonth('');
      setTarget('');
      setActual('');
      reload();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장에 실패했어요.' });
    } finally {
      setBusy(false);
    }
  }

  const trend = useMemo(
    () => (summary?.monthlyTrend ?? []).map((p: MonthlyTrendPoint) => ({ month: `${p.month}월`, achievementRate: p.achievementRate })),
    [summary],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* 부서 선택 */}
      {depts.length > 0 && (
        <div className="gx-toolbar">
          <div className="w-full sm:w-[280px]">
            <Select label="부서" hideLabel value={activeDeptId} options={depts.map((d) => ({ value: d.id, label: d.name }))} onChange={setDepartmentId} />
          </div>
          <p className="text-[12.5px] leading-5 text-muted-foreground">
            선택한 조직의 월별 목표·실적·등급 흐름을 같은 화면에서 확인합니다.
          </p>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !summary ? (
        <EmptyState title="월별 실적 데이터가 없어요." />
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

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
            {/* 월별 추이 차트 */}
            <Card title="월별 달성률 추이 (%)">
              {trend.length === 0 ? (
                <EmptyState title="월별 추이 데이터가 없어요." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip
                      formatter={(v) => [`${v}%`, '달성률']}
                      contentStyle={{ fontSize: 12, border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    />
                    <ReferenceLine y={100} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                    <Line
                      type="monotone"
                      dataKey="achievementRate"
                      name="달성률"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* 카테고리별 누적 실적 표 */}
            <Card title="카테고리별 누적 실적" padding="sm">
              {summary.byCategory.length === 0 ? (
                <div className="p-4"><EmptyState title="카테고리 데이터가 없어요." /></div>
              ) : (
                <div className="divide-y divide-border">
                  <div className="grid bg-muted px-4 py-2.5" style={{ gridTemplateColumns: '1fr 1fr 1fr 90px 60px' }}>
                    {['카테고리', '목표', '실적', '달성률', '등급'].map((h, i) => (
                      <div key={h} className={`text-[11px] font-semibold text-muted-foreground ${i > 0 ? 'text-right' : ''}`}>{h}</div>
                    ))}
                  </div>
                  {summary.byCategory.map((c: MonthlyPerformanceSummaryCategory) => (
                    <div key={c.category} className="grid items-center px-4 py-3" style={{ gridTemplateColumns: '1fr 1fr 1fr 90px 60px' }}>
                      <div className="text-[13px] font-semibold text-foreground">{kpiCategoryLabel[c.category]}</div>
                      <div className="tabular-nums text-right text-[12.5px] text-muted-foreground">{fmtAmount(c.targetAmount)}</div>
                      <div className="tabular-nums text-right text-[12.5px] text-muted-foreground">{fmtAmount(c.actualAmount)}</div>
                      <div className={`tabular-nums text-right text-[12.5px] font-semibold ${c.achievementRate >= 90 ? 'text-primary' : 'text-foreground'}`}>
                        {fmtPercent(c.achievementRate)}
                      </div>
                      <div className="flex justify-end">
                        <GradeChip grade={c.currentGrade ?? null} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* 실적 입력(hr_admin) */}
      {editable && activeDeptId && cycleId && (
        <Card
          title="월별 실적 입력"
          action={<p className="text-xs text-muted-foreground">월·카테고리·목표·실적 입력 시 달성률·등급이 자동 산정돼요.</p>}
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <TextField label="월" type="number" value={month} onChange={setMonth} suffix="월" />
              <Select
                label="카테고리"
                value={category}
                options={(Object.keys(kpiCategoryLabel) as KpiCategory[]).map((k) => ({ value: k, label: kpiCategoryLabel[k] }))}
                onChange={(v) => setCategory(v as KpiCategory)}
              />
              <TextField label="목표" type="number" value={target} onChange={setTarget} />
              <TextField label="실적" type="number" value={actual} onChange={setActual} />
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" loading={busy} onClick={() => void save()}>실적 저장</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
