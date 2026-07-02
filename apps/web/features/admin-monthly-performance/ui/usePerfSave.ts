'use client';

// 저장 커맨드 — 임시저장(bulk=draft 적재) / 최종저장(bulk + finalize=draft→final 확정).
// 백엔드 MonthlyPerformanceStatus(draft/final) 실배선: 집계(대시보드·등급풀)는 final만 반영된다.
// MonthlyPerformanceView 에서 분리(파일당 ~200줄 상한).
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { financialGridCommands } from '../hooks';
import type { BulkMonthEntry, BulkPrevYear } from '../api';
import { MONTHS, type GridDraft, cellKey, parseNum } from './FinancialGridHelpers';

function nowLabel(): string {
  return new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function usePerfSave(params: {
  cycleId?: string;
  departmentId: string;
  year?: number;
  draft: GridDraft;
  /** 행별 비고(`${월}:revenue|cost`) — bulk 페이로드에 포함. */
  notes: Record<string, string>;
  onSaved: () => void;
}) {
  const { cycleId, departmentId, year, draft, notes, onSaved } = params;
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function buildBulkBody() {
    const prevRevenueActual = parseNum(draft[cellKey('prevYear', 'revenueActual')] ?? '');
    const prevCostActual = parseNum(draft[cellKey('prevYear', 'costActual')] ?? '');
    const prevYear: BulkPrevYear | undefined =
      prevRevenueActual !== null || prevCostActual !== null ? { revenueActual: prevRevenueActual, costActual: prevCostActual } : undefined;
    const months: BulkMonthEntry[] = MONTHS.map((m) => ({
      month: m,
      revenueTarget: parseNum(draft[cellKey(String(m), 'revenueTarget')] ?? ''),
      revenueActual: parseNum(draft[cellKey(String(m), 'revenueActual')] ?? ''),
      costTarget: parseNum(draft[cellKey(String(m), 'costTarget')] ?? ''),
      costActual: parseNum(draft[cellKey(String(m), 'costActual')] ?? ''),
      revenueNote: notes[`${m}:revenue`] ?? null,
      costNote: notes[`${m}:cost`] ?? null,
    }));
    return { cycleId: cycleId!, departmentId, year: year!, prevYear, months };
  }

  // 최종저장 — bulk(draft 적재) 후 finalize(draft→final 확정). 확정분만 집계에 반영.
  async function saveAll() {
    if (!cycleId || !departmentId || !year) return;
    setSaving(true);
    try {
      await financialGridCommands.bulk(buildBulkBody());
      const res = await financialGridCommands.finalize({ cycleId, departmentId, year });
      setSavedAt(nowLabel());
      toast.show({ variant: 'success', message: `경영실적을 최종저장했어요. (확정 ${res.finalizedCount}건)` });
      onSaved();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '저장에 실패했어요.' });
    } finally {
      setSaving(false);
    }
  }

  // 임시저장 — bulk 만 호출(status=draft 적재). 새로고침해도 유지되고, 집계에는 미반영.
  async function saveDraft() {
    if (!cycleId || !departmentId || !year) return;
    setSaving(true);
    try {
      await financialGridCommands.bulk(buildBulkBody());
      setSavedAt(nowLabel());
      toast.show({ variant: 'success', message: '임시저장했어요. (최종저장 전까지 집계에 반영되지 않아요)' });
      onSaved();
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof ApiError ? err.message : '임시저장에 실패했어요.' });
    } finally {
      setSaving(false);
    }
  }

  return { saving, savedAt, saveAll, saveDraft };
}
