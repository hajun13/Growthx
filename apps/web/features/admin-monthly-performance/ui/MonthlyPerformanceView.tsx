'use client';

/**
 * 경영실적(월별 손익) 입력 화면 — 엑셀 양식 그리드.
 * 기존 카테고리별 카드·차트 폐기 → 4행×15열 그리드로 교체.
 * 데이터 흐름: useFinancialGrid(조회) → draft 편집 → financialGridCommands.bulk(저장).
 */
import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
  liveCell,
  liveGross,
  liveGrossYearTotal,
  liveYearTotal,
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

    const revenueTarget = liveYearTotal(draft, 'revenueTarget');
    const revenueActual = liveYearTotal(draft, 'revenueActual');
    const grossProfitActual = liveGrossYearTotal(draft, false);
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

  const chartData = useMemo(() => {
    return MONTHS.map((month) => {
      const key = String(month);
      const revenueTarget = liveCell(draft, key, 'revenueTarget');
      const revenueActual = liveCell(draft, key, 'revenueActual');
      const grossProfitActual = liveGross(draft, key, false);
      const marginRate =
        revenueActual && revenueActual > 0 && grossProfitActual !== null
          ? Math.round((grossProfitActual / revenueActual) * 1000) / 10
          : null;

      return {
        month,
        label: `${month}월`,
        revenueTarget,
        revenueActual,
        grossProfitActual,
        marginRate,
      };
    });
  }, [draft]);

  const hasChartData = useMemo(
    () =>
      chartData.some(
        (item) =>
          item.revenueTarget !== null ||
          item.revenueActual !== null ||
          item.grossProfitActual !== null ||
          item.marginRate !== null,
      ),
    [chartData],
  );

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
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-muted-foreground">대상 부서</span>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="w-56 text-sm">
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
        }
      />

      {gridData && (
        <Card title="입력 현황">
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
          <MonthlyInputTrendChart data={chartData} hasData={hasChartData} />
        </Card>
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

interface MonthlyInputTrendDatum {
  month: number;
  label: string;
  revenueTarget: number | null;
  revenueActual: number | null;
  grossProfitActual: number | null;
  marginRate: number | null;
}

function MonthlyInputTrendChart({
  data,
  hasData,
}: {
  data: MonthlyInputTrendDatum[];
  hasData: boolean;
}) {
  if (!hasData) {
    return (
      <div className="mt-4 flex h-[180px] items-center justify-center border border-dashed border-border bg-muted/40">
        <span className="text-[12px] text-muted-foreground">월별 목표·실적을 입력하면 추이가 표시됩니다.</span>
      </div>
    );
  }

  return (
    <div className="mt-4 h-[220px] border border-border bg-card px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E8EA" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#68707A' }}
          />
          <YAxis
            yAxisId="amount"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#68707A' }}
            width={54}
            tickFormatter={formatAmountShort}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#68707A' }}
            width={42}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            formatter={(value, name) => {
              const label = chartSeriesLabel(String(name));
              if (value === null || value === undefined) return ['-', label];
              if (name === 'marginRate') return [`${Number(value).toFixed(1)}%`, label];
              return [formatAmountFull(Number(value)), label];
            }}
            labelFormatter={(label) => `${label}`}
            contentStyle={{
              borderRadius: 0,
              borderColor: '#E1E3E6',
              boxShadow: 'none',
              fontSize: 12,
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="line"
            wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
            formatter={(value) => chartSeriesLabel(String(value))}
          />
          <Line
            yAxisId="amount"
            type="monotone"
            dataKey="revenueTarget"
            stroke="#7A37D8"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="amount"
            type="monotone"
            dataKey="revenueActual"
            stroke="#0054CA"
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
          <Line
            yAxisId="amount"
            type="monotone"
            dataKey="grossProfitActual"
            stroke="#029359"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="marginRate"
            stroke="#FF9800"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function chartSeriesLabel(value: string) {
  const labels: Record<string, string> = {
    revenueTarget: '매출 목표',
    revenueActual: '매출 실적',
    grossProfitActual: '매출총이익',
    marginRate: '이익률',
  };
  return labels[value] ?? value;
}

function formatAmountShort(value: number) {
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${Math.round(value / 100_000_000)}억`;
  if (abs >= 10_000) return `${Math.round(value / 10_000)}만`;
  return `${value}`;
}

function formatAmountFull(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value);
}
