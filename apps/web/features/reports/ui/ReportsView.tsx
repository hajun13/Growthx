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
import { CheckCircle2 } from 'lucide-react';

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
import { canReview, isHrAdmin } from '@/lib/nav';
import {
  fmtScore,
  fmtPercent,
  fmtAmount,
  kpiCategoryLabel,
} from '@/lib/ui';
import { gradeColor } from '@/lib/grade';
import type {
  Grade,
  EvaluationResult,
  KpiCategory,
  MonthlyTrendPoint,
  MonthlyPerformanceSummaryCategory,
} from '@/lib/types';
import {
  useResultsData,
  useMonthlyPerformanceData,
} from '../hooks';
import { createMonthlyPerformance } from '../api';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// ── Kinetic Enterprise 팔레트 (루트 DESIGN.md SSOT) ──────────────
const K = {
  primary: '#7a37d8',
  primaryContainer: '#6a2dc0',
  secondary: '#7A37D8',
  secondaryDim: '#2563eb',
  tertiary: '#2563eb',
  tertiaryBright: '#cdddfb',
  surface: '#f7f7f9',
  surfaceLow: '#efeff2',
  white: '#ffffff',
  onSurface: '#18181c',
  onSurfaceVariant: '#565660',
  outline: '#74747f',
  outlineVariant: '#ccccd4',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

type Tab = 'dist' | 'monthly';

export function ReportsView() {
  const { user } = useAuth();
  const {
    cycles,
    current,
    selectedId,
    setSelectedId,
    loading: cyclesLoading,
  } = useCurrentCycle();
  const cycleId = current?.id;
  const allowed = !!user && canReview(user.role);

  const [tab, setTab] = useState<Tab>('dist');

  if (!allowed) {
    return <Forbidden message="분포 모니터링은 팀장 이상만 볼 수 있어요." />;
  }
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  return (
    <PageContainer>
      <PageHeader
        title="분포 모니터링"
        subtitle="등급 분포와 월별 실적 추이를 확인합니다."
        cycles={cycles}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          user?.role === 'hr_admin' && cycleId && tab === 'dist' ? (
            <ExportButton
              path={`/excel/export/distribution?cycleId=${cycleId}`}
              filename={`distribution-${cycleId}.xlsx`}
            />
          ) : undefined
        }
      />

      {/* 탭 — Kinetic pill-group 세그먼트 */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl"
        style={{ background: K.surfaceLow, width: 'fit-content' }}
      >
        {(
          [
            ['dist', '분포 모니터링'],
            ['monthly', '월별 실적'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{
              fontSize: 13,
              fontWeight: 600,
              background: tab === key ? K.white : 'transparent',
              color: tab === key ? K.onSurface : K.onSurfaceVariant,
              boxShadow: tab === key ? CARD_SHADOW : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dist' ? (
        <DistMonitorTab cycleId={cycleId} />
      ) : (
        <MonthlyPerfTab cycleId={cycleId} editable={isHrAdmin(user!.role)} />
      )}
    </PageContainer>
  );
}

// ── 분포 모니터링 ────────────────────────────────────────────
function DistMonitorTab({ cycleId }: { cycleId?: string }) {
  const router = useRouter();
  const { data: results, loading, error, reload } = useResultsData(cycleId);

  const counts = useMemo(() => {
    const c: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of results) if (r.finalGrade) c[r.finalGrade] += 1;
    return c;
  }, [results]);

  const finalizedCount = results.filter((r) => r.finalGrade !== null).length;

  const avg = useMemo(() => {
    const scored = results.filter((r) => r.finalScore !== null);
    if (scored.length === 0) return null;
    return (
      scored.reduce((acc, r) => acc + (r.finalScore ?? 0), 0) / scored.length
    );
  }, [results]);

  // 부서별 등급 분포(백엔드 등급의 표시용 집계 — 점수 재계산 아님).
  const deptDist = useMemo(() => {
    const map = new Map<
      string,
      { dept: string; total: number; grades: Record<Grade, number> }
    >();
    for (const r of results) {
      if (!r.finalGrade) continue;
      const dept = r.departmentName ?? '미지정';
      if (!map.has(dept))
        map.set(dept, {
          dept,
          total: 0,
          grades: { S: 0, A: 0, B: 0, C: 0, D: 0 },
        });
      const e = map.get(dept)!;
      e.grades[r.finalGrade] += 1;
      e.total += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [results]);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState onRetry={reload} />;

  const topGrade =
    (Object.entries(counts) as [Grade, number][]).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[1] > 0
      ? (Object.entries(counts) as [Grade, number][]).sort(
          (a, b) => b[1] - a[1],
        )[0][0]
      : '–';

  return (
    <div className="flex flex-col gap-5">
      {/* 요약 카드 4장 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          label="대상자"
          value={`${results.length}명`}
          color={K.primary}
          icon={CheckCircle2}
        />
        <SummaryCard
          label="집계 완료"
          value={`${finalizedCount}명`}
          color={K.tertiary}
          icon={CheckCircle2}
        />
        <SummaryCard
          label="전사 평균"
          value={fmtScore(avg)}
          color={K.secondary}
          icon={CheckCircle2}
        />
        <SummaryCard
          label="최다 등급"
          value={topGrade}
          color={topGrade === '–' ? K.outlineVariant : gradeColor(topGrade as Grade).fg}
          icon={CheckCircle2}
        />
      </div>

      {/* 전사 등급 분포 막대 */}
      <div
        className="bg-white p-5 rounded-xl"
        style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: K.onSurface }}>
            전사 등급 분포
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            {GRADES.map((g) => (
              <div key={g} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ background: gradeColor(g).bg }}
                />
                <span style={{ fontSize: 12, color: K.onSurfaceVariant, fontWeight: 600 }}>{g}</span>
              </div>
            ))}
          </div>
        </div>
        {finalizedCount === 0 ? (
          <EmptyState title="집계된 결과가 없어요." />
        ) : (
          <div className="flex overflow-hidden rounded-lg" style={{ height: 32 }}>
            {GRADES.map((g) => {
              const pct = Math.round((counts[g] / finalizedCount) * 100);
              if (pct === 0) return null;
              const gc = gradeColor(g);
              return (
                <div
                  key={g}
                  className="flex items-center justify-center transition-all"
                  style={{
                    width: `${pct}%`,
                    background: gc.bg,
                    fontSize: 12,
                    color: gc.fg,
                    fontWeight: 700,
                  }}
                >
                  {pct >= 8 ? `${g} ${pct}%` : ''}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 부서별 분포 + 결과 테이블 */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* 부서별 등급 분포 */}
        <div
          className="bg-white p-5 rounded-xl"
          style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}
        >
          <h3
            style={{ fontSize: 16, fontWeight: 700, color: K.onSurface, marginBottom: 14 }}
          >
            부서별 등급 분포
          </h3>
          {deptDist.length === 0 ? (
            <EmptyState title="부서 데이터가 없어요." />
          ) : (
            <div className="space-y-3">
              {deptDist.map((d) => (
                <div
                  key={d.dept}
                  className="p-3 rounded-lg"
                  style={{ border: '1px solid rgba(204,204,212,0.5)', background: K.surfaceLow }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: 13, fontWeight: 600, color: K.onSurface }}>
                      {d.dept}
                    </span>
                    <span style={{ fontSize: 12, color: K.onSurfaceVariant }}>
                      {d.total}명
                    </span>
                  </div>
                  <div className="flex overflow-hidden rounded-md" style={{ height: 20 }}>
                    {GRADES.map((g) => {
                      const pct =
                        d.total > 0
                          ? Math.round((d.grades[g] / d.total) * 100)
                          : 0;
                      if (pct === 0) return null;
                      const gc = gradeColor(g);
                      return (
                        <div
                          key={g}
                          className="flex items-center justify-center"
                          style={{
                            width: `${pct}%`,
                            background: gc.bg,
                            fontSize: 9,
                            color: gc.fg,
                            fontWeight: 700,
                          }}
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
        </div>

        {/* 결과 테이블 (점수순) */}
        <div
          className="bg-white rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}
        >
          <div
            className="px-5 py-3.5"
            style={{
              background: K.surfaceLow,
              borderBottom: '1px solid #e3e3e8',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: K.onSurface }}>
              결과 (점수순)
            </h3>
          </div>
          {/* 헤더 행 */}
          <div
            className="grid px-5 py-2.5"
            style={{
              gridTemplateColumns: '1fr 70px 60px',
              background: K.surfaceLow,
              borderBottom: `1px solid rgba(204,204,212,0.4)`,
            }}
          >
            {['대상자', '점수', '등급'].map((h, i) => (
              <div
                key={h}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: K.onSurfaceVariant,
                  textAlign: i === 0 ? 'left' : 'right',
                }}
              >
                {h}
              </div>
            ))}
          </div>
          {results.length === 0 ? (
            <div className="p-5">
              <EmptyState title="표시할 결과가 없어요." />
            </div>
          ) : (
            [...results]
              .sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1))
              .map((r: EvaluationResult) => (
                <div
                  key={r.id}
                  className="grid items-center px-5 py-3 cursor-pointer transition-colors"
                  style={{
                    gridTemplateColumns: '1fr 70px 60px',
                    borderBottom: `1px solid rgba(204,204,212,0.2)`,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = K.surfaceLow; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = K.white; }}
                  onClick={() =>
                    router.push(`/eval/result/${r.userId}?cycleId=${cycleId}`)
                  }
                >
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: K.onSurface }}>
                      {r.userName ?? r.userId.slice(0, 8)}
                    </span>
                    {r.departmentName && (
                      <span style={{ fontSize: 11, color: K.onSurfaceVariant, marginLeft: 6 }}>
                        {r.departmentName}
                      </span>
                    )}
                  </div>
                  <div
                    className="tabular-nums"
                    style={{ fontSize: 13, fontWeight: 700, color: K.onSurface, textAlign: 'right' }}
                  >
                    {fmtScore(r.finalScore)}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {r.finalGrade ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: gradeColor(r.finalGrade).fg,
                          background: gradeColor(r.finalGrade).bg,
                          padding: '3px 10px',
                          borderRadius: 999,
                        }}
                      >
                        {r.finalGrade}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: K.outlineVariant }}>—</span>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: typeof CheckCircle2;
}) {
  return (
    <div
      className="bg-white px-5 py-4 rounded-xl flex items-center gap-3"
      style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: color }}
      >
        <Icon size={18} color="#fff" />
      </div>
      <div>
        <div className="tabular-nums" style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: K.onSurfaceVariant }}>{label}</div>
      </div>
    </div>
  );
}

// ── 월별 실적 ────────────────────────────────────────────────
function MonthlyPerfTab({
  cycleId,
  editable,
}: {
  cycleId?: string;
  editable: boolean;
}) {
  const toast = useToast();
  const { data: deptData } = useDepartments({});
  const depts = (deptData?.data ?? []).filter(
    (d) => d.type === 'group' || d.type === 'division',
  );
  const [departmentId, setDepartmentId] = useState('');
  const activeDeptId = departmentId || depts[0]?.id || '';

  const { data: summary, loading, error, reload } = useMonthlyPerformanceData(
    cycleId,
    activeDeptId || undefined,
  );

  // 입력 폼(hr_admin) — upsert.
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
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  const trend = useMemo(
    () =>
      (summary?.monthlyTrend ?? []).map((p: MonthlyTrendPoint) => ({
        month: `${p.month}월`,
        achievementRate: p.achievementRate,
      })),
    [summary],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* 부서 선택 */}
      {depts.length > 0 && (
        <div style={{ width: 240 }}>
          <Select
            label="부서"
            hideLabel
            value={activeDeptId}
            options={depts.map((d) => ({ value: d.id, label: d.name }))}
            onChange={setDepartmentId}
          />
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
          {/* KPI 요약 카드 4장 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MonthCard
              label="누적 목표"
              value={fmtAmount(summary.targetAmount)}
              accent={K.onSurface}
            />
            <MonthCard
              label="누적 실적"
              value={fmtAmount(summary.actualAmount)}
              accent={K.secondary}
            />
            <MonthCard
              label="누적 달성률"
              value={fmtPercent(summary.achievementRate)}
              accent={summary.achievementRate >= 100 ? K.tertiary : '#f59e0b'}
            />
            <MonthCard
              label="현재 등급"
              value={summary.currentGrade ?? '—'}
              accent={
                summary.currentGrade
                  ? gradeColor(summary.currentGrade).fg
                  : K.outlineVariant
              }
            />
          </div>

          {/* 월별 추이 차트 */}
          <div
            className="bg-white p-5 rounded-xl"
            style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: K.onSurface, marginBottom: 16 }}>
              월별 달성률 추이 (%)
            </h3>
            {trend.length === 0 ? (
              <EmptyState title="월별 추이 데이터가 없어요." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(204,204,212,0.3)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: K.onSurfaceVariant }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: K.onSurfaceVariant }}
                    axisLine={false}
                    tickLine={false}
                    unit="%"
                  />
                  <Tooltip
                    formatter={(v) => [`${v}%`, '달성률']}
                    contentStyle={{
                      fontSize: 12,
                      border: '1px solid rgba(204,204,212,0.5)',
                      borderRadius: 8,
                      boxShadow: CARD_SHADOW,
                    }}
                  />
                  <ReferenceLine y={100} stroke={K.outlineVariant} strokeDasharray="5 5" />
                  <Line
                    type="monotone"
                    dataKey="achievementRate"
                    name="달성률"
                    stroke={K.secondary}
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: K.secondary }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 카테고리별 표 */}
          <div
            className="bg-white rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}
          >
            <div
              className="px-5 py-3.5"
              style={{
                background: K.surfaceLow,
                borderBottom: `1px solid rgba(204,204,212,0.4)`,
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 700, color: K.onSurface }}>
                카테고리별 누적 실적
              </h3>
            </div>
            {/* 헤더 행 */}
            <div
              className="grid px-5 py-2.5"
              style={{
                gridTemplateColumns: '1fr 1fr 1fr 90px 60px',
                background: K.surfaceLow,
                borderBottom: `1px solid rgba(204,204,212,0.3)`,
              }}
            >
              {['카테고리', '목표', '실적', '달성률', '등급'].map((h, i) => (
                <div
                  key={h}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: K.onSurfaceVariant,
                    textAlign: i === 0 ? 'left' : 'right',
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
            {summary.byCategory.length === 0 ? (
              <div className="p-5">
                <EmptyState title="카테고리 데이터가 없어요." />
              </div>
            ) : (
              summary.byCategory.map((c: MonthlyPerformanceSummaryCategory) => (
                <div
                  key={c.category}
                  className="grid items-center px-5 py-3"
                  style={{
                    gridTemplateColumns: '1fr 1fr 1fr 90px 60px',
                    borderBottom: `1px solid rgba(204,204,212,0.2)`,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: K.onSurface }}>
                    {kpiCategoryLabel[c.category]}
                  </div>
                  <div className="tabular-nums" style={{ fontSize: 12.5, color: K.onSurfaceVariant, textAlign: 'right' }}>
                    {fmtAmount(c.targetAmount)}
                  </div>
                  <div className="tabular-nums" style={{ fontSize: 12.5, color: K.onSurfaceVariant, textAlign: 'right' }}>
                    {fmtAmount(c.actualAmount)}
                  </div>
                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      textAlign: 'right',
                      color:
                        c.achievementRate >= 100
                          ? K.tertiary
                          : c.achievementRate >= 90
                            ? K.secondary
                            : '#f59e0b',
                    }}
                  >
                    {fmtPercent(c.achievementRate)}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {c.currentGrade ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: gradeColor(c.currentGrade).fg,
                          background: gradeColor(c.currentGrade).bg,
                          padding: '3px 10px',
                          borderRadius: 999,
                        }}
                      >
                        {c.currentGrade}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: K.outlineVariant }}>—</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* 실적 입력(hr_admin) */}
      {editable && activeDeptId && cycleId && (
        <div
          className="bg-white rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(204,204,212,0.5)', boxShadow: CARD_SHADOW }}
        >
          <div
            className="px-5 py-3.5"
            style={{
              background: K.surfaceLow,
              borderBottom: `1px solid rgba(204,204,212,0.4)`,
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: K.onSurface }}>
              월별 실적 입력
            </h3>
            <p style={{ fontSize: 12, color: K.onSurfaceVariant, marginTop: 2 }}>
              월·카테고리·목표·실적을 입력하면 달성률·등급은 자동 산정돼요.
            </p>
          </div>
          <div className="p-5 flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <TextField
                label="월"
                type="number"
                value={month}
                onChange={setMonth}
                suffix="월"
              />
              <Select
                label="카테고리"
                value={category}
                options={(Object.keys(kpiCategoryLabel) as KpiCategory[]).map(
                  (k) => ({ value: k, label: kpiCategoryLabel[k] }),
                )}
                onChange={(v) => setCategory(v as KpiCategory)}
              />
              <TextField
                label="목표"
                type="number"
                value={target}
                onChange={setTarget}
              />
              <TextField
                label="실적"
                type="number"
                value={actual}
                onChange={setActual}
              />
            </div>
            <div className="flex items-center justify-end">
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => void save()}
              >
                실적 저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MonthCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="bg-white px-5 py-4 rounded-xl"
      style={{
        border: '1px solid rgba(204,204,212,0.5)',
        borderLeft: `4px solid ${accent}`,
        boxShadow: CARD_SHADOW,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 500, color: K.onSurfaceVariant }}>{label}</div>
      <div className="tabular-nums" style={{ fontSize: 26, fontWeight: 800, color: accent, marginTop: 4, lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}
