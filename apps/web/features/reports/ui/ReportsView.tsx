'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useDepartments } from '@/hooks/useDepartments';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { ExportButton } from '@/components/ExportButton';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Select } from '@/components/Select';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { Card } from '@/components/Card';
import { GradeChip } from '@/components/GradeChip';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { SegmentedControl } from '@/components/SegmentedControl';
import { canReview, isHrAdmin } from '@/lib/nav';
import { fmtScore, fmtPercent, fmtAmount, kpiCategoryLabel } from '@/lib/ui';
import type {
  Grade,
  EvaluationResult,
  KpiCategory,
  MonthlyTrendPoint,
  MonthlyPerformanceSummaryCategory,
} from '@/lib/types';
import { useResultsData, useMonthlyPerformanceData } from '../hooks';
import { createMonthlyPerformance } from '../api';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const GRADE_TONE: Record<Grade, string> = {
  S: '#111111',
  A: '#3B3835',
  B: '#615D59',
  C: '#9A948E',
  D: '#C8C3BE',
};

type Tab = 'dist' | 'monthly';

export function ReportsView() {
  const { user } = useAuth();
  const { cycles, current, selectedId, setSelectedId, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;
  const allowed = !!user && canReview(user.role);

  const [tab, setTab] = useState<Tab>('dist');

  // 분포 데이터 — 헤더 요약 + DistMonitorTab 공유(헤더에 요약을 올리기 위해 View 레벨로 끌어올림).
  const { data: results, loading: resultsLoading, error: resultsError, reload: reloadResults } =
    useResultsData(cycleId);

  const distSummary = useMemo(() => {
    const counts: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of results) if (r.finalGrade) counts[r.finalGrade] += 1;
    const finalizedCount = results.filter((r) => r.finalGrade !== null).length;
    const scored = results.filter((r) => r.finalScore !== null);
    const avg = scored.length
      ? scored.reduce((acc, r) => acc + (r.finalScore ?? 0), 0) / scored.length
      : null;
    const sorted = (Object.entries(counts) as [Grade, number][]).sort((a, b) => b[1] - a[1]);
    const topGrade: Grade | '–' = sorted[0]?.[1] > 0 ? sorted[0][0] : '–';
    return { finalizedCount, avg, topGrade };
  }, [results]);

  if (!allowed) return <Forbidden message="분포 모니터링은 팀장 이상만 볼 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  const topGrade = distSummary.topGrade;
  const topGradeAccent =
    topGrade === '–' ? undefined
    : topGrade === 'S' || topGrade === 'A' ? 'text-primary'
    : 'text-foreground';

  // 분포 탭 요약 — 헤더(엑셀 내보내기 왼편)에 표시.
  const distHeaderMetrics =
    tab === 'dist' && !resultsLoading && !resultsError ? (
      <HeaderMetrics
        items={[
          { label: '대상자', value: `${results.length}명` },
          { label: '집계 완료', value: `${distSummary.finalizedCount}명`, accent: 'text-primary' },
          { label: '전사 평균', value: fmtScore(distSummary.avg), accent: 'text-primary' },
          { label: '최다 등급', value: topGrade, accent: topGradeAccent },
        ]}
      />
    ) : null;

  return (
    <PageContainer>
      <PageHeader
        title="분포 모니터링"
        subtitle="등급 분포와 월별 실적 추이를 확인합니다."
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <>
            {distHeaderMetrics}
            {user?.role === 'hr_admin' && cycleId && tab === 'dist' && (
              <ExportButton
                path={`/excel/export/distribution?cycleId=${cycleId}`}
                filename={`distribution-${cycleId}.xlsx`}
              />
            )}
          </>
        }
      />

      <SegmentedControl
        ariaLabel="분포 모니터링 탭"
        options={[
          { value: 'dist', label: '분포 모니터링' },
          { value: 'monthly', label: '월별 실적' },
        ]}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />

      {tab === 'dist' ? (
        <DistMonitorTab
          cycleId={cycleId}
          results={results}
          loading={resultsLoading}
          error={resultsError}
          reload={reloadResults}
        />
      ) : (
        <MonthlyPerfTab cycleId={cycleId} editable={isHrAdmin(user!.role)} />
      )}
    </PageContainer>
  );
}

// ── 분포 모니터링 ────────────────────────────────────────────────
function DistMonitorTab({
  cycleId,
  results,
  loading,
  error,
  reload,
}: {
  cycleId?: string;
  results: EvaluationResult[];
  loading: boolean;
  error: unknown;
  reload: () => void;
}) {
  const router = useRouter();

  const counts = useMemo(() => {
    const c: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of results) if (r.finalGrade) c[r.finalGrade] += 1;
    return c;
  }, [results]);

  const finalizedCount = results.filter((r) => r.finalGrade !== null).length;

  // 부서별 등급 분포(백엔드 등급의 표시용 집계 — 점수 재계산 아님).
  const deptDist = useMemo(() => {
    const map = new Map<string, { dept: string; total: number; grades: Record<Grade, number> }>();
    for (const r of results) {
      if (!r.finalGrade) continue;
      const dept = r.departmentName ?? '미지정';
      if (!map.has(dept)) map.set(dept, { dept, total: 0, grades: { S: 0, A: 0, B: 0, C: 0, D: 0 } });
      const e = map.get(dept)!;
      e.grades[r.finalGrade] += 1;
      e.total += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [results]);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState onRetry={reload} />;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {GRADES.map((g) => {
          const pct = finalizedCount > 0 ? Math.round((counts[g] / finalizedCount) * 100) : 0;
          return (
            <div key={g} className="rounded-none border border-border bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g} 등급</span>
                <GradeChip grade={g} size="sm" />
              </div>
              <p className="mt-1 text-[18px] font-bold tabular-nums text-foreground">
                {counts[g]}명
                <span className="ml-1 text-[12px] font-semibold text-muted-foreground">{pct}%</span>
              </p>
            </div>
          );
        })}
      </div>

      {/* 전사 등급 분포 막대 */}
      <Card title="전사 등급 분포" action={
        <div className="flex items-center gap-3 flex-wrap">
          {GRADES.map((g) => (
            <div key={g} className="flex items-center gap-1.5">
              <div className="h-3 w-3" style={{ background: GRADE_TONE[g] }} />
              <span className="text-xs font-semibold text-muted-foreground">{g}</span>
            </div>
          ))}
        </div>
      }>
        {finalizedCount === 0 ? (
          <EmptyState title="집계된 결과가 없어요." />
        ) : (
          <div className="flex overflow-hidden rounded-none" style={{ height: 32 }}>
            {GRADES.map((g) => {
              const pct = Math.round((counts[g] / finalizedCount) * 100);
              if (pct === 0) return null;
              return (
                <div
                  key={g}
                  className="flex items-center justify-center transition-all"
                  style={{ width: `${pct}%`, background: GRADE_TONE[g], fontSize: 12, color: '#fff', fontWeight: 700 }}
                >
                  {pct >= 8 ? `${g} ${pct}%` : ''}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 부서별 분포 + 결과 테이블 */}
      <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
        {/* 부서별 등급 분포 */}
        <Card title="부서별 등급 분포">
          {deptDist.length === 0 ? (
            <EmptyState title="부서 데이터가 없어요." />
          ) : (
            <div className="space-y-3">
              {deptDist.map((d) => (
                <div key={d.dept} className="p-3 rounded-none border border-border bg-muted">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">{d.dept}</span>
                    <span className="text-xs text-muted-foreground">{d.total}명</span>
                  </div>
                  <div className="flex overflow-hidden" style={{ height: 20 }}>
                    {GRADES.map((g) => {
                      const pct = d.total > 0 ? Math.round((d.grades[g] / d.total) * 100) : 0;
                      if (pct === 0) return null;
                      return (
                        <div
                          key={g}
                          className="flex items-center justify-center"
                          style={{ width: `${pct}%`, background: GRADE_TONE[g], fontSize: 9, color: '#fff', fontWeight: 700 }}
                        >
                          {pct >= 12 ? `${pct}%` : ''}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 결과 테이블 (점수순) */}
        <Card title="결과 (점수순)" padding="sm">
          {results.length === 0 ? (
            <div className="p-5">
              <EmptyState title="표시할 결과가 없어요." />
            </div>
          ) : (
            <div className="divide-y divide-border">
              <div className="grid px-4 py-2.5 bg-muted" style={{ gridTemplateColumns: '1fr 70px 60px' }}>
                {['대상자', '점수', '등급'].map((h, i) => (
                  <div key={h} className={`text-[11px] font-semibold text-muted-foreground ${i > 0 ? 'text-right' : ''}`}>
                    {h}
                  </div>
                ))}
              </div>
              {[...results]
                .sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1))
                .map((r: EvaluationResult) => (
                  <div
                    key={r.id}
                    className="grid cursor-pointer items-center px-4 py-3 transition-colors hover:bg-muted/60"
                    style={{ gridTemplateColumns: '1fr 70px 60px' }}
                    onClick={() => router.push(`/eval/result/${r.userId}?cycleId=${cycleId}`)}
                  >
                    <div>
                      <span className="text-[13px] font-semibold text-foreground">{r.userName ?? r.userId.slice(0, 8)}</span>
                      {r.departmentName && (
                        <span className="text-[11px] text-muted-foreground ml-1.5">{r.departmentName}</span>
                      )}
                    </div>
                    <div className="tabular-nums text-[13px] font-bold text-foreground text-right">{fmtScore(r.finalScore)}</div>
                    <div className="flex justify-end">
                      <GradeChip grade={r.finalGrade ?? null} size="sm" />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      {finalizedCount === 0 && (
        <div className="grid gap-5 xl:grid-cols-3">
          <Card title="집계 전 확인">
            <div className="space-y-3 text-[12.5px] leading-5 text-muted-foreground">
              {[
                '부서장 평가가 마감되면 최종 점수와 등급이 이 화면에 표시됩니다.',
                '등급 풀 기준은 그룹 단위로 계산되며, 결과 공개 전까지 분포를 계속 점검할 수 있습니다.',
                '결과가 적재되면 부서별 분포와 점수순 목록에서 개인 상세로 바로 이동합니다.',
              ].map((text) => (
                <div key={text} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="다음 운영 작업">
            <dl className="space-y-3">
              {[
                ['KPI 검토', '미확정 KPI와 반려 항목을 먼저 정리'],
                ['부서장 평가', '평가자 배정과 평가 진행 상태 확인'],
                ['결과 공개', '집계 완료 후 공개 일정과 알림 점검'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4">
                  <dt className="text-[12px] font-semibold text-foreground">{label}</dt>
                  <dd className="text-right text-[12px] leading-5 text-muted-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="표시 기준">
            <dl className="space-y-3">
              {[
                ['등급', 'S/A/B/C/D 최종 등급'],
                ['점수', 'KPI 성과 중심 최종 점수'],
                ['조직', '그룹·본부·팀 스냅샷 기준'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <dt className="text-[12px] text-muted-foreground">{label}</dt>
                  <dd className="text-right text-[12.5px] font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── 월별 실적 ────────────────────────────────────────────────────
function MonthlyPerfTab({ cycleId, editable }: { cycleId?: string; editable: boolean }) {
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
                      contentStyle={{ fontSize: 12, border: '1px solid hsl(var(--border))', borderRadius: 0 }}
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
