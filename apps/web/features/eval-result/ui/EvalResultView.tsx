'use client';

// 평가결과 목록(검토자 전용) — 등급 분포 + 등급별 인원 차트 + 필터 + 결과 테이블.
// 데이터: @growthx/contracts resultsControllerList (GET /results). 임직원은 본인 상세로 리다이렉트.
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useOrgChart } from '@/hooks/useOrgChart';
import { flattenOrg, descendantDeptIds } from '@/lib/org';
import { OrgCascadeFilter, type OrgCascadeValue } from '@/components/OrgCascadeFilter';
import { ExportButton } from '@/components/ExportButton';
import { Button } from '@/components/ui/button';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { GradeChip } from '@/components/GradeChip';
import { Avatar } from '@/components/Avatar';
import { DesignLabel } from '@/components/DesignLabel';
import { FilterChipBar } from '@/components/FilterChipBar';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { canReview } from '@/lib/nav';
import { fmtScore, getPositionLabel } from '@/lib/ui';
import type { Grade, EvaluationResult } from '@/lib/types';
import { useResultsData } from '../hooks';
import { EmptyBox, ErrorBox } from './StateViews';
import { TitledCard } from './TitledCard';

const GRADE_ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];
// 등급 색 = 테마 등급 Solid 토큰 단일 소스 — 막대는 정적 클래스, 차트 SVG 는 CSS 변수.
const GRADE_BG: Record<Grade, string> = {
  S: 'bg-grade-s',
  A: 'bg-grade-a',
  B: 'bg-grade-b',
  C: 'bg-grade-c',
  D: 'bg-grade-d',
};
const GRADE_FILL: Record<Grade, string> = {
  S: 'var(--color-grade-s)',
  A: 'var(--color-grade-a)',
  B: 'var(--color-grade-b)',
  C: 'var(--color-grade-c)',
  D: 'var(--color-grade-d)',
};
const DIST_CHART_CONFIG: ChartConfig = { count: { label: '인원' } };

export function EvalResultView() {
  const router = useRouter();
  const { user } = useAuth();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;

  const reviewer = !!user && canReview(user.role);

  // 결과 공개 게이트 — closed 전이면 잠정값(hr_admin 은 백엔드 게이트 면제 → 프론트 표기로 방어).
  const isClosed = current?.status === 'closed';

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

  // 결과 표 열 — 행 클릭=상세 이동(DataTable 이 role=button·Enter/Space 처리).
  const columns: DataTableColumn<EvaluationResult>[] = [
    {
      key: 'rank',
      header: '#',
      className: 'w-9 tabular-nums text-11 font-semibold text-muted-foreground',
      render: (r) => filtered.indexOf(r) + 1,
    },
    {
      key: 'name',
      header: '대상자',
      render: (r) => {
        const name = r.userName ?? r.userId.slice(0, 8);
        return (
          <div className="flex items-center gap-2.5">
            <Avatar name={name} size="sm" />
            <span className="text-13 font-semibold text-foreground">{name}</span>
          </div>
        );
      },
    },
    { key: 'dept', header: '부서', className: 'text-12 text-muted-foreground', render: (r) => r.departmentName ?? '—' },
    {
      key: 'position',
      header: '직급',
      className: 'text-12 text-muted-foreground',
      render: (r) => (r.position ? getPositionLabel(r.position) : '—'),
    },
    {
      key: 'score',
      header: '평가 점수',
      className: 'tabular-nums text-14 font-bold text-primary',
      render: (r) => fmtScore(r.finalScore),
    },
    {
      key: 'grade',
      header: '등급',
      render: (r) =>
        r.finalGrade ? <GradeChip grade={r.finalGrade} /> : <span className="text-12 text-muted-foreground">미집계</span>,
    },
    {
      key: 'status',
      header: '평가 상태',
      // 평가 상태(image 10) — 백엔드 파생 status(not_started/in_progress/finalized).
      // closed 전에는 "완료" 대신 잠정 표기(확정 오해 방지). 배지는 공용 DesignLabel tone 수렴.
      render: (r) =>
        r.status === 'finalized' ? (
          isClosed ? (
            <DesignLabel tone="green">평가 완료</DesignLabel>
          ) : (
            <DesignLabel tone="blue">잠정 집계</DesignLabel>
          )
        ) : r.status === 'in_progress' ? (
          <DesignLabel tone="blue">진행중</DesignLabel>
        ) : (
          <DesignLabel tone="gray">미평가</DesignLabel>
        ),
    },
    {
      key: 'detail',
      header: '',
      align: 'right',
      className: 'w-22',
      render: () => (
        <span className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1 text-11h font-semibold text-muted-foreground">
          상세보기
        </span>
      ),
    },
  ];

  if (!reviewer) return <EvalResultSkeleton />;
  if (cyclesLoading || (loading && !results.length)) return <EvalResultSkeleton />;
  if (error) return <ErrorBox onRetry={reload} />;
  if (!current)
    return (
      <PageContainer>
        <EmptyBox
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
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* 등급 분포 막대 */}
        <TitledCard title="등급 분포" className="lg:w-65 lg:shrink-0">
          <div className="flex flex-col gap-2.5">
            {distData.map((g) => {
              return (
                <div key={g.grade}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <GradeChip grade={g.grade} />
                      <span className="tabular-nums text-12 text-foreground font-semibold">
                        {g.count}명
                      </span>
                    </div>
                    <span className="tabular-nums text-11 text-muted-foreground">
                      {g.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full w-(--w) rounded-full ${GRADE_BG[g.grade]}`}
                      style={{ '--w': `${g.pct}%` } as React.CSSProperties}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </TitledCard>

        {/* 등급별 인원 차트 */}
        <TitledCard title="등급별 인원 현황" className="min-w-0 lg:flex-1">
          <ChartContainer config={DIST_CHART_CONFIG} className="aspect-auto h-35 w-full">
            <BarChart data={distData} margin={{ left: -10, right: 10, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
                  <Cell key={i} fill={GRADE_FILL[g.grade]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </TitledCard>
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
        <span className="ml-auto inline-flex h-8 items-center rounded-full bg-muted px-3 text-12 font-semibold text-muted-foreground">
          {filtered.length}명
        </span>
      </div>

      {/* 결과 테이블 */}
      <DataTable
        stickyHeader
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/eval/result/${r.userId}?cycleId=${cycleId}`)}
        empty={
          <div className="p-10">
            <EmptyBox
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
        }
      />
    </PageContainer>
  );
}

// ── 로딩 스켈레톤 ─────────────────────────────────────────────
function EvalResultSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-10 w-52" />
      <div className="flex flex-col gap-4 lg:flex-row">
        <Skeleton className="h-56 w-full rounded-lg lg:w-65 lg:shrink-0" />
        <Skeleton className="h-56 w-full rounded-lg lg:flex-1" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </PageContainer>
  );
}
