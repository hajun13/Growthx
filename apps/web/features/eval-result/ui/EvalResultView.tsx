'use client';

// 평가결과 목록(검토자 전용) — 등급 분포 + 등급별 인원 차트 + 필터 + 결과 테이블.
// 데이터: @growthx/contracts resultsControllerList (GET /results). 임직원은 본인 상세로 리다이렉트.
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { canReview } from '@/lib/nav';
import { fmtScore, fmtPercent } from '@/lib/ui';
import { gradeColor } from '@/lib/grade';
import type { Grade } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { useResultsData } from '../hooks';

// ── Kinetic Enterprise 팔레트 ───────────────────────────────────
const K = {
  primary: '#3f2c80',
  primaryContainer: '#564599',
  secondary: '#0054ca',
  tertiary: '#0e9aa0',
  surface: '#f8f9fd',
  surfaceLow: '#f2f3f7',
  white: '#ffffff',
  onSurface: '#191c1f',
  onSurfaceVariant: '#484551',
  outline: '#cac4d2',
  outlineDim: 'rgba(202,196,210,0.5)',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

const GRADE_ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export function EvalResultView() {
  const router = useRouter();
  const { user } = useAuth();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const reviewer = !!user && canReview(user.role);

  // 임직원(열람 권한 없음)은 본인 상세로 리다이렉트(기존 진입점 동작 유지).
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

  const [gradeFilter, setGradeFilter] = useState<'전체' | Grade>('전체');
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

  const filtered = useMemo(
    () =>
      results
        .filter((r) => gradeFilter === '전체' || r.finalGrade === gradeFilter)
        .filter(
          (r) => deptFilter === '전체' || r.departmentName === deptFilter,
        )
        .sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1)),
    [results, gradeFilter, deptFilter],
  );

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

      {/* 상단: 등급 분포 + 차트 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: 16,
        }}
      >
        {/* 등급 분포 막대 */}
        <div
          className="bg-white"
          style={{ border: `1px solid ${K.outlineDim}`, borderRadius: 12, padding: 20, boxShadow: CARD_SHADOW }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: K.onSurface, marginBottom: 16 }}>
            등급 분포
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {distData.map((g) => {
              const gc = gradeColor(g.grade);
              return (
                <div key={g.grade}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: gc.fg,
                          background: gc.bg,
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {g.grade}
                      </span>
                      <span className="tabular-nums" style={{ fontSize: 12, color: K.onSurface, fontWeight: 600 }}>
                        {g.count}명
                      </span>
                    </div>
                    <span className="tabular-nums" style={{ fontSize: 11, color: K.onSurfaceVariant }}>
                      {g.pct}%
                    </span>
                  </div>
                  <div style={{ height: 7, background: K.surfaceLow, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${g.pct}%`, background: gc.fg, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 등급별 인원 차트 */}
        <div
          className="bg-white"
          style={{ border: `1px solid ${K.outlineDim}`, borderRadius: 12, padding: 20, boxShadow: CARD_SHADOW }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: K.onSurface, marginBottom: 16 }}>
            등급별 인원 현황
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={distData} margin={{ left: -10, right: 10, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={K.surfaceLow} vertical={false} />
              <XAxis
                dataKey="grade"
                tick={{ fontSize: 12, fill: K.onSurface, fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: K.onSurfaceVariant }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [`${v}명`]}
                contentStyle={{ fontSize: 12, border: `1px solid ${K.outline}`, borderRadius: 8 }}
              />
              <Bar dataKey="count" maxBarSize={44} radius={[4, 4, 0, 0]}>
                {distData.map((g, i) => (
                  <Cell key={i} fill={gradeColor(g.grade).fg} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 필터 툴스트립 */}
      <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
        <div className="flex items-center gap-1.5">
          {(['전체', ...GRADE_ORDER] as const).map((g) => {
            const active = gradeFilter === g;
            const accent = g === '전체' ? K.primary : gradeColor(g as Grade).fg;
            return (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                className="px-3 py-1.5 transition-all"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: active ? accent : K.white,
                  color: active ? '#fff' : K.onSurfaceVariant,
                  border: `1px solid ${active ? accent : K.outline}`,
                  borderRadius: 999,
                }}
              >
                {g}
              </button>
            );
          })}
        </div>
        <div style={{ width: 1, height: 20, background: K.outline }} />
        <div className="flex items-center gap-1.5" style={{ flexWrap: 'wrap' }}>
          {depts.map((d) => {
            const active = deptFilter === d;
            return (
              <button
                key={d}
                onClick={() => setDeptFilter(d)}
                className="px-3 py-1.5 transition-all"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: active ? K.primary : K.white,
                  color: active ? '#fff' : K.onSurfaceVariant,
                  border: `1px solid ${active ? K.primary : K.outline}`,
                  borderRadius: 999,
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 12, color: K.onSurfaceVariant, marginLeft: 'auto', fontWeight: 500 }}>
          {filtered.length}명
        </span>
      </div>

      {/* 결과 테이블 */}
      <div
        className="bg-white overflow-hidden"
        style={{ border: `1px solid ${K.outlineDim}`, borderRadius: 12, boxShadow: CARD_SHADOW }}
      >
        {/* 테이블 헤더 — sticky */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '36px 1fr 140px 80px 90px 80px',
            background: K.surfaceLow,
            padding: '10px 20px',
            borderBottom: `1px solid ${K.outlineDim}`,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          {['#', '대상자', '부서', '점수', 'percentile', '등급'].map((h, i) => (
            <div
              key={h}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: K.onSurfaceVariant,
                textAlign: i >= 3 ? 'right' : 'left',
                letterSpacing: '0.03em',
              }}
            >
              {h}
            </div>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 40 }}>
            <EmptyState
              title="표시할 결과가 없어요."
              description={gradeFilter !== '전체' || deptFilter !== '전체' ? '필터를 초기화하면 더 많은 결과를 볼 수 있어요.' : '아직 집계된 결과가 없어요.'}
              action={
                (gradeFilter !== '전체' || deptFilter !== '전체') ? (
                  <button
                    onClick={() => { setGradeFilter('전체'); setDeptFilter('전체'); }}
                    style={{
                      fontSize: 13, fontWeight: 600, padding: '8px 18px',
                      color: K.secondary, background: '#fff',
                      border: `1px solid ${K.secondary}`, borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    필터 초기화
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          filtered.map((r, ri) => {
            const name = r.userName ?? r.userId.slice(0, 8);
            const gc = r.finalGrade ? gradeColor(r.finalGrade) : null;
            return (
              <div
                key={r.id}
                className="cursor-pointer transition-colors"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr 140px 80px 90px 80px',
                  padding: '14px 20px',
                  borderBottom: ri < filtered.length - 1 ? `1px solid ${K.outlineDim}` : 'none',
                  borderLeft: '3px solid transparent',
                  alignItems: 'center',
                  transition: 'background .12s, border-left-color .12s',
                }}
                onClick={() => router.push(`/eval/result/${r.userId}?cycleId=${cycleId}`)}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = K.surfaceLow;
                  el.style.borderLeft = `3px solid ${K.primary}`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'transparent';
                  el.style.borderLeft = '3px solid transparent';
                }}
              >
                <div className="tabular-nums" style={{ fontSize: 11, color: K.onSurfaceVariant, fontWeight: 600 }}>
                  {ri + 1}
                </div>
                <div className="flex items-center gap-2.5">
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: K.primaryContainer,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {name[0]}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: K.onSurface }}>{name}</span>
                </div>
                <div style={{ fontSize: 12, color: K.onSurfaceVariant }}>{r.departmentName ?? '—'}</div>
                <div className="tabular-nums" style={{ fontSize: 14, fontWeight: 700, color: K.onSurface, textAlign: 'right' }}>
                  {fmtScore(r.finalScore)}
                </div>
                <div className="tabular-nums" style={{ fontSize: 12.5, color: K.onSurfaceVariant, textAlign: 'right' }}>
                  {fmtPercent(r.percentile)}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {gc ? (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: gc.fg,
                        background: gc.bg,
                        padding: '3px 12px',
                        borderRadius: 999,
                      }}
                    >
                      {r.finalGrade}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: K.onSurfaceVariant }}>미집계</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </PageContainer>
  );
}

// ── 로딩 스켈레톤 ─────────────────────────────────────────────
function EvalResultSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-52" />
      <div className="grid gap-4" style={{ gridTemplateColumns: '260px 1fr' }}>
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </PageContainer>
  );
}
