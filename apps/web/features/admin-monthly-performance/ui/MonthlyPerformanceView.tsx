'use client';

/**
 * 경영실적(월별 손익) 입력 화면 — image 11 재현.
 * 가로 스크롤 엑셀 그리드 → 1~12월 탭 선택 방식으로 교체(요구사항 P15).
 * 데이터 흐름: useFinancialGrid(조회) → draft 편집(월 단위) → 임시저장=bulk(draft 적재) /
 * 최종저장=bulk+finalize(draft→final 확정, 확정분만 대시보드·등급풀 집계 반영).
 * 파생 계산(차트·년계·달성률)은 usePerfDerived, 부서 옵션은 useScopedDeptOptions로 분리(파일상한).
 */
import { useEffect, useMemo, useState } from 'react';
import { Save, FileEdit } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinancialGrid } from '../hooks';
import { MONTHS, type GridDraft, type RowKey, cellKey } from './FinancialGridHelpers';
import { PerfSummaryCards } from './PerfSummaryCards';
import { RevenueTrendChart, GrossMarginChart } from './PerfCharts';
import { MonthTabBar } from './MonthTabBar';
import { MonthInputTable } from './MonthInputTable';
import { AchievementPanel } from './AchievementPanel';
import { InputGuide } from './InputGuide';
import { useScopedDeptOptions } from './useScopedDeptOptions';
import { usePerfDerived } from './usePerfDerived';
import { usePerfSave } from './usePerfSave';

function columnsToInitDraft(columns: import('../api').FinancialGridColumn[]): GridDraft {
  const d: GridDraft = {};
  for (const col of columns) {
    const rows: RowKey[] = ['revenueTarget', 'revenueActual', 'costTarget', 'costActual'];
    for (const rk of rows) {
      let val: number | null = null;
      if (rk === 'revenueTarget') val = col.revenue.target;
      else if (rk === 'revenueActual') val = col.revenue.actual;
      else if (rk === 'costTarget') val = col.cost.target;
      else if (rk === 'costActual') val = col.cost.actual;
      d[cellKey(col.key, rk)] = val !== null ? String(val) : '';
    }
  }
  return d;
}

/** 서버 비고 → 로컬 notes 상태(`${월}:revenue|cost`). 월 컬럼(1~12)만 대상. */
function columnsToInitNotes(columns: import('../api').FinancialGridColumn[]): Record<string, string> {
  const n: Record<string, string> = {};
  for (const col of columns) {
    if (col.isPrevYear || col.isYearTotal) continue;
    if (col.revenueNote) n[`${col.key}:revenue`] = col.revenueNote;
    if (col.costNote) n[`${col.key}:cost`] = col.costNote;
  }
  return n;
}

export function MonthlyPerformanceView() {
  const { user } = useAuth();
  const { cycles, current, selectedId, setSelectedId, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;
  const year = current?.year;

  const isAdmin = user?.role === 'hr_admin';
  const isDivisionHead = user?.role === 'division_head';
  const allowed = !!user && (isAdmin || isDivisionHead || user.role === 'team_lead');
  const canEdit = isAdmin || isDivisionHead;

  const deptOptions = useScopedDeptOptions(user, allowed, isAdmin);

  const [departmentId, setDepartmentId] = useState<string>('');
  useEffect(() => {
    if (!departmentId && deptOptions.length > 0) setDepartmentId(deptOptions[0].value);
    if (departmentId && deptOptions.length > 0 && !deptOptions.some((option) => option.value === departmentId)) {
      setDepartmentId(deptOptions[0].value);
    }
  }, [deptOptions, departmentId]);

  const { data: gridData, loading: gridLoading, error, reload } = useFinancialGrid(
    { cycleId, departmentId, year },
    { enabled: allowed && !!cycleId && !!departmentId && !!year },
  );

  const [draft, setDraft] = useState<GridDraft>({});
  const [activeMonth, setActiveMonth] = useState(1);
  // 행별 비고(월 단위, 매출·원가만) — 서버 revenueNote/costNote 와 동기화, bulk 저장에 포함.
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (gridData?.columns) {
      setDraft(columnsToInitDraft(gridData.columns));
      setNotes(columnsToInitNotes(gridData.columns));
    }
  }, [gridData]);

  useEffect(() => {
    setDraft({});
    setNotes({});
    setActiveMonth(1);
  }, [departmentId, cycleId]);

  function handleTarget(rowGroup: string, value: string) {
    const rk: RowKey = rowGroup === 'revenue' ? 'revenueTarget' : 'costTarget';
    setDraft((prev) => ({ ...prev, [cellKey(String(activeMonth), rk)]: value }));
  }
  function handleActual(rowGroup: string, value: string) {
    const rk: RowKey = rowGroup === 'revenue' ? 'revenueActual' : 'costActual';
    setDraft((prev) => ({ ...prev, [cellKey(String(activeMonth), rk)]: value }));
  }

  const dirty = useMemo(() => {
    if (!gridData?.columns) return false;
    const init = columnsToInitDraft(gridData.columns);
    for (const [k, v] of Object.entries(draft)) {
      if ((init[k] ?? '') !== (v ?? '')) return true;
    }
    // 비고 변경도 저장 대상(더티).
    const initNotes = columnsToInitNotes(gridData.columns);
    const noteKeys = new Set([...Object.keys(initNotes), ...Object.keys(notes)]);
    for (const k of noteKeys) {
      if ((initNotes[k] ?? '').trim() !== (notes[k] ?? '').trim()) return true;
    }
    return false;
  }, [draft, notes, gridData]);

  const { completeMonths, chartData, hasChartData, yearSummary, monthRows, achievementRows } = usePerfDerived(draft, activeMonth);
  const { saving, savedAt, saveAll, saveDraft } = usePerfSave({ cycleId, departmentId, year, draft, notes, onSaved: reload });

  if (!allowed) return <Forbidden message="경영실적 입력은 HR·본부장만 접근할 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  return (
    <PageContainer>
      <PageHeader
        title="경영실적(월별 손익) 입력"
        subtitle={`매출·원가(목표/실적) 입력 → 매출총이익·이익률·년계 자동 계산.${!canEdit ? ' 조회 전용입니다.' : ''}`}
        cycles={cycles.length > 1 ? cycles : undefined}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-muted-foreground">대상 부서</span>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="w-56 text-sm">
                <SelectValue placeholder="부서 선택" />
              </SelectTrigger>
              <SelectContent>
                {deptOptions.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">부서 없음</div>}
                {deptOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit && (
              <>
                <Button variant="secondary" size="sm" leftIcon={<FileEdit size={14} aria-hidden />} onClick={saveDraft}>
                  임시저장
                </Button>
                <Button variant="primary" size="sm" leftIcon={<Save size={14} aria-hidden />} disabled={saving || !dirty} loading={saving} onClick={() => void saveAll()}>
                  최종저장
                </Button>
              </>
            )}
          </div>
        }
      />

      {!departmentId ? (
        <Card><EmptyState title="대상 부서를 선택해 주세요." /></Card>
      ) : gridLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !gridData ? (
        <Card><EmptyState title="데이터를 불러올 수 없어요." /></Card>
      ) : (
        <>
          <PerfSummaryCards
            data={{
              revenueActual: yearSummary.revenueActualTotal,
              revenueTarget: yearSummary.revenueTargetTotal,
              costActual: yearSummary.costActualTotal,
              costTarget: yearSummary.costTargetTotal,
              grossActual: yearSummary.grossActualTotal,
              grossTarget: yearSummary.grossTargetTotal,
              marginActual: yearSummary.marginActualTotal,
              marginTarget: yearSummary.marginTargetTotal,
              completeMonths: completeMonths.size,
              projectedAnnualRate: yearSummary.projectedAnnualRate,
              dirty,
              savedAt,
            }}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="매출 목표 vs 매출 실적" padding="sm">
              <RevenueTrendChart data={chartData} hasData={hasChartData} />
            </Card>
            <Card title="매출총이익 및 이익률 추이" padding="sm">
              <GrossMarginChart data={chartData} hasData={hasChartData} />
            </Card>
          </div>

          <MonthTabBar months={MONTHS} active={activeMonth} onSelect={setActiveMonth} completeSet={completeMonths} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <MonthInputTable
              rows={monthRows}
              canEdit={canEdit}
              year={current.year}
              onChangeTarget={handleTarget}
              onChangeActual={handleActual}
              notes={{
                revenue: notes[`${activeMonth}:revenue`] ?? '',
                cost: notes[`${activeMonth}:cost`] ?? '',
              }}
              onChangeNote={(key, v) => setNotes((prev) => ({ ...prev, [`${activeMonth}:${key}`]: v }))}
            />
            <AchievementPanel month={activeMonth} rows={achievementRows} />
          </div>

          <InputGuide />
        </>
      )}
    </PageContainer>
  );
}
