'use client';

// 평가 결과표 — image 12 재현: 상단 등급 카드 통계(분포 그래프 제거) + Avatar + 캐스케이드 필터
// + 최종점수 정렬 + 상세보기 확장(1차/2차/최종).
import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { usePositions } from '@/hooks/usePositions';
import { ErrorState, Skeleton, EmptyState } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Avatar } from '@/components/Avatar';
import { GradeChip } from '@/components/GradeChip';
import { ExportButton } from '@/components/ExportButton';
import { Button } from '@/components/Button';
import { getPositionLabel, fmtScore } from '@/lib/ui';
import type { Grade } from '@/lib/types';
import { useEvaluationSummaryData } from '../hooks';
import { SummaryGradeStats } from './SummaryGradeStats';
import { SummaryFilters, type SummaryFilterState } from './SummaryFilters';
import { SummaryRowExpand } from './SummaryRowExpand';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const ALL = '전체';

const thBase = 'text-[11px] font-semibold text-muted-foreground bg-muted border-b border-border px-2.5 py-2 whitespace-nowrap text-center';
const tdBase = 'text-[12.5px] text-foreground border-b border-border px-2.5 py-2 whitespace-nowrap';

export function EvaluationSummaryView() {
  const { user } = useAuth();
  const { cycles, current, selectedId, setSelectedId, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = selectedId ?? current?.id;

  const { rows, loading, error, reload } = useEvaluationSummaryData(cycleId, !!cycleId);
  const { data: positionsData } = usePositions({ includeInactive: true }, { enabled: !!user });
  const positions = useMemo(() => positionsData?.data ?? [], [positionsData]);

  const [filters, setFilters] = useState<SummaryFilterState>({
    search: '', group: ALL, division: ALL, team: ALL, position: ALL, grade: ALL, evalStatus: ALL,
  });
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
        subtitle="1차(팀장)·2차(본부장)·최종(그룹대표) 평가를 합산한 최종 점수·등급을 한눈에 확인하세요."
        cycles={cycles}
        selectedId={cycleId ?? ''}
        onSelectCycle={setSelectedId}
        right={cycleId ? (
          <ExportButton path={`/excel/export/evaluation-summary?cycleId=${cycleId}`} filename={`evaluation-summary-${cycleId}.xlsx`} />
        ) : undefined}
      />

      {cyclesLoading || loading ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <SummaryGradeStats counts={gradeCounts} total={rows.length} />
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
        <ErrorState onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState title="표시할 평가 결과가 없어요." description="선택한 주기·필터 조건에 해당하는 결과가 없어요." />
      ) : (
        // 표 높이 = 뷰포트 기준 — 하단 각주까지 스크롤 없이 한 화면에 들어오게. 작은 화면에선 최소 480px 보장.
        <div className="gx-work-surface overflow-x-auto overflow-y-auto max-h-[max(480px,calc(100vh-400px))]">
          <table className="w-full border-collapse" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                {['NO', '성명', '그룹', '본부', '팀', '직급', '평가 상태'].map((h) => (
                  <th key={h} className={`${thBase} sticky top-0 z-10`}>{h}</th>
                ))}
                <th className={`${thBase} sticky top-0 z-10`}>
                  <button
                    type="button"
                    onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                    className="inline-flex items-center gap-1"
                  >
                    최종점수 {sortDir === 'desc' ? '↓' : '↑'}
                  </button>
                </th>
                <th className={`${thBase} sticky top-0 z-10`}>최종등급</th>
                <th className={`${thBase} sticky top-0 z-10`}>상세보기</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isOpen = expanded === r.userId;
                return (
                  <Fragment key={r.userId}>
                    <tr className="bg-card transition-colors hover:bg-muted/60">
                      <td className={`${tdBase} text-center text-muted-foreground`}>{r.no}</td>
                      <td className={tdBase}>
                        <div className="flex items-center gap-2">
                          <Avatar name={r.name ?? '?'} size="xs" />
                          <span className="font-semibold text-foreground">{r.name ?? '-'}</span>
                        </div>
                      </td>
                      <td className={tdBase}>{r.group ?? '-'}</td>
                      <td className={tdBase}>{r.division ?? '-'}</td>
                      <td className={tdBase}>{r.team ?? '-'}</td>
                      <td className={tdBase}>{r.position ? getPositionLabel(r.position, positions) : '-'}</td>
                      <td className={`${tdBase} text-center`}>
                        <span className={r.finalGrade ? 'text-status-finalized-fg font-semibold' : 'text-muted-foreground'}>
                          {r.finalGrade ? '평가 완료' : '미완료'}
                        </span>
                      </td>
                      <td className={`${tdBase} text-right font-bold tabular-nums`}>{fmtScore(r.finalScore)}</td>
                      <td className={`${tdBase} text-center`}>
                        <GradeChip grade={r.finalGrade ? (r.finalGrade as Grade) : null} size="sm" />
                      </td>
                      <td className={`${tdBase} text-center`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpanded(isOpen ? null : r.userId)}
                          leftIcon={isOpen ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
                        >
                          상세보기
                        </Button>
                      </td>
                    </tr>
                    {isOpen && <SummaryRowExpand row={r} />}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        최종점수·등급은 확정된 값을 그대로 표시해요. 평가합산은 단계 가중치(1차 0.5·2차 0.3·최종 0.2)로 계산돼요.
      </p>
    </PageContainer>
  );
}
