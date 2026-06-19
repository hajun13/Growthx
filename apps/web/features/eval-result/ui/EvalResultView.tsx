'use client';

// 평가결과 목록(검토자 전용) — 등급 분포 + 등급별 인원 차트 + 필터 + 결과 테이블.
// 데이터: @growthx/contracts resultsControllerList (GET /results). 임직원은 본인 상세로 리다이렉트.
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { ExportButton } from '@/components/ExportButton';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { GradeChip } from '@/components/GradeChip';
import { FilterChipBar } from '@/components/FilterChipBar';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { canReview } from '@/lib/nav';
import { fmtScore } from '@/lib/ui';
import { gradeColor } from '@/lib/grade';
import type { Grade } from '@/lib/types';
import { useResultsData } from '../hooks';

const GRADE_ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];

function ResultSummaryBand({
  total,
  finalized,
  topGrade,
  average,
}: {
  total: number;
  finalized: number;
  topGrade: Grade | null;
  average: number | null;
}) {
  const pending = Math.max(total - finalized, 0);
  const items = [
    { label: '대상자', value: `${total}명`, sub: '평가 결과 목록' },
    { label: '집계 완료', value: `${finalized}명`, sub: pending > 0 ? `${pending}명 확인 필요` : '전체 집계 완료', accent: pending > 0 ? 'text-warning-700' : 'text-success-700' },
    { label: '평균 점수', value: fmtScore(average), sub: '최종점수 기준', accent: 'text-primary' },
    { label: '최다 등급', value: topGrade ?? '-', sub: topGrade ? '최근 분포 기준' : '집계 전', accent: topGrade ? 'text-foreground' : 'text-muted-foreground' },
  ];

  return (
    <section className="gx-panel grid gap-0 overflow-hidden md:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <div key={item.label} className="flex min-h-[96px] items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-muted-foreground">{item.label}</p>
            <p className={`mt-1 truncate text-[22px] font-extrabold tabular-nums ${item.accent ?? 'text-foreground'}`}>
              {item.value}
            </p>
            <p className="mt-1 text-[12px] font-medium text-muted-foreground">{item.sub}</p>
          </div>
          {index < items.length - 1 && <div className="hidden h-12 w-px bg-border xl:block" />}
        </div>
      ))}
    </section>
  );
}

export function EvalResultView() {
  const router = useRouter();
  const { user } = useAuth();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const reviewer = !!user && canReview(user.role);

  useEffect(() => {
    if (cyclesLoading || !user || reviewer) return;
    const q = cycleId ? `?cycleId=${cycleId}` : '';
    router.replace(`/eval/result/${user.id}${q}`);
  }, [cyclesLoading, user, reviewer, cycleId, router]);

  const { items, loading, error, reload } = useResultsData(
    { cycleId },
    !!cycleId && reviewer,
  );
  const results = items;

  const [gradeFilter, setGradeFilter] = useState<string>('전체');
  const [deptFilter, setDeptFilter] = useState('전체');

  const depts = useMemo(
    () => [
      '전체',
      ...Array.from(
        new Set(results.map((r) => r.departmentName).filter(Boolean) as string[]),
      ),
    ],
    [results],
  );

  const distData = useMemo(() => {
    const counts: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of results) if (r.finalGrade) counts[r.finalGrade] += 1;
    const total = results.filter((r) => r.finalGrade).length || 1;
    return GRADE_ORDER.map((g) => ({
      grade: g,
      count: counts[g],
      pct: Math.round((counts[g] / total) * 100),
    }));
  }, [results]);

  const resultSummary = useMemo(() => {
    const finalized = results.filter((r) => r.finalGrade).length;
    const scored = results.filter((r) => r.finalScore !== null);
    const average = scored.length
      ? scored.reduce((sum, r) => sum + (r.finalScore ?? 0), 0) / scored.length
      : null;
    const top = distData.reduce((best, item) => (item.count > best.count ? item : best), distData[0]);
    return {
      finalized,
      pending: Math.max(results.length - finalized, 0),
      average,
      topGrade: top && top.count > 0 ? top.grade : null,
    };
  }, [distData, results]);

  const filtered = useMemo(
    () =>
      results
        .filter((r) => gradeFilter === '전체' || r.finalGrade === gradeFilter)
        .filter((r) => deptFilter === '전체' || r.departmentName === deptFilter)
        .sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1)),
    [results, gradeFilter, deptFilter],
  );

  // 필터 옵션
  const gradeFilterOptions = [
    { value: '전체', label: '전체' },
    ...GRADE_ORDER.map((g) => ({ value: g, label: g })),
  ];
  const deptFilterOptions = depts.map((d) => ({ value: d, label: d }));

  if (!reviewer) return <EvalResultSkeleton />;
  if (cyclesLoading || (loading && !results.length)) return <EvalResultSkeleton />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current)
    return (
      <PageContainer>
        <EmptyState
          title="진행 중인 평가 주기가 없어요."
          description="HR 관리자에게 문의하거나 평가 주기 설정을 확인하세요."
        />
      </PageContainer>
    );

  return (
    <PageContainer>
      <PageHeader
        title="평가결과"
        subtitle={current.name}
        right={
          user?.role === 'hr_admin' && cycleId ? (
            <ExportButton
              path={`/excel/export/distribution?cycleId=${cycleId}`}
              filename={`results-${cycleId}.xlsx`}
              label="내보내기"
            />
          ) : undefined
        }
      />

      <ResultSummaryBand
        total={results.length}
        finalized={resultSummary.finalized}
        topGrade={resultSummary.topGrade}
        average={resultSummary.average}
      />

      {resultSummary.pending > 0 && (
        <section className="gx-panel flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-50 text-warning-700">
              <AlertTriangle size={18} aria-hidden />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-foreground">확인 필요 결과가 있어요</h2>
              <p className="text-[12.5px] text-muted-foreground">
                최종 등급이 아직 없는 대상자 {resultSummary.pending}명을 먼저 확인하세요.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => { setGradeFilter('전체'); setDeptFilter('전체'); }}>
            전체 목록 보기
          </Button>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section className="gx-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-foreground">등급 분포</h2>
            <span className="text-[12px] font-medium text-muted-foreground">{resultSummary.finalized}명 집계</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {distData.map((g) => {
              const gc = gradeColor(g.grade);
              return (
                <div key={g.grade}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <GradeChip grade={g.grade} />
                      <span className="tabular-nums text-[12px] text-foreground font-semibold">
                        {g.count}명
                      </span>
                    </div>
                    <span className="tabular-nums text-[11px] text-muted-foreground">
                      {g.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-lg bg-muted">
                    <div
                      className="h-full rounded-lg"
                      style={{ width: `${g.pct}%`, background: gc.fg }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="gx-panel p-5">
          <h2 className="mb-4 text-[15px] font-bold text-foreground">등급별 인원 현황</h2>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={distData} margin={{ left: -10, right: 10, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#efeff2" vertical={false} />
              <XAxis
                dataKey="grade"
                tick={{ fontSize: 12, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [`${v}명`]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="count" maxBarSize={44} radius={[4, 4, 0, 0]}>
                {distData.map((g, i) => (
                  <Cell key={i} fill={gradeColor(g.grade).fg} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      {/* 필터 툴스트립 */}
      <div className="flex items-center gap-4 flex-wrap">
        <FilterChipBar
          options={gradeFilterOptions}
          value={gradeFilter}
          onChange={setGradeFilter}
        />
        <div className="w-px h-5 bg-border" aria-hidden />
        <FilterChipBar
          options={deptFilterOptions}
          value={deptFilter}
          onChange={setDeptFilter}
        />
        <span className="text-[12px] text-muted-foreground ml-auto font-medium">
          {filtered.length}명
        </span>
      </div>

      {/* 결과 테이블 */}
      <Card padding="sm">
        {/* sticky 헤더 */}
        <div
          className="grid px-5 py-2.5 sticky top-0 z-10 bg-muted border-b border-border rounded-t-lg"
          style={{ gridTemplateColumns: '36px 1fr 140px 80px 80px' }}
        >
          {['#', '대상자', '부서', '점수', '등급'].map((h, i) => (
            <div
              key={h}
              className="text-[11px] font-semibold text-muted-foreground tracking-wide"
              style={{ textAlign: i >= 3 ? 'right' : 'left' }}
            >
              {h}
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="p-10">
            <EmptyState
              title="표시할 결과가 없어요."
              description={
                gradeFilter !== '전체' || deptFilter !== '전체'
                  ? '필터를 초기화하면 더 많은 결과를 볼 수 있어요.'
                  : '아직 집계된 결과가 없어요.'
              }
              action={
                gradeFilter !== '전체' || deptFilter !== '전체' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setGradeFilter('전체'); setDeptFilter('전체'); }}
                  >
                    필터 초기화
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          filtered.map((r, ri) => {
            const name = r.userName ?? r.userId.slice(0, 8);
            return (
              <div
                key={r.id}
                className="grid cursor-pointer items-center border-b border-border/40 px-5 py-3.5 transition-colors hover:bg-accent last:border-b-0"
                style={{ gridTemplateColumns: '36px 1fr 140px 80px 80px' }}
                onClick={() => router.push(`/eval/result/${r.userId}?cycleId=${cycleId}`)}
              >
                <div className="tabular-nums text-[11px] text-muted-foreground font-semibold">
                  {ri + 1}
                </div>
                <div className="flex items-center gap-2.5">
                  <div
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-[13px] font-bold"
                  >
                    {name[0]}
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">{name}</span>
                </div>
                <div className="text-[12px] text-muted-foreground">{r.departmentName ?? '—'}</div>
                <div className="tabular-nums text-[14px] font-bold text-foreground text-right">
                  {fmtScore(r.finalScore)}
                </div>
                <div className="text-right">
                  {r.finalGrade ? (
                    <GradeChip grade={r.finalGrade} />
                  ) : (
                    <span className="text-[12px] text-muted-foreground">미집계</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Card>
    </PageContainer>
  );
}

// ── 로딩 스켈레톤 ─────────────────────────────────────────────
function EvalResultSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-52" />
      <div className="grid gap-4" style={{ gridTemplateColumns: '260px 1fr' }}>
        <Skeleton className="h-56 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </PageContainer>
  );
}
