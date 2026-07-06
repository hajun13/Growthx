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
import { useOrgChart } from '@/hooks/useOrgChart';
import { flattenOrg, descendantDeptIds } from '@/lib/org';
import { OrgCascadeFilter, type OrgCascadeValue } from '@/components/OrgCascadeFilter';
import { ExportButton } from '@/components/ExportButton';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { GradeChip } from '@/components/GradeChip';
import { Avatar } from '@/components/Avatar';
import { FilterChipBar } from '@/components/FilterChipBar';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { canReview } from '@/lib/nav';
import { fmtScore, getPositionLabel } from '@/lib/ui';
import { gradeChipColor } from '@/lib/palette';
import type { Grade, EvaluationResult } from '@/lib/types';
import { useResultsData } from '../hooks';

const GRADE_ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];
// 등급 색 = 공용 gradeChipColor(브리프 §2 Solid 세트) 단일 소스 — 하드코딩 그레이스케일 폐기.
const GRADE_TONE: Record<Grade, string> = {
  S: gradeChipColor.S.bg,
  A: gradeChipColor.A.bg,
  B: gradeChipColor.B.bg,
  C: gradeChipColor.C.bg,
  D: gradeChipColor.D.bg,
};
// 결과 테이블 열 — 전 컬럼 비율 분배(여백이 한 곳에 몰리지 않게 균등).
const RESULT_GRID_COLUMNS =
  '36px 1.4fr 1fr 0.7fr 0.8fr 0.6fr 0.8fr 88px';

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
  // 생성 DTO에는 3B-1 확장 필드(position·status)가 아직 없다(codegen 미발행) —
  // 백엔드는 이미 내려주므로 도메인 타입(lib/types.EvaluationResult)으로 한 번 좁힌다(런타임 동일).
  const results = items as unknown as EvaluationResult[];

  const [gradeFilter, setGradeFilter] = useState<string>('전체');
  // 조직 필터 — 권한 관리와 동일한 그룹→본부→팀 캐스케이드 드롭다운.
  const [orgFilter, setOrgFilter] = useState<OrgCascadeValue>({ groupId: '', divisionId: '', teamId: '' });
  const { data: chart } = useOrgChart({ enabled: reviewer });
  const flat = useMemo(() => flattenOrg(chart), [chart]);
  const hasOrgFilter = !!(orgFilter.groupId || orgFilter.divisionId || orgFilter.teamId);

  // 결과 DTO 에는 departmentId 가 없어(B-3c 비정규화 name 만) 선택 하위 조직의 "부서명 집합"으로 매칭.
  const orgDeptNames = useMemo(() => {
    const nodeId = orgFilter.teamId || orgFilter.divisionId || orgFilter.groupId || null;
    const ids = descendantDeptIds(chart ?? null, nodeId);
    if (!ids) return null;
    const names = new Set<string>();
    ids.forEach((id) => {
      const n = flat.get(id);
      if (n) names.add(n.name);
    });
    return names;
  }, [chart, flat, orgFilter]);

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
        .filter((r) => !orgDeptNames || (!!r.departmentName && orgDeptNames.has(r.departmentName)))
        .sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1)),
    [results, gradeFilter, orgDeptNames],
  );

  // 필터 옵션
  const gradeFilterOptions = [
    { value: '전체', label: '전체' },
    ...GRADE_ORDER.map((g) => ({ value: g, label: g })),
  ];

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
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* 등급 분포 막대 */}
        <Card title="등급 분포">
          <div className="flex flex-col gap-2.5">
            {distData.map((g) => {
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
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${g.pct}%`, background: GRADE_TONE[g.grade] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 등급별 인원 차트 */}
        <Card title="등급별 인원 현황">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={distData} margin={{ left: -10, right: 10, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
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
                  <Cell key={i} fill={GRADE_TONE[g.grade]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* 필터 툴스트립 */}
      <div className="gx-toolbar">
        <FilterChipBar
          options={gradeFilterOptions}
          value={gradeFilter}
          onChange={setGradeFilter}
        />
        <div className="w-px h-5 bg-border" aria-hidden />
        <OrgCascadeFilter flat={flat} value={orgFilter} onChange={setOrgFilter} compact />
        <span className="ml-auto inline-flex h-8 items-center rounded-full bg-muted px-3 text-[12px] font-semibold text-muted-foreground">
          {filtered.length}명
        </span>
      </div>

      {/* 결과 테이블 */}
      <Card padding="sm">
        {/* sticky 헤더 */}
        <div
          className="grid gap-x-3 px-5 py-2.5 sticky top-0 z-10 bg-muted border-b border-border"
          style={{ gridTemplateColumns: RESULT_GRID_COLUMNS }}
        >
          {['#', '대상자', '부서', '직급', '평가 점수', '등급', '평가 상태', ''].map((h, i) => (
            <div
              key={`${h}-${i}`}
              className="text-[11px] font-semibold text-muted-foreground tracking-wide"
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
                gradeFilter !== '전체' || hasOrgFilter
                  ? '필터를 초기화하면 더 많은 결과를 볼 수 있어요.'
                  : '아직 집계된 결과가 없어요.'
              }
              action={
                gradeFilter !== '전체' || hasOrgFilter ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setGradeFilter('전체'); setOrgFilter({ groupId: '', divisionId: '', teamId: '' }); }}
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
                className="grid gap-x-3 cursor-pointer items-center border-b border-border/40 px-5 py-3.5 transition-colors hover:bg-muted/60 last:border-b-0"
                style={{ gridTemplateColumns: RESULT_GRID_COLUMNS }}
                onClick={() => router.push(`/eval/result/${r.userId}?cycleId=${cycleId}`)}
              >
                <div className="tabular-nums text-[11px] text-muted-foreground font-semibold">
                  {ri + 1}
                </div>
                <div className="flex items-center gap-2.5">
                  <Avatar name={name} size="sm" />
                  <span className="text-[13px] font-semibold text-foreground">{name}</span>
                </div>
                <div className="text-[12px] text-muted-foreground">{r.departmentName ?? '—'}</div>
                <div className="text-[12px] text-muted-foreground">{r.position ? getPositionLabel(r.position) : '—'}</div>
                <div className="tabular-nums text-[14px] font-bold text-primary">
                  {fmtScore(r.finalScore)}
                </div>
                <div>
                  {r.finalGrade ? (
                    <GradeChip grade={r.finalGrade} />
                  ) : (
                    <span className="text-[12px] text-muted-foreground">미집계</span>
                  )}
                </div>
                <div>
                  {/* 평가 상태(image 10) — 백엔드 파생 status(not_started/in_progress/finalized) */}
                  {r.status === 'finalized' ? (
                    <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#E3F7EC', color: '#0B7A47' }}>평가 완료</span>
                  ) : r.status === 'in_progress' ? (
                    <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#EAF2FE', color: '#0257CE' }}>진행중</span>
                  ) : (
                    <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#F4F5FA', color: '#6B6980' }}>미평가</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground">
                    상세보기
                  </span>
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
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Skeleton className="h-56 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </PageContainer>
  );
}
