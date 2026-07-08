'use client';

// 분포 모니터링 탭 본체 — image 14 재현: 상단 등급 카드 + 필터 + 전사분포 + 부서별분포 + 결과리스트 + 안내문.
import { useMemo, useState } from 'react';
import { usePositions } from '@/hooks/usePositions';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { Card } from '@/components/Card';
import { getPositionLabel } from '@/lib/ui';
import type { CycleStatus, Grade, EvaluationResult } from '@/lib/types';
import { useResultsSummaryData } from '../hooks';
import { DistGradeCards } from './DistGradeCards';
import { DistCompanyBar } from './DistCompanyBar';
import { DistDeptBars, type DeptDistEntry } from './DistDeptBars';
import { DistResultList } from './DistResultList';
import { DistFilters, DIST_FILTER_DEFAULT, type DistFilterState } from './DistFilters';
import { DistFootnote } from './DistFootnote';

export function DistMonitorTab({
  cycleId,
  cycleStatus,
  ruleSetId,
  results,
  loading,
  error,
  reload,
}: {
  cycleId?: string;
  // 결과 공개 게이트 — closed 전이면 잠정값 표기(hr_admin 은 백엔드 게이트 면제 → 표기로 방어).
  cycleStatus?: CycleStatus;
  ruleSetId?: string | null;
  results: EvaluationResult[];
  loading: boolean;
  error: unknown;
  reload: () => void;
}) {
  // 그룹/본부/팀/직급 캐스케이드 필터는 EvaluationResultDto(departmentName 단일 문자열)로는 불가해
  // resultsControllerSummary(SummaryRowDto — group/division/team/position 분리 필드)를 함께 소비한다.
  const { rows: summaryRows, loading: summaryLoading } = useResultsSummaryData(cycleId);
  const { data: positionsData } = usePositions({ includeInactive: true });
  const positions = useMemo(() => positionsData?.data ?? [], [positionsData]);

  const [filters, setFilters] = useState<DistFilterState>(DIST_FILTER_DEFAULT);

  const counts = useMemo(() => {
    const c: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of results) if (r.finalGrade) c[r.finalGrade] += 1;
    return c;
  }, [results]);

  const finalizedCount = results.filter((r) => r.finalGrade !== null).length;

  // 부서별 등급 분포(백엔드 등급의 표시용 집계 — 점수 재계산 아님).
  const deptDist = useMemo<DeptDistEntry[]>(() => {
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

  const groupOptions = useMemo(
    () => Array.from(new Set(summaryRows.map((r) => r.group).filter((g): g is string => !!g))),
    [summaryRows],
  );
  const divisionOptions = useMemo(
    () => Array.from(new Set(summaryRows.filter((r) => filters.group === DIST_FILTER_DEFAULT.group || r.group === filters.group).map((r) => r.division).filter((g): g is string => !!g))),
    [summaryRows, filters.group],
  );
  const teamOptions = useMemo(
    () => Array.from(new Set(summaryRows.filter((r) => filters.division === DIST_FILTER_DEFAULT.division || r.division === filters.division).map((r) => r.team).filter((g): g is string => !!g))),
    [summaryRows, filters.division],
  );
  const positionOptions = useMemo(
    () => Array.from(new Set(summaryRows.map((r) => r.position).filter((g): g is string => !!g))),
    [summaryRows],
  );

  // 필터 조건에 맞는 userId 집합(SummaryRowDto 기준) — EvaluationResult 목록을 이 집합으로 좁힌다.
  const allowedUserIds = useMemo(() => {
    if (summaryLoading) return null;
    const s = filters;
    const isDefault =
      s.group === DIST_FILTER_DEFAULT.group &&
      s.division === DIST_FILTER_DEFAULT.division &&
      s.team === DIST_FILTER_DEFAULT.team &&
      s.position === DIST_FILTER_DEFAULT.position &&
      s.grade === DIST_FILTER_DEFAULT.grade;
    if (isDefault) return null;
    const set = new Set<string>();
    for (const r of summaryRows) {
      if (s.group !== DIST_FILTER_DEFAULT.group && r.group !== s.group) continue;
      if (s.division !== DIST_FILTER_DEFAULT.division && r.division !== s.division) continue;
      if (s.team !== DIST_FILTER_DEFAULT.team && r.team !== s.team) continue;
      if (s.position !== DIST_FILTER_DEFAULT.position && r.position !== s.position) continue;
      if (s.grade !== DIST_FILTER_DEFAULT.grade && r.finalGrade !== s.grade) continue;
      set.add(r.userId);
    }
    return set;
  }, [summaryRows, filters, summaryLoading]);

  const filteredResults = useMemo(() => {
    let base = allowedUserIds ? results.filter((r) => allowedUserIds.has(r.userId)) : results;
    // 이름 검색 — 결과 리스트에만 적용(분포 집계는 조직 필터 기준 유지).
    const q = filters.search.trim();
    if (q) base = base.filter((r) => (r.userName ?? '').includes(q));
    return [...base].sort((a, b) => {
      if (filters.sort === 'name') return (a.userName ?? '').localeCompare(b.userName ?? '');
      return (b.finalScore ?? -1) - (a.finalScore ?? -1);
    });
  }, [results, allowedUserIds, filters.search, filters.sort]);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorState onRetry={reload} />;

  const isClosed = cycleStatus === 'closed';
  return (
    // 뷰포트 높이를 채워 하단 공백 제거 — 분포/결과 카드가 남는 세로 공간을 차지한다.
    <div className="flex min-h-[calc(100vh-250px)] flex-col gap-5">
      <DistGradeCards counts={counts} total={finalizedCount} />

      <DistFilters
        state={filters}
        onChange={(patch) => setFilters((p) => ({ ...p, ...patch }))}
        groupOptions={groupOptions}
        divisionOptions={divisionOptions}
        teamOptions={teamOptions}
        positionOptions={positionOptions.map((p) => ({ value: p, label: getPositionLabel(p, positions) }))}
      />

      {/* 전사 등급 분포 막대 */}
      <Card title={isClosed ? '전사 등급 분포' : '전사 등급 분포 (잠정)'}>
        {finalizedCount === 0 ? <EmptyState title="집계된 결과가 없어요." /> : <DistCompanyBar counts={counts} total={finalizedCount} />}
      </Card>

      {/* 부서별 분포(좌) + 결과 테이블(우) — flex-1로 남는 세로 공간을 채워 카드를 키운다 */}
      <div className="grid flex-1 gap-5 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
        <Card title="부서별 등급 분포">
          <DistDeptBars deptDist={deptDist} />
        </Card>

        <Card title="결과 (최종점수 순)" padding="sm">
          <DistResultList results={filteredResults} cycleId={cycleId} positions={positions} />
        </Card>
      </div>

      <DistFootnote ruleSetId={ruleSetId} provisional={!isClosed} />

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
