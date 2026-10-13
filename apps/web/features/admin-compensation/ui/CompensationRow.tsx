'use client';

/**
 * CompensationRow — 보상 현황 표의 개별 <tr>.
 * semantic <table> + sticky-left 2컬럼(이름·직급) 구조. blur 시 편집 필드 일괄 upsert.
 * hr_admin 이 아니면 편집 셀 disabled(읽기 전용).
 *
 * 컬럼 순서(buildColumns 기준):
 * [0] 이름(sticky) [1] 직급(sticky)
 * [2] 입사일  [3] 근속력  [4] 전경력  [5] 총경력(월)  [6] 총경력(연월)
 * [7] 연차(년=totalCareerMonths÷12)  [8] 고려대상 열외
 * [9] 전년도연봉  [10] 금년도연봉(이전 포함)
 * [11] 조정분(편집)  [12] 제안연봉  [13] 등급전환  [14] 최종 인상률  [15] 최종 인상액
 * [16] 승격(편집)  [17] 인센티브(편집)  [18] 비고(편집)
 */

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import type { PositionDef } from '@/lib/types';
import { getPositionLabel } from '@/lib/ui';
import type { Grade } from '@/lib/types';
import type { CompensationSimulation, UpsertCompensationAdjustmentDto } from '../api';
import { COLUMNS, type ColDef } from './columns';
import { GradeTransition } from './GradeChip';

// Radix Select 는 value="" 를 허용하지 않아 "승격 없음" 을 센티넬로 표현.
const NO_PROMOTION = '__none__';

function toMoney(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${Math.round(v).toLocaleString()}원`;
}
function moneyInputToWon(s: string): number | null {
  const cleaned = s.replace(/[^\d.-]/g, '');
  if (!cleaned.trim()) return null;
  const v = Number(cleaned);
  return Number.isFinite(v) ? Math.round(v) : null;
}
function wonToInput(v: number | null): string {
  return v == null ? '' : Math.round(v).toLocaleString();
}
/** 입력 중 실시간 콤마 적용 — 숫자 외 제거 후 천단위 콤마(선두 음수 1개 보존). */
function commaLiveInput(v: string): string {
  const neg = v.trim().startsWith('-');
  const digits = v.replace(/[^\d]/g, '');
  if (digits === '') return neg ? '-' : '';
  return (neg ? '-' : '') + Number(digits).toLocaleString();
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return iso.slice(0, 10).replace(/-/g, '.');
}
/** 연차 = totalCareerMonths ÷ 12 (정수 내림). */
function calcTenureYears(totalCareerMonths: number | null | undefined): string {
  if (totalCareerMonths == null) return '—';
  return String(Math.floor(totalCareerMonths / 12));
}

interface Props {
  row: CompensationSimulation;
  rowIndex: number;
  isLast: boolean;
  cycleId: string;
  canEdit: boolean;
  positions: PositionDef[];
  /** 저장 결과를 반환(true=성공) — 행이 저장됨 표시/실패 복원을 판단한다. */
  onSave: (dto: UpsertCompensationAdjustmentDto) => Promise<boolean>;
  /** 동적 연도 라벨이 반영된 컬럼 배열 (CompensationView 에서 buildColumns 결과). */
  columns?: ColDef[];
}

type SaveState = 'idle' | 'saved' | 'error';

export function CompensationRow({ row, isLast, cycleId, canEdit, positions, onSave, columns }: Props) {
  const [adjWon,    setAdjWon]    = useState(wonToInput(row.adjustmentAmount));
  const [promotion, setPromotion] = useState(row.promotionPositionCode ?? '');
  const [incWon,    setIncWon]    = useState(wonToInput(row.incentiveAmount));
  const [note,      setNote]      = useState(row.note ?? '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 사이클 전환/대상자 교체 시 로컬 편집 상태를 서버 값으로 재동기화.
  // (부모 key 에 cycleId 포함으로 remount 되지만, props 만 바뀌는 경로도 방어 —
  //  이전 사이클 편집값이 새 사이클에 blur 저장으로 오염되는 것을 차단.)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setAdjWon(wonToInput(row.adjustmentAmount));
    setPromotion(row.promotionPositionCode ?? '');
    setIncWon(wonToInput(row.incentiveAmount));
    setNote(row.note ?? '');
    setSaveState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId, row.userId]);

  // 언마운트 시 대기 중 타이머 정리.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  const sub        = [row.divisionName, row.teamName].filter(Boolean).join(' · ') || (row.departmentName ?? '');
  const hasFinal   = row.finalProjectedSalary != null;
  const increaseAmount = row.finalProjectedSalary != null && row.currentSalary != null
    ? row.finalProjectedSalary - row.currentSalary
    : null;
  const rateTone = !hasFinal || (row.finalRaiseRate ?? 0) === 0 ? 'text-neutral-500'
    : (row.finalRaiseRate ?? 0) > 0 ? 'text-success-600' : 'text-danger-600';
  const increaseTone = increaseAmount == null ? 'text-neutral-500'
    : increaseAmount >= 0 ? 'text-success-600' : 'text-danger-600';

  async function handleBlurSave() {
    if (!canEdit) return;
    if (timer.current) clearTimeout(timer.current);
    const adjustmentAmount = moneyInputToWon(adjWon);
    const incentiveAmount = moneyInputToWon(incWon);
    setAdjWon(wonToInput(adjustmentAmount));
    setIncWon(wonToInput(incentiveAmount));

    // 무변경 blur 는 저장하지 않는다 — 셀 이동만으로 불필요한 upsert/리로드 방지.
    const changed =
      adjustmentAmount !== (row.adjustmentAmount ?? null) ||
      (promotion || null) !== (row.promotionPositionCode ?? null) ||
      incentiveAmount !== (row.incentiveAmount ?? null) ||
      (note || null) !== (row.note ?? null);
    if (!changed) return;

    timer.current = setTimeout(async () => {
      const ok = await onSave({
        cycleId, userId: row.userId,
        adjustmentAmount,
        promotionPositionCode: promotion || null,
        incentiveAmount,
        note: note || null,
      });
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (ok) {
        setSaveState('saved');
        feedbackTimer.current = setTimeout(() => setSaveState('idle'), 1500);
      } else {
        // 실패: 편집 셀 danger 보더 표시 + 서버 원값 복원(부분 저장 착시 방지).
        setSaveState('error');
        setAdjWon(wonToInput(row.adjustmentAmount));
        setPromotion(row.promotionPositionCode ?? '');
        setIncWon(wonToInput(row.incentiveAmount));
        setNote(row.note ?? '');
      }
    }, 150);
  }

  /** 편집 시작 시 이전 실패 표시 해제. */
  function clearError() {
    if (saveState === 'error') setSaveState('idle');
  }

  const COLS = columns ?? COLUMNS;
  // 열 그룹 시작 구분선 + 마지막 행 하단선 제거 — 모든 셀 공통.
  const cell = (idx: number) => ({ groupStart: !!COLS[idx]?.groupStart, rowRule: !isLast });
  const invalid = saveState === 'error' || undefined;

  return (
    <TableRow>
      {/* 0: 이름 / 본부·팀 (sticky) — 저장 성공/실패 피드백을 sticky 셀에 표시(가로 스크롤에도 보이게) */}
      <TableCell {...cell(0)} pin="start" className="left-0 whitespace-nowrap">
        <div className="flex items-center gap-1.25 text-12h font-semibold text-foreground">
          <span>{row.userName ?? '—'}</span>
          {saveState === 'saved' && (
            <span className="inline-flex items-center gap-0.5 text-10 font-semibold text-success-600">
              <CheckCircle2 className="size-2.75" aria-hidden /> 저장됨
            </span>
          )}
          {saveState === 'error' && (
            <span className="text-10 font-semibold text-danger-600">저장 실패</span>
          )}
        </div>
        {sub && <div className="mt-px text-10h text-neutral-500">{sub}</div>}
      </TableCell>

      {/* 1: 직급 (sticky) */}
      <TableCell {...cell(1)} pin="start" edgeEnd className="left-38 whitespace-nowrap text-12 text-muted-foreground">
        {row.position ? getPositionLabel(row.position, positions) : '—'}
      </TableCell>

      {/* 2: 입사일 */}
      <TableCell {...cell(2)} className="whitespace-nowrap text-11h text-muted-foreground">
        {fmtDate(row.hireDate)}
      </TableCell>

      {/* 3: 근속력(월) */}
      <TableCell {...cell(3)} textAlign="right" className="whitespace-nowrap text-12 tabular-nums text-muted-foreground">
        {row.tenureMonths ?? '—'}
      </TableCell>

      {/* 4: 전경력(월) */}
      <TableCell {...cell(4)} textAlign="right" className="whitespace-nowrap text-12 tabular-nums text-muted-foreground">
        {row.priorCareerMonths ?? '—'}
      </TableCell>

      {/* 5: 총경력(월) */}
      <TableCell {...cell(5)} textAlign="right" className="whitespace-nowrap text-12 tabular-nums text-muted-foreground">
        {row.totalCareerMonths ?? '—'}
      </TableCell>

      {/* 6: 총경력(연월) */}
      <TableCell {...cell(6)} className="whitespace-nowrap text-12 text-muted-foreground">
        {row.totalCareerLabel ?? '—'}
      </TableCell>

      {/* 7: 연차(년) — totalCareerMonths 기반 파생 */}
      <TableCell {...cell(7)} textAlign="right" className="whitespace-nowrap text-12 tabular-nums text-muted-foreground">
        {calcTenureYears(row.totalCareerMonths)}
      </TableCell>

      {/* 8: 고려대상 열외 */}
      <TableCell {...cell(8)} className="whitespace-nowrap text-11 text-warning-700">
        {row.considerationExclusion ?? <span className="text-neutral-300">—</span>}
      </TableCell>

      {/* 9: 전년도 연봉 (salary 그룹 시작) */}
      <TableCell {...cell(9)} textAlign="right" className="whitespace-nowrap text-12 tabular-nums text-muted-foreground">
        {toMoney(row.previousSalary)}
      </TableCell>

      {/* 10: 금년도 연봉 (이전 포함) */}
      <TableCell {...cell(10)} textAlign="right" className="whitespace-nowrap text-12h font-semibold tabular-nums text-foreground">
        {toMoney(row.currentSalary)}
      </TableCell>

      {/* 11: 조정분 — 편집 (compensation 그룹 시작) */}
      <TableCell {...cell(11)} textAlign="right" className="whitespace-nowrap">
        <Input
          type="text" inputMode="numeric" value={adjWon}
          onChange={(e) => { clearError(); setAdjWon(commaLiveInput(e.target.value)); }}
          onBlur={() => void handleBlurSave()}
          disabled={!canEdit} placeholder="0" title="조정분(원)" aria-invalid={invalid}
          className="h-7 text-right text-12 tabular-nums"
        />
      </TableCell>

      {/* 12: 제안연봉 */}
      <TableCell {...cell(12)} textAlign="right" className="whitespace-nowrap text-13h font-bold tabular-nums text-foreground">
        {toMoney(row.finalProjectedSalary)}
      </TableCell>

      {/* 13: 등급 전환 (작년→올해) */}
      <TableCell {...cell(13)} textAlign="center" className="whitespace-nowrap">
        <GradeTransition
          previousGrade={row.previousGrade as Grade | null}
          previousCycleYear={row.previousCycleYear}
          currentGrade={row.currentGrade as Grade | null}
          currentCycleYear={row.currentCycleYear}
        />
      </TableCell>

      {/* 14: 최종 인상률 */}
      <TableCell {...cell(14)} textAlign="right" className={`whitespace-nowrap text-12 font-semibold tabular-nums ${rateTone}`}>
        {row.finalRaiseRate != null
          ? `${row.finalRaiseRate > 0 ? '+' : ''}${row.finalRaiseRate.toFixed(2)}%`
          : '—'}
      </TableCell>

      {/* 15: 최종 인상액 */}
      <TableCell {...cell(15)} textAlign="right" className={`whitespace-nowrap text-12 font-semibold tabular-nums ${increaseTone}`}>
        {toMoney(increaseAmount)}
      </TableCell>

      {/* 16: 승격 — 편집 */}
      <TableCell {...cell(16)} className="whitespace-nowrap">
        <Select
          value={promotion || NO_PROMOTION}
          onValueChange={(v) => { clearError(); setPromotion(v === NO_PROMOTION ? '' : v); }}
          disabled={!canEdit}
        >
          <SelectTrigger size="sm" onBlur={() => void handleBlurSave()} aria-invalid={invalid} className="text-11h">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PROMOTION}>—</SelectItem>
            {positions.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>

      {/* 17: 인센티브 — 편집 */}
      <TableCell {...cell(17)} textAlign="right" className="whitespace-nowrap">
        <Input
          type="text" inputMode="numeric" value={incWon}
          onChange={(e) => { clearError(); setIncWon(commaLiveInput(e.target.value)); }}
          onBlur={() => void handleBlurSave()}
          disabled={!canEdit} placeholder="0" title="인센티브(원)" aria-invalid={invalid}
          className="h-7 text-right text-12 tabular-nums"
        />
      </TableCell>

      {/* 18: 비고 — 편집 */}
      <TableCell {...cell(18)} className="whitespace-nowrap">
        <Input
          type="text" value={note}
          onChange={(e) => { clearError(); setNote(e.target.value); }}
          onBlur={() => void handleBlurSave()}
          disabled={!canEdit} placeholder="비고" maxLength={200} aria-invalid={invalid}
          className="h-7 text-11h"
        />
      </TableCell>
    </TableRow>
  );
}
