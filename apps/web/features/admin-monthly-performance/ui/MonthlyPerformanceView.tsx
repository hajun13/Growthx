'use client';

/**
 * 경영실적(월별 손익) 입력 화면 — 엑셀 양식 그리드.
 * 기존 카테고리별 카드·차트 폐기 → 4행×15열 그리드로 교체.
 * 데이터 흐름: useFinancialGrid(조회) → draft 편집 → financialGridCommands.bulk(저장).
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useDepartments } from '@/hooks/useDepartments';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import {
  EmptyState,
  ErrorState,
  Forbidden,
  Skeleton,
} from '@/components/States';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinancialGrid, financialGridCommands } from '../hooks';
import { FinancialGrid } from './FinancialGrid';
import type { BulkMonthEntry, BulkPrevYear } from '../api';
import {
  MONTHS,
  type GridDraft,
  type RowKey,
  cellKey,
  parseNum,
} from './FinancialGridHelpers';

// ── draft 초기값: 서버 columns → draft 변환 ─────────────────────
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

export function MonthlyPerformanceView() {
  const { user } = useAuth();
  const toast = useToast();
  const { cycles, current, selectedId, setSelectedId, loading: cyclesLoading } = useCurrentCycle();
  const cycleId = current?.id;
  const year = current?.year;

  const isAdmin = user?.role === 'hr_admin';
  const isDivisionHead = user?.role === 'division_head';
  const allowed = !!user && (isAdmin || isDivisionHead || user.role === 'team_lead');
  const canEdit = isAdmin || isDivisionHead;

  // 부서 목록
  const { data: groupDepts } = useDepartments({ type: 'group' }, { enabled: allowed });
  const { data: divisionDepts } = useDepartments({ type: 'division' }, { enabled: allowed });
  const { data: teamDepts } = useDepartments({ type: 'team' }, { enabled: allowed });

  const deptOptions = useMemo(() => {
    const groups = (groupDepts?.data ?? []).map((d) => ({
      value: d.id,
      label: `${d.name} (그룹)`,
      type: 'group' as const,
      parentId: d.parentId,
    }));
    const divisions = (divisionDepts?.data ?? []).map((d) => ({
      value: d.id,
      label: `${d.name} (본부)`,
      type: 'division' as const,
      parentId: d.parentId,
    }));
    const teams = (teamDepts?.data ?? []).map((d) => ({
      value: d.id,
      label: `${d.name} (팀)`,
      type: 'team' as const,
      parentId: d.parentId,
    }));

    const all = [...groups, ...divisions, ...teams];
    if (!user) return [];
    if (isAdmin || user.visibilityScope === 'company') return all;
    if (!user.departmentId) return [];

    const byId = new Map(all.map((dept) => [dept.value, dept]));
    const rootForScope = (() => {
      let cursor: string | null = user.departmentId;
      for (let depth = 0; cursor && depth < 10; depth += 1) {
        const dept = byId.get(cursor);
        if (!dept) return user.departmentId;
        if (user.visibilityScope === 'team' && dept.type === 'team') return dept.value;
        if (user.visibilityScope === 'division' && dept.type === 'division') return dept.value;
        if (user.visibilityScope === 'group' && dept.type === 'group') return dept.value;
        cursor = dept.parentId;
      }
      return user.departmentId;
    })();

    const isUnderRoot = (deptId: string) => {
      let cursor: string | null = deptId;
      for (let depth = 0; cursor && depth < 10; depth += 1) {
        if (cursor === rootForScope) return true;
        cursor = byId.get(cursor)?.parentId ?? null;
      }
      return false;
    };

    if (user.visibilityScope === 'team') {
      return all.filter((dept) => dept.value === user.departmentId);
    }
    return all.filter((dept) => isUnderRoot(dept.value));
  }, [groupDepts, divisionDepts, teamDepts, isAdmin, user]);

  const [departmentId, setDepartmentId] = useState<string>('');
  useEffect(() => {
    if (!departmentId && deptOptions.length > 0) setDepartmentId(deptOptions[0].value);
    if (departmentId && deptOptions.length > 0 && !deptOptions.some((option) => option.value === departmentId)) {
      setDepartmentId(deptOptions[0].value);
    }
  }, [deptOptions, departmentId]);

  // 그리드 조회
  const { data: gridData, loading: gridLoading, error, reload } = useFinancialGrid(
    { cycleId, departmentId, year },
    { enabled: allowed && !!cycleId && !!departmentId && !!year },
  );

  const [draft, setDraft] = useState<GridDraft>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (gridData?.columns) {
      setDraft(columnsToInitDraft(gridData.columns));
    }
  }, [gridData]);

  useEffect(() => {
    setDraft({});
  }, [departmentId, cycleId]);

  function handleCellChange(colKey: string, rowKey: RowKey, value: string) {
    setDraft((prev) => ({ ...prev, [cellKey(colKey, rowKey)]: value }));
  }

  function handleDraftChange(patches: { colKey: string; rowKey: RowKey; value: string }[]) {
    setDraft((prev) => {
      const next = { ...prev };
      for (const p of patches) next[cellKey(p.colKey, p.rowKey)] = p.value;
      return next;
    });
  }

  const dirty = useMemo(() => {
    if (!gridData?.columns) return false;
    const init = columnsToInitDraft(gridData.columns);
    for (const [k, v] of Object.entries(draft)) {
      if ((init[k] ?? '') !== (v ?? '')) return true;
    }
    return false;
  }, [draft, gridData]);

  const gridSummary = useMemo(() => {
    if (!gridData?.columns) {
      return {
        filledCells: 0,
        totalCells: 0,
        completeMonths: 0,
        missingMonths: [] as string[],
        revenueRate: null as number | null,
        marginRate: null as number | null,
      };
    }
    const rows: RowKey[] = ['revenueTarget', 'revenueActual', 'costTarget', 'costActual'];
    const monthColumns = gridData.columns.filter((column) => !column.isPrevYear && !column.isYearTotal);
    const totalCells = monthColumns.length * rows.length;
    let filledCells = 0;
    let completeMonths = 0;
    const missingMonths: string[] = [];

    for (const column of monthColumns) {
      const filledInMonth = rows.filter((row) => {
        const raw = draft[cellKey(column.key, row)] ?? '';
        return raw.trim() !== '' && parseNum(raw) !== null;
      }).length;
      filledCells += filledInMonth;
      if (filledInMonth === rows.length) completeMonths += 1;
      else missingMonths.push(column.label);
    }

    const total = gridData.columns.find((column) => column.isYearTotal);
    const revenueTarget = total?.revenue.target ?? null;
    const revenueActual = total?.revenue.actual ?? null;
    const grossProfitActual = total?.grossProfit.actual ?? null;
    const revenueRate =
      revenueTarget && revenueTarget > 0 && revenueActual !== null
        ? (revenueActual / revenueTarget) * 100
        : null;
    const marginRate =
      revenueActual && revenueActual > 0 && grossProfitActual !== null
        ? (grossProfitActual / revenueActual) * 100
        : null;

    return {
      filledCells,
      totalCells,
      completeMonths,
      missingMonths,
      revenueRate,
      marginRate,
    };
  }, [draft, gridData]);

  async function saveAll() {
    if (!cycleId || !departmentId || !year) return;
    setSaving(true);
    try {
      const prevRevenueActual = parseNum(draft[cellKey('prevYear', 'revenueActual')] ?? '');
      const prevCostActual = parseNum(draft[cellKey('prevYear', 'costActual')] ?? '');
      const prevYear: BulkPrevYear | undefined =
        prevRevenueActual !== null || prevCostActual !== null
          ? { revenueActual: prevRevenueActual, costActual: prevCostActual }
          : undefined;

      const months: BulkMonthEntry[] = MONTHS.map((m) => ({
        month: m,
        revenueTarget: parseNum(draft[cellKey(String(m), 'revenueTarget')] ?? ''),
        revenueActual: parseNum(draft[cellKey(String(m), 'revenueActual')] ?? ''),
        costTarget: parseNum(draft[cellKey(String(m), 'costTarget')] ?? ''),
        costActual: parseNum(draft[cellKey(String(m), 'costActual')] ?? ''),
      }));

      await financialGridCommands.bulk({ cycleId, departmentId, year, prevYear, months });
      toast.show({ variant: 'success', message: '경영실적을 저장했어요.' });
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) return <Forbidden message="경영실적 입력은 HR·본부장만 접근할 수 있어요." />;
  if (cyclesLoading) return <Skeleton className="h-64 w-full" />;
  if (!current) return <EmptyState title="진행 중인 평가 주기가 없어요." />;

  return (
    <PageContainer>
      <PageHeader
        title="경영실적(월별 손익) 입력"
        subtitle={`엑셀 양식(2025년 경영실적) 기반 그리드. 매출·원가(목표/실적) 입력 → 매출총이익·이익율·년계 자동 계산. 엑셀 블록 복붙 지원.${!canEdit ? ' 조회 전용입니다.' : ''}`}
        cycles={cycles.length > 1 ? cycles : undefined}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <span className="text-[12px] font-semibold text-muted-foreground border border-border rounded-none px-3 py-2 bg-muted">
            기준 {year}년
          </span>
        }
      />

      {/* 부서 선택 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-muted-foreground">대상 부서</span>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-52 text-sm">
              <SelectValue placeholder="부서 선택" />
            </SelectTrigger>
            <SelectContent>
              {deptOptions.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">부서 없음</div>
              )}
              {deptOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {gridData && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card
            title="입력 현황"
            action={
              <span className="text-[12px] text-muted-foreground">
                {gridSummary.filledCells}/{gridSummary.totalCells}개 셀 입력
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
              <MetricCell label="완성 월" value={`${gridSummary.completeMonths}/12`} />
              <MetricCell
                label="누적 매출 달성률"
                value={gridSummary.revenueRate === null ? '—' : `${Math.round(gridSummary.revenueRate * 10) / 10}%`}
              />
              <MetricCell
                label="누적 이익률"
                value={gridSummary.marginRate === null ? '—' : `${Math.round(gridSummary.marginRate * 10) / 10}%`}
              />
              <MetricCell label="저장 상태" value={dirty ? '수정됨' : '저장됨'} />
            </div>
          </Card>

          <Card
            title={
              <span className="flex items-center gap-2">
                <ClipboardCheck size={16} className="text-primary" aria-hidden />
                저장 전 점검
              </span>
            }
          >
            <div className="space-y-3">
              <CheckRow
                done={gridSummary.completeMonths === 12}
                title="12개월 입력"
                text={
                  gridSummary.missingMonths.length === 0
                    ? '모든 월의 목표·실적이 채워졌습니다.'
                    : `${gridSummary.missingMonths.slice(0, 4).join(', ')}${gridSummary.missingMonths.length > 4 ? ' 외' : ''} 입력이 남았습니다.`
                }
              />
              <CheckRow
                done={!dirty}
                title="저장 반영"
                text={dirty ? '수정한 값이 있습니다. 저장 후 등급풀 집계에 반영됩니다.' : '현재 값은 저장된 상태입니다.'}
              />
              <CheckRow
                done={canEdit}
                title="편집 권한"
                text={canEdit ? '저장할 수 있는 권한입니다.' : '조회 전용입니다. HR 또는 본부장 권한이 필요합니다.'}
              />
            </div>
          </Card>
        </div>
      )}

      {!departmentId ? (
        <Card>
          <EmptyState title="대상 부서를 선택해 주세요." />
        </Card>
      ) : (
        <Card
          title={`${year}년 계획 및 달성 — ${gridData?.departmentName ?? '…'}`}
          action={
            canEdit ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Save size={14} aria-hidden />}
                disabled={saving || !dirty}
                loading={saving}
                onClick={() => void saveAll()}
              >
                저장
              </Button>
            ) : null
          }
          padding="sm"
        >
          {/* 그리드 설명 */}
          <p className="text-[12px] text-muted-foreground mb-3 px-0">
            셀을 직접 입력하거나 엑셀에서 복사하여 붙여넣을 수 있어요. (전년 열은 연간 실적만 입력)
          </p>

          {/* 그리드 본체 */}
          {gridLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : error ? (
            <ErrorState onRetry={reload} />
          ) : !gridData ? (
            <EmptyState title="데이터를 불러올 수 없어요." />
          ) : (
            <FinancialGrid
              columns={gridData.columns}
              draft={draft}
              canEdit={canEdit}
              onChange={handleCellChange}
              onDraftChange={handleDraftChange}
            />
          )}

          {/* 주석 */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3">
            <span className="text-[11px] text-muted-foreground">매출총이익 = 매출 − 원가 (자동)</span>
            <span className="text-[11px] text-muted-foreground">이익율 = 이익 ÷ 매출 × 100 (매출 0이면 '-')</span>
            <span className="text-[11px] text-muted-foreground">년계 = 1~12월 합계 (자동). 전년은 연간 단일값.</span>
          </div>

          {gridData && (
            <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-3">
              <GuidanceBlock
                title="1. 복사 붙여넣기"
                text="월별 매출·원가의 목표/실적 영역을 선택한 뒤 엑셀 블록을 그대로 붙여넣습니다."
              />
              <GuidanceBlock
                title="2. 누락 월 확인"
                text={
                  gridSummary.missingMonths.length === 0
                    ? '현재 누락된 월이 없습니다.'
                    : `${gridSummary.missingMonths.slice(0, 6).join(', ')} 값을 확인하세요.`
                }
              />
              <GuidanceBlock
                title="3. 저장 후 영향"
                text="저장하면 그룹 실적 달성률과 등급풀 자동 적용 기준이 함께 갱신됩니다."
              />
            </div>
          )}
        </Card>
      )}
    </PageContainer>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-[16px] font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function CheckRow({
  done,
  title,
  text,
}: {
  done: boolean;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={
          done
            ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-primary bg-primary text-primary-foreground'
            : 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-warning-300 bg-warning-50 text-warning-700'
        }
      >
        {done ? <CheckCircle2 size={13} aria-hidden /> : <AlertTriangle size={13} aria-hidden />}
      </span>
      <span>
        <span className="block text-[13px] font-bold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">{text}</span>
      </span>
    </div>
  );
}

function GuidanceBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="border border-border bg-muted px-3 py-3">
      <div className="text-[12px] font-bold text-foreground">{title}</div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
