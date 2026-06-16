'use client';

/**
 * 경영실적(월별 손익) 입력 화면 — 엑셀 양식 그리드.
 * 기존 카테고리별 카드·차트 폐기 → 4행×15열 그리드로 교체.
 * 데이터 흐름: useFinancialGrid(조회) → draft 편집 → financialGridCommands.bulk(저장).
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Info, Save } from 'lucide-react';
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

// ── Kinetic Enterprise 팔레트 ────────────────────────────────────
const K = {
  secondary: '#7A37D8',
  surfaceLow: '#efeff2',
  onSurface: '#18181c',
  onSurfaceVariant: '#565660',
  outlineVariant: '#ccccd4',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

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

  const deptOptions = useMemo(() => {
    const groups = (groupDepts?.data ?? []).map((d) => ({ value: d.id, label: `${d.name} (그룹)` }));
    let divisions = (divisionDepts?.data ?? []).map((d) => ({ value: d.id, label: `${d.name} (본부)` }));
    if (isDivisionHead && user?.departmentId) {
      divisions = divisions.filter((o) => o.value === user.departmentId);
    }
    return isDivisionHead ? divisions : [...groups, ...divisions];
  }, [groupDepts, divisionDepts, isDivisionHead, user?.departmentId]);

  const [departmentId, setDepartmentId] = useState<string>('');
  useEffect(() => {
    if (!departmentId && deptOptions.length > 0) setDepartmentId(deptOptions[0].value);
  }, [deptOptions, departmentId]);

  // 그리드 조회
  const { data: gridData, loading: gridLoading, error, reload } = useFinancialGrid(
    { cycleId, departmentId, year },
    { enabled: allowed && !!cycleId && !!departmentId && !!year },
  );

  // draft: 그리드 편집 상태(colKey:rowKey → 입력 문자열)
  const [draft, setDraft] = useState<GridDraft>({});
  const [saving, setSaving] = useState(false);

  // 서버 데이터 도착 시 draft 초기화
  useEffect(() => {
    if (gridData?.columns) {
      setDraft(columnsToInitDraft(gridData.columns));
    }
  }, [gridData]);

  // 부서/주기 변경 시 draft 리셋
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

  // dirty 감지: draft vs 서버 원본 비교
  const dirty = useMemo(() => {
    if (!gridData?.columns) return false;
    const init = columnsToInitDraft(gridData.columns);
    for (const [k, v] of Object.entries(draft)) {
      if ((init[k] ?? '') !== (v ?? '')) return true;
    }
    return false;
  }, [draft, gridData]);

  async function saveAll() {
    if (!cycleId || !departmentId || !year) return;
    setSaving(true);
    try {
      // 전년 참고값(prevYear 열, 실적만)
      const prevRevenueActual = parseNum(draft[cellKey('prevYear', 'revenueActual')] ?? '');
      const prevCostActual = parseNum(draft[cellKey('prevYear', 'costActual')] ?? '');
      const prevYear: BulkPrevYear | undefined =
        prevRevenueActual !== null || prevCostActual !== null
          ? { revenueActual: prevRevenueActual, costActual: prevCostActual }
          : undefined;

      // 1~12월 매출/원가
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
        subtitle="엑셀 양식(2025년 경영실적) 기반 그리드. 매출·원가 입력 → 매출총이익·이익율·년계 자동계산."
        cycles={cycles.length > 1 ? cycles : undefined}
        selectedId={selectedId}
        onSelectCycle={setSelectedId}
        right={
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: K.onSurfaceVariant,
              background: K.surfaceLow,
              border: `1px solid ${K.outlineVariant}`,
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            기준 {year}년
          </span>
        }
      />

      {/* 부서 선택 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 12, fontWeight: 600, color: K.onSurfaceVariant }}>대상 부서</span>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            style={{
              fontSize: 13,
              color: K.onSurface,
              background: '#fff',
              border: `1px solid ${K.outlineVariant}`,
              padding: '8px 12px',
              minWidth: 200,
              outline: 'none',
              borderRadius: 8,
            }}
          >
            {deptOptions.length === 0 && <option value="">부서 없음</option>}
            {deptOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(122,55,216,0.06)', border: '1px solid rgba(122,55,216,0.15)' }}
        >
          <Info size={13} color={K.secondary} />
          <span style={{ fontSize: 12, color: K.onSurfaceVariant }}>
            매출·원가(목표/실적) 입력 → 매출총이익·이익율·년계 자동 계산. 엑셀 블록 복붙 지원.
            {!canEdit && ' (조회 전용)'}
          </span>
        </div>
      </div>

      {!departmentId ? (
        <div
          className="rounded-xl bg-white p-5"
          style={{ border: `1px solid ${K.outlineVariant}`, boxShadow: CARD_SHADOW }}
        >
          <EmptyState title="대상 부서를 선택해 주세요." />
        </div>
      ) : (
        <div
          className="bg-white rounded-xl overflow-hidden"
          style={{ border: `1px solid ${K.outlineVariant}`, boxShadow: CARD_SHADOW }}
        >
          {/* 그리드 헤더 */}
          <div
            className="flex items-center gap-3 px-5 py-3"
            style={{ background: K.surfaceLow, borderBottom: '1px solid #e3e3e8' }}
          >
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: K.onSurface }}>
                {year}년 계획 및 달성 — {gridData?.departmentName ?? '…'}
              </h3>
              <p style={{ fontSize: 12, color: K.onSurfaceVariant, marginTop: 1 }}>
                셀을 직접 입력하거나 엑셀에서 복사하여 붙여넣을 수 있어요. (전년 열은 연간 실적만 입력)
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                disabled={saving || !dirty}
                onClick={() => void saveAll()}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 text-white disabled:opacity-50 rounded-lg"
                style={{ fontSize: 13, fontWeight: 600, background: K.secondary }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                저장
              </button>
            )}
          </div>

          {/* 그리드 본체 */}
          {gridLoading ? (
            <div className="p-5">
              <Skeleton className="h-72 w-full" />
            </div>
          ) : error ? (
            <div className="p-5">
              <ErrorState onRetry={reload} />
            </div>
          ) : !gridData ? (
            <div className="p-5">
              <EmptyState title="데이터를 불러올 수 없어요." />
            </div>
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
          <div
            className="px-5 py-2.5 flex flex-wrap gap-x-4 gap-y-1"
            style={{ borderTop: '1px solid #e3e3e8', background: K.surfaceLow }}
          >
            <span style={{ fontSize: 11, color: K.onSurfaceVariant }}>
              매출총이익 = 매출 − 원가 (자동)
            </span>
            <span style={{ fontSize: 11, color: K.onSurfaceVariant }}>
              이익율 = 이익 ÷ 매출 × 100 (매출 0이면 '-')
            </span>
            <span style={{ fontSize: 11, color: K.onSurfaceVariant }}>
              년계 = 1~12월 합계 (자동). 전년은 연간 단일값.
            </span>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
