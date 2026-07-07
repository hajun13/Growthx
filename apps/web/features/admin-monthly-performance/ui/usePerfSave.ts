'use client';

// 저장 커맨드 — 임시저장(bulk=draft 적재) / 최종저장(bulk + finalize=draft→final 확정).
// 백엔드 MonthlyPerformanceStatus(draft/final) 실배선: 집계(대시보드·등급풀)는 final만 반영된다.
// 데이터 손실 가드: ①실제 변경(dirty)된 월만 전송 — 임시저장이 확정(final)된 다른 월을
// draft 로 강등하지 않게 ②전 셀이 빈 미변경 월 미전송 — 미입력 월에 0 행 오염 방지
// ③prevYear 는 항상 전송 — 전년 칸을 비우면 백엔드가 sentinel 을 삭제(옛 값 부활 방지)
// ④서버 데이터(baseline) 로딩 전 저장 차단 — 빈 페이로드로 기존 값을 지우지 않게.
// MonthlyPerformanceView 에서 분리(파일당 ~200줄 상한).
import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { financialGridCommands } from '../hooks';
import type { BulkMonthEntry, BulkPrevYear, BulkSaveBody } from '../api';
import { MONTHS, type GridDraft, cellKey, parseNum } from './FinancialGridHelpers';

function nowLabel(): string {
  return new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** 서버 최신 상태(그리드 로드 시점) — dirty 판정 기준. null=아직 로딩 전(저장 금지). */
export interface PerfBaseline {
  draft: GridDraft;
  notes: Record<string, string>;
}

const ROW_KEYS = ['revenueTarget', 'revenueActual', 'costTarget', 'costActual'] as const;

export function usePerfSave(params: {
  cycleId?: string;
  departmentId: string;
  year?: number;
  draft: GridDraft;
  /** 행별 비고(`${월}:revenue|cost`) — bulk 페이로드에 포함. */
  notes: Record<string, string>;
  /** 서버에서 로드한 초기값 — 변경된 월만 전송하기 위한 비교 기준. */
  baseline: PerfBaseline | null;
  onSaved: () => void;
}) {
  const { cycleId, departmentId, year, draft, notes, baseline, onSaved } = params;
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function buildBulkBody(base: PerfBaseline): BulkSaveBody {
    const prevRevenueActual = parseNum(draft[cellKey('prevYear', 'revenueActual')] ?? '');
    const prevCostActual = parseNum(draft[cellKey('prevYear', 'costActual')] ?? '');
    // prevYear 는 항상 전송 — 전 칸을 모두 비우면 백엔드가 전년 sentinel 을 삭제(클리어)한다.
    // 값이 서버와 동일하면 백엔드가 변경 없음으로 판정해 아무것도 쓰지 않는다.
    // target 도 draft(서버 로드값) 그대로 왕복 — 미포함 시 백엔드 ??0 폴백이 기존 target 을 0 으로 덮는 것 방지.
    const prevYear: BulkPrevYear = {
      revenueActual: prevRevenueActual,
      costActual: prevCostActual,
      revenueTarget: parseNum(draft[cellKey('prevYear', 'revenueTarget')] ?? ''),
      costTarget: parseNum(draft[cellKey('prevYear', 'costTarget')] ?? ''),
    };

    // 실제 변경(dirty)된 월만 전송 — 건드리지 않은 월(특히 final 확정분)은 서버 상태 그대로 보존.
    const months: BulkMonthEntry[] = [];
    for (const m of MONTHS) {
      const cellsDirty = ROW_KEYS.some(
        (rk) =>
          parseNum(draft[cellKey(String(m), rk)] ?? '') !==
          parseNum(base.draft[cellKey(String(m), rk)] ?? ''),
      );
      const notesDirty = (['revenue', 'cost'] as const).some(
        (g) => (notes[`${m}:${g}`] ?? '').trim() !== (base.notes[`${m}:${g}`] ?? '').trim(),
      );
      if (!cellsDirty && !notesDirty) continue;
      months.push({
        month: m,
        revenueTarget: parseNum(draft[cellKey(String(m), 'revenueTarget')] ?? ''),
        revenueActual: parseNum(draft[cellKey(String(m), 'revenueActual')] ?? ''),
        costTarget: parseNum(draft[cellKey(String(m), 'costTarget')] ?? ''),
        costActual: parseNum(draft[cellKey(String(m), 'costActual')] ?? ''),
        revenueNote: notes[`${m}:revenue`] ?? null,
        costNote: notes[`${m}:cost`] ?? null,
      });
    }
    return { cycleId: cycleId!, departmentId, year: year!, prevYear, months };
  }

  /** 저장 가능 상태 검증 — 그리드 로딩 전 저장은 빈 페이로드가 되므로 차단. */
  function guardReady(): PerfBaseline | null {
    if (!cycleId || !departmentId || !year) return null;
    if (!baseline) {
      toast.show({ variant: 'danger', message: '데이터를 불러오는 중이에요. 잠시 후 다시 저장해 주세요.' });
      return null;
    }
    return baseline;
  }

  // 최종저장 — bulk(draft 적재) 후 finalize(draft→final 확정). 확정분만 집계에 반영.
  async function saveAll() {
    const base = guardReady();
    if (!base) return;
    setSaving(true);
    try {
      await financialGridCommands.bulk(buildBulkBody(base));
      const res = await financialGridCommands.finalize({ cycleId: cycleId!, departmentId, year: year! });
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
  // 변경한 월만 전송하므로 이미 확정(final)된 다른 월은 draft 로 강등되지 않는다.
  async function saveDraft() {
    const base = guardReady();
    if (!base) return;
    setSaving(true);
    try {
      await financialGridCommands.bulk(buildBulkBody(base));
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
