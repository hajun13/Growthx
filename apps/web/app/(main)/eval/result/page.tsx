'use client';

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
import { useResults } from '@/hooks/useResults';
import { ExportButton } from '@/components/ExportButton';
import { EmptyState, ErrorState, Spinner } from '@/components/States';
import { canReview } from '@/lib/nav';
import { fmtScore, fmtPercent } from '@/lib/ui';
import type { Grade, EvaluationResult } from '@/lib/types';
import { T } from '@/lib/toss';

const GRADE_ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const gradeCfg: Record<Grade, { color: string; bg: string }> = {
  S: { color: '#fff', bg: '#7C3AED' },
  A: { color: '#fff', bg: T.blue500 },
  B: { color: '#fff', bg: T.green500 },
  C: { color: '#fff', bg: T.orange500 },
  D: { color: '#fff', bg: T.red500 },
};

export default function EvalResultPage() {
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

  const { data, loading, error, reload } = useResults(
    { cycleId },
    { enabled: !!cycleId && reviewer },
  );
  const results: EvaluationResult[] = data?.data ?? [];

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

  if (!reviewer) return <Spinner />;
  if (cyclesLoading || loading) return <Spinner />;
  if (error) return <ErrorState onRetry={reload} />;
  if (!current)
    return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  return (
    <div style={{ padding: '4px 0' }}>
      <div
        className="flex items-start justify-between"
        style={{ marginBottom: 24 }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              color: T.grey500,
              fontWeight: 500,
              letterSpacing: '0.5px',
              marginBottom: 4,
            }}
          >
            {current.name}
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: T.grey900,
              letterSpacing: '-0.5px',
            }}
          >
            평가결과
          </h1>
        </div>
        {user?.role === 'hr_admin' && cycleId && (
          <ExportButton
            path={`/excel/export/distribution?cycleId=${cycleId}`}
            filename={`results-${cycleId}.xlsx`}
            label="내보내기"
          />
        )}
      </div>

      {/* 상단: 등급 분포 + 차트 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          className="bg-white"
          style={{ border: `1px solid ${T.grey200}`, padding: 20 }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: T.grey900,
              marginBottom: 16,
            }}
          >
            등급 분포
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {distData.map((g) => {
              const gc = gradeCfg[g.grade];
              return (
                <div key={g.grade}>
                  <div
                    className="flex items-center justify-between"
                    style={{ marginBottom: 4 }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: gc.bg,
                          width: 20,
                        }}
                      >
                        {g.grade}
                      </span>
                      <span style={{ fontSize: 11.5, color: T.grey600 }}>
                        {g.count}명
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: T.grey500 }}>
                      {g.pct}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: T.grey100,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${g.pct}%`,
                        background: gc.bg,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="bg-white"
          style={{ border: `1px solid ${T.grey200}`, padding: 20 }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: T.grey900,
              marginBottom: 16,
            }}
          >
            등급별 인원 현황
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={distData} margin={{ left: -10, right: 10, top: 4 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={T.grey100}
                vertical={false}
              />
              <XAxis
                dataKey="grade"
                tick={{ fontSize: 12, fill: T.grey700, fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: T.grey400 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [`${v}명`]}
                contentStyle={{
                  fontSize: 12,
                  border: `1px solid ${T.grey200}`,
                }}
              />
              <Bar dataKey="count" maxBarSize={48}>
                {distData.map((g, i) => (
                  <Cell key={i} fill={gradeCfg[g.grade].bg} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 필터 */}
      <div
        className="flex items-center gap-3"
        style={{ marginBottom: 14, flexWrap: 'wrap' }}
      >
        <div className="flex items-center gap-1">
          {(['전체', ...GRADE_ORDER] as const).map((g) => {
            const active = gradeFilter === g;
            const accent =
              g === '전체' ? T.grey900 : gradeCfg[g as Grade].bg;
            return (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                className="px-3 py-1.5 transition-all"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  background: active ? accent : '#fff',
                  color: active ? '#fff' : T.grey600,
                  border: `1px solid ${active ? accent : T.grey200}`,
                }}
              >
                {g}
              </button>
            );
          })}
        </div>
        <div style={{ width: 1, height: 20, background: T.grey200 }} />
        <div className="flex items-center gap-1" style={{ flexWrap: 'wrap' }}>
          {depts.map((d) => {
            const active = deptFilter === d;
            return (
              <button
                key={d}
                onClick={() => setDeptFilter(d)}
                className="px-3 py-1.5 transition-all"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  background: active ? T.grey900 : '#fff',
                  color: active ? '#fff' : T.grey600,
                  border: `1px solid ${active ? T.grey900 : T.grey200}`,
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
        <span
          style={{ fontSize: 12, color: T.grey500, marginLeft: 'auto' }}
        >
          {filtered.length}명
        </span>
      </div>

      {/* 결과 테이블 */}
      <div
        className="bg-white overflow-hidden"
        style={{ border: `1px solid ${T.grey200}` }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '36px 1fr 140px 80px 90px 80px',
            background: T.grey50,
            padding: '10px 20px',
            borderBottom: `1px solid ${T.grey200}`,
          }}
        >
          {['#', '대상자', '부서', '점수', 'percentile', '등급'].map((h, i) => (
            <div
              key={h}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: T.grey500,
                textAlign: i >= 3 ? 'right' : 'left',
              }}
            >
              {h}
            </div>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 40 }}>
            <EmptyState title="표시할 결과가 없어요." />
          </div>
        ) : (
          filtered.map((r, ri) => {
            const name = r.userName ?? r.userId.slice(0, 8);
            const gc = r.finalGrade ? gradeCfg[r.finalGrade] : null;
            return (
              <div
                key={r.id}
                className="transition-colors cursor-pointer"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr 140px 80px 90px 80px',
                  padding: '13px 20px',
                  borderBottom:
                    ri < filtered.length - 1
                      ? `1px solid ${T.grey50}`
                      : 'none',
                  alignItems: 'center',
                }}
                onClick={() =>
                  router.push(
                    `/eval/result/${r.userId}?cycleId=${cycleId}`,
                  )
                }
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    T.grey50)
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    'transparent')
                }
              >
                <div
                  style={{ fontSize: 11, color: T.grey400, fontWeight: 600 }}
                >
                  {ri + 1}
                </div>
                <div className="flex items-center gap-2.5">
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      background: T.grey100,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      color: T.blue500,
                      flexShrink: 0,
                    }}
                  >
                    {name[0]}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.grey900,
                    }}
                  >
                    {name}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: T.grey600 }}>
                  {r.departmentName ?? '—'}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: T.grey900,
                    textAlign: 'right',
                  }}
                >
                  {fmtScore(r.finalScore)}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: T.grey700,
                    textAlign: 'right',
                  }}
                >
                  {fmtPercent(r.percentile)}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {gc ? (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: gc.color,
                        background: gc.bg,
                        padding: '3px 10px',
                      }}
                    >
                      {r.finalGrade}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: T.grey400 }}>
                      미집계
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
