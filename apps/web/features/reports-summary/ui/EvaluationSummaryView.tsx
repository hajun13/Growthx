'use client';

// 평가 결과표 — image 12 재현: 상단 등급 카드 통계(분포 그래프 제거) + Avatar + 캐스케이드 필터
// + 최종점수 정렬 + 상세보기 확장(1차/2차/최종).
import { Fragment, Suspense, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCycleParam } from '@/hooks/useCycleParam';
import { usePositions } from '@/hooks/usePositions';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PersonAvatar } from '@/features/reports/ui/PersonAvatar';
import { ReportEmpty, ReportError } from '@/features/reports/ui/ReportStates';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { GradeChip } from '@/components/GradeChip';
import { ExportButton } from '@/components/ExportButton';
import { Button } from '@/components/ui/button';
import { getPositionLabel, fmtScore } from '@/lib/ui';
import { isHrAdmin } from '@/lib/nav';
import type { Grade } from '@/lib/types';
import { useEvaluationSummaryData } from '../hooks';
import { SummaryGradeStats } from './SummaryGradeStats';
import { SummaryFilters, SUMMARY_FILTER_DEFAULT, type SummaryFilterState } from './SummaryFilters';
import { SummaryRowExpand } from './SummaryRowExpand';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const ALL = '전체';

// 헤더 sticky·경계선(inset)은 L1 TableHead `sticky` variant 가 담당.
const thBase = 'text-11';
const tdBase = 'text-12h text-foreground whitespace-nowrap';

// 텍스트 헤더 목록 — 전체 컬럼 수(SummaryRowExpand colSpan)와 단일 원천 공유.
const TEXT_HEADERS = ['NO', '성명', '그룹', '본부', '팀', '직급', '평가 상태'] as const;
// 텍스트 헤더 + 최종점수·최종등급·상세보기.
const COLUMN_COUNT = TEXT_HEADERS.length + 3;

export function EvaluationSummaryView() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <EvaluationSummaryViewInner />
    </Suspense>
  );
}

function EvaluationSummaryViewInner() {
  const { user } = useAuth();
  const { cycles, current, selectedId, setSelectedId, loading: cyclesLoading } = useCycleParam();
  const cycleId = selectedId ?? current?.id;

  // 결과 공개 게이트 — 보고 있는 주기가 closed 전이면 잠정값(hr_admin 은 백엔드 게이트 면제라 프론트에서 표기로 방어).
  const viewedCycle = useMemo(
    () => cycles.find((c) => c.id === cycleId) ?? current ?? null,
    [cycles, cycleId, current],
  );
  const isClosed = viewedCycle?.status === 'closed';

  const { rows, loading, error, reload } = useEvaluationSummaryData(cycleId, !!cycleId);
  const { data: positionsData } = usePositions({ includeInactive: true }, { enabled: !!user });
  const positions = useMemo(() => positionsData?.data ?? [], [positionsData]);

  const [filters, setFilters] = useState<SummaryFilterState>(SUMMARY_FILTER_DEFAULT);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [expanded, setExpanded] = useState<string | null>(null);

  const groupOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.group).filter((g): g is string => !!g))),
    [rows],
  );
  const divisionOptions = useMemo(
    () => Array.from(new Set(rows.filter((r) => filters.group === ALL || r.group === filters.group).map((r) => r.division).filter((g): g is string => !!g))),
    [rows, filters.group],
  );
  const teamOptions = useMemo(
    () => Array.from(new Set(rows.filter((r) => filters.division === ALL || r.division === filters.division).map((r) => r.team).filter((g): g is string => !!g))),
    [rows, filters.division],
  );
  const positionOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.position).filter((g): g is string => !!g))),
    [rows],
  );

  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      if (filters.group !== ALL && r.group !== filters.group) return false;
      if (filters.division !== ALL && r.division !== filters.division) return false;
      if (filters.team !== ALL && r.team !== filters.team) return false;
      if (filters.position !== ALL && r.position !== filters.position) return false;
      if (filters.grade !== ALL && r.finalGrade !== filters.grade) return false;
      if (filters.evalStatus === '평가완료' && !r.finalGrade) return false;
      if (filters.evalStatus === '미완료' && r.finalGrade) return false;
      if (filters.search && !(r.name ?? '').includes(filters.search)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      const av = a.finalScore ?? -1;
      const bv = b.finalScore ?? -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [rows, filters, sortDir]);

  const gradeCounts = useMemo(() => {
    const c: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of rows) if (r.finalGrade) c[r.finalGrade as Grade] += 1;
    return c;
  }, [rows]);

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader
        title="평가 결과표"
        subtitle="1차·2차·최종(그룹대표) 부서장 평가를 합산한 최종 점수·등급을 한눈에 확인하세요."
        cycles={cycles}
        selectedId={cycleId ?? ''}
        onSelectCycle={setSelectedId}
        // 엑셀 내보내기 API(/excel/*)는 백엔드가 hr_admin 전용(@Roles) — 분포 모니터링과 동일 기준으로 노출.
        // 경로도 실제 존재하는 결과 내보내기 엔드포인트(/excel/export/results)로 정정(evaluation-summary 엔드포인트 없음 → 404였음).
        right={isHrAdmin(user.role) && cycleId ? (
          <ExportButton path={`/excel/export/results?cycleId=${cycleId}`} filename={`results-${cycleId}.xlsx`} />
        ) : undefined}
      />

      {cyclesLoading || loading ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <ReportError onRetry={reload} />
      ) : (
        <SummaryGradeStats counts={gradeCounts} total={rows.length} provisional={!isClosed} />
      )}

      <SummaryFilters
        state={filters}
        onChange={(patch) => setFilters((p) => ({ ...p, ...patch }))}
        groupOptions={groupOptions}
        divisionOptions={divisionOptions}
        teamOptions={teamOptions}
        positionOptions={positionOptions}
      />

      {cyclesLoading || loading ? (
        <Skeleton className="h-96 w-full" />
      ) : error ? (
        <ReportError onRetry={reload} />
      ) : filtered.length === 0 ? (
        <ReportEmpty title="표시할 평가 결과가 없어요." description="선택한 주기·필터 조건에 해당하는 결과가 없어요." />
      ) : (
        // 표 높이 = 뷰포트 기준 — 하단 각주까지 스크롤 없이 한 화면에 들어오게. 작은 화면에선 최소 480px 보장.
        // eslint-disable-next-line shadcn/no-arbitrary-values -- 뷰포트 기준 표 높이: max(480px, calc(100vh-400px)) 복합식(스케일 표현 불가)
        <div className="gx-work-surface overflow-x-auto overflow-y-auto max-h-[max(480px,calc(100vh-400px))]">
          <Table bare className="min-w-245 border-collapse">
            <TableHeader>
              <TableRow plain>
                {TEXT_HEADERS.map((h) => (
                  <TableHead key={h} scope="col" sticky textAlign="center" className={thBase}>{h}</TableHead>
                ))}
                {/* 숫자 컬럼 — 셀(text-right)과 정렬선 일치 + aria-sort */}
                <TableHead
                  scope="col"
                  sticky
                  textAlign="right"
                  aria-sort={sortDir === 'desc' ? 'descending' : 'ascending'}
                  className={thBase}
                >
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                  >
                    최종점수 {sortDir === 'desc' ? '↓' : '↑'}
                  </Button>
                </TableHead>
                <TableHead scope="col" sticky textAlign="center" className={thBase}>최종등급</TableHead>
                <TableHead scope="col" sticky textAlign="center" className={thBase}>상세보기</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const isOpen = expanded === r.userId;
                return (
                  <Fragment key={r.userId}>
                    <TableRow>
                      <TableCell textAlign="center" className={`${tdBase} text-muted-foreground`}>{r.no}</TableCell>
                      <TableCell className={tdBase}>
                        <div className="flex items-center gap-2">
                          <PersonAvatar name={r.name ?? '?'} size="xs" />
                          <span className="font-semibold text-foreground">{r.name ?? '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className={tdBase}>{r.group ?? '-'}</TableCell>
                      <TableCell className={tdBase}>{r.division ?? '-'}</TableCell>
                      <TableCell className={tdBase}>{r.team ?? '-'}</TableCell>
                      <TableCell className={tdBase}>{r.position ? getPositionLabel(r.position, positions) : '-'}</TableCell>
                      <TableCell textAlign="center" className={tdBase}>
                        <span
                          className={
                            r.finalGrade
                              ? isClosed
                                ? 'text-status-finalized-fg font-semibold'
                                : 'text-primary font-semibold'
                              : 'text-muted-foreground'
                          }
                        >
                          {r.finalGrade ? (isClosed ? '평가 완료' : '집계 중(잠정)') : '미완료'}
                        </span>
                      </TableCell>
                      <TableCell textAlign="right" className={`${tdBase} font-bold tabular-nums`}>{fmtScore(r.finalScore)}</TableCell>
                      <TableCell textAlign="center" className={tdBase}>
                        <GradeChip grade={r.finalGrade ? (r.finalGrade as Grade) : null} size="sm" />
                      </TableCell>
                      <TableCell textAlign="center" className={tdBase}>
                        <Button variant="ghost" size="sm" onClick={() => setExpanded(isOpen ? null : r.userId)}>
                          {isOpen ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                          상세보기
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isOpen && <SummaryRowExpand row={r} colSpan={COLUMN_COUNT} />}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {isClosed
          ? '최종점수·등급은 확정된 값을 그대로 표시해요.'
          : '최종점수·등급은 조정 전 잠정 집계값이에요(확정 아님 — 주기 마감 후 확정돼요).'}{' '}
        평가합산은 단계 가중치(1차 0.5·2차 0.3·최종 0.2)로 계산돼요.
      </p>
    </PageContainer>
  );
}
