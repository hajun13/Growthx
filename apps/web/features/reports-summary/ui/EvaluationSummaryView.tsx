'use client';

// 평가자정리 표 — 1차(팀장)·2차(본부장)·최종(그룹대표) × 실적/역량 + 합산 + 최종점수/등급.
// 데이터: @growthx/contracts resultsControllerSummary (GET /results/summary). 엑셀 "평가자정리" 레이아웃.
import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { usePositions } from '@/hooks/usePositions';
import { ErrorState, Skeleton, EmptyState } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { GradeChip } from '@/components/GradeChip';
import { HeaderMetrics } from '@/components/HeaderMetrics';
import { SearchInput } from '@/components/SearchInput';
import { FilterChipBar } from '@/components/FilterChipBar';
import { ExportButton } from '@/components/ExportButton';
import { getPositionLabel, roleLabel, fmtScore } from '@/lib/ui';
import type { Grade, Role } from '@/lib/types';
import { useEvaluationSummaryData } from '../hooks';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

const thBase = 'text-[11px] font-semibold text-muted-foreground bg-muted border-b border-r border-border px-2.5 py-2 whitespace-nowrap text-center';
const tdBase = 'text-[12.5px] text-foreground border-b border-r border-border px-2.5 py-2 whitespace-nowrap';
const numTd = `${tdBase} text-right tabular-nums`;

function num(v: number | null): string {
  return v == null ? '-' : fmtScore(v);
}

function StageCells({ s, className }: { s: { perf: number | null; comp: number | null }; className?: string }) {
  return (
    <>
      <td className={`${numTd} ${className ?? ''}`}>{num(s.perf)}</td>
      <td className={`${numTd} ${className ?? ''}`}>{num(s.comp)}</td>
    </>
  );
}

export function EvaluationSummaryView() {
  const { user } = useAuth();
  const { cycles, current, selectedId, setSelectedId, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = selectedId ?? current?.id;

  const { rows, loading, error, reload } = useEvaluationSummaryData(cycleId, !!cycleId);
  const { data: positionsData } = usePositions({ includeInactive: true }, { enabled: !!user });
  const positions = useMemo(() => positionsData?.data ?? [], [positionsData]);

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('전체');

  const groupOptions = useMemo(
    () => ['전체', ...Array.from(new Set(rows.map((r) => r.group).filter((g): g is string => !!g)))],
    [rows],
  );

  const filtered = useMemo(
    () => rows.filter((r) => {
      if (groupFilter !== '전체' && r.group !== groupFilter) return false;
      if (search && !(r.name ?? '').includes(search)) return false;
      return true;
    }),
    [rows, groupFilter, search],
  );

  const gradeCounts = useMemo(() => {
    const c: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const r of filtered) if (r.finalGrade) c[r.finalGrade as Grade] += 1;
    return c;
  }, [filtered]);

  if (!user) return null;

  return (
    <PageContainer>
      <PageHeader
        title="평가 결과표"
        subtitle="1차(팀장)·2차(본부장)·최종(그룹대표) 평가를 합산한 최종 점수·등급을 한눈에 확인하세요."
        cycles={cycles}
        selectedId={cycleId ?? ''}
        onSelectCycle={setSelectedId}
        right={
          <>
            <HeaderMetrics
              items={GRADES.map((g) => ({
                label: `등급 ${g}`,
                value: `${gradeCounts[g]}명`,
                accent: g === 'S' || g === 'A' ? 'text-primary' : g === 'B' ? 'text-success-700' : g === 'C' ? 'text-warning-700' : 'text-danger-600',
              }))}
            />
            {cycleId && (
              <ExportButton
                path={`/excel/export/evaluation-summary?cycleId=${cycleId}`}
                filename={`evaluation-summary-${cycleId}.xlsx`}
              />
            )}
          </>
        }
      />

      {/* 필터 바 */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="이름 검색" className="w-48" />
          <FilterChipBar
            options={groupOptions.map((g) => ({ value: g, label: g }))}
            value={groupFilter}
            onChange={setGroupFilter}
          />
          <span className="ml-auto text-xs font-medium text-muted-foreground">{filtered.length}명</span>
        </div>
      </Card>

      {/* 평가자정리 표 */}
      {cyclesLoading || loading ? (
        <Skeleton className="h-96 w-full" />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="표시할 평가 결과가 없어요."
          description="선택한 주기에 확정된 평가 결과가 없거나, 아직 집계되지 않았어요."
        />
      ) : (
        <div className="rounded-lg border border-border bg-card shadow-elev-1 overflow-x-auto overflow-y-auto max-h-[600px]">
          <table className="border-collapse w-full" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                {['NO', '성명', '그룹', '본부', '팀', '직급', '직책'].map((h) => (
                  <th key={h} rowSpan={2} className={`${thBase} sticky top-0 z-10`}>{h}</th>
                ))}
                <th colSpan={2} className={`${thBase} sticky top-0 z-10 bg-purple-50 text-primary`}>1차 (팀장)</th>
                <th colSpan={2} className={`${thBase} sticky top-0 z-10 bg-info-50 text-info-700`}>2차 (본부장)</th>
                <th colSpan={2} className={`${thBase} sticky top-0 z-10 bg-purple-50 text-primary`}>최종 (그룹대표)</th>
                <th colSpan={2} className={`${thBase} sticky top-0 z-10`}>평가합산</th>
                <th rowSpan={2} className={`${thBase} sticky top-0 z-10`}>최종점수</th>
                <th rowSpan={2} className={`${thBase} sticky top-0 z-10`}>최종등급</th>
              </tr>
              <tr>
                {['실적', '역량', '실적', '역량', '실적', '역량', '실적', '역량'].map((h, i) => (
                  <th key={i} className={`${thBase} sticky top-0 z-10 font-medium`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.userId} className="bg-card hover:bg-accent transition-colors">
                  <td className={`${numTd} text-muted-foreground`}>{r.no}</td>
                  <td className={`${tdBase} font-semibold text-foreground`}>{r.name ?? '-'}</td>
                  <td className={tdBase}>{r.group ?? '-'}</td>
                  <td className={tdBase}>{r.division ?? '-'}</td>
                  <td className={tdBase}>{r.team ?? '-'}</td>
                  <td className={tdBase}>{r.position ? getPositionLabel(r.position, positions) : '-'}</td>
                  <td className={tdBase}>{r.role ? roleLabel[r.role as Role] : '-'}</td>
                  <StageCells s={r.stage1} className="bg-purple-50/30" />
                  <StageCells s={r.stage2} className="bg-info-50/30" />
                  <StageCells s={r.stageFinal} className="bg-purple-50/30" />
                  <StageCells s={r.sum} className="bg-muted/40" />
                  <td className={`${numTd} font-bold text-primary`}>{num(r.finalScore)}</td>
                  <td className={`${tdBase} text-center`}>
                    <GradeChip grade={r.finalGrade ? (r.finalGrade as Grade) : null} size="sm" variant="solid" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Download size={12} aria-hidden />
        최종점수·등급은 확정된 값을 그대로 표시해요. 평가합산은 단계 가중치(1차 0.5·2차 0.3·최종 0.2)로 계산돼요.
      </p>
    </PageContainer>
  );
}
