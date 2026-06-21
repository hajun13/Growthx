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
 *
 * ~200줄 파일상한 준수.
 */

import { useRef, useState } from 'react';
import type { PositionDef } from '@/lib/types';
import { getPositionLabel } from '@/lib/ui';
import type { Grade } from '@/lib/types';
import type { CompensationSimulation, UpsertCompensationAdjustmentDto } from '../api';
import { COLUMNS, stickyLeft, GROUP_DIVIDER, type ColDef } from './columns';
import { GradeTransition } from './GradeChip';

// 색 토큰 — Tailwind 클래스로 직접 사용. 인라인 스타일에서 부득이 쓸 경우 DESIGN.md 시맨틱 토큰을 참조.
const COLOR = {
  onSurface:       '#18181C', // neutral-950 / text-foreground
  outlineVariant:  '#CCCCD4', // neutral-300 / border-border
  muted:           '#565660', // neutral-600 / text-muted-foreground
  subtle:          '#74747F', // neutral-500
} as const;

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
  onSave: (dto: UpsertCompensationAdjustmentDto) => Promise<void>;
  /** 동적 연도 라벨이 반영된 컬럼 배열 (CompensationView 에서 buildColumns 결과). */
  columns?: ColDef[];
}

export function CompensationRow({ row, rowIndex, isLast, cycleId, canEdit, positions, onSave, columns }: Props) {
  const [adjWon,    setAdjWon]    = useState(wonToInput(row.adjustmentAmount));
  const [promotion, setPromotion] = useState(row.promotionPositionCode ?? '');
  const [incWon,    setIncWon]    = useState(wonToInput(row.incentiveAmount));
  const [note,      setNote]      = useState(row.note ?? '');
  const [saving,    setSaving]    = useState(false);
  const [hovered,   setHovered]   = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sub        = [row.divisionName, row.teamName].filter(Boolean).join(' · ') || (row.departmentName ?? '');
  const hasFinal   = row.finalProjectedSalary != null;
  const increaseAmount = row.finalProjectedSalary != null && row.currentSalary != null
    ? row.finalProjectedSalary - row.currentSalary
    : null;
  const rateColor  = !hasFinal || (row.finalRaiseRate ?? 0) === 0 ? COLOR.subtle
    : (row.finalRaiseRate ?? 0) > 0 ? '#128240' : '#C8353A';

  async function handleBlurSave() {
    if (!canEdit) return;
    if (timer.current) clearTimeout(timer.current);
    const adjustmentAmount = moneyInputToWon(adjWon);
    const incentiveAmount = moneyInputToWon(incWon);
    setAdjWon(wonToInput(adjustmentAmount));
    setIncWon(wonToInput(incentiveAmount));
    timer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await onSave({
          cycleId, userId: row.userId,
          adjustmentAmount,
          promotionPositionCode: promotion || null,
          incentiveAmount,
          note: note || null,
        });
      } finally { setSaving(false); }
    }, 150);
  }

  const COLS       = columns ?? COLUMNS;
  const border     = isLast ? 'none' : '1px solid #ECECF1';
  const baseRowBg  = rowIndex % 2 === 0 ? '#FFFFFF' : '#FCFCFD';
  const rowBg      = hovered ? '#F4F2FA' : baseRowBg;

  /** 일반 td 기본 스타일 */
  const td = (idx: number, extra?: React.CSSProperties): React.CSSProperties => ({
    borderBottom: border,
    background: rowBg,
    padding: '10px 12px',
    whiteSpace: 'nowrap',
    transition: 'background .1s',
    minWidth: COLS[idx]?.width,
    ...(COLS[idx]?.groupStart ? { borderLeft: `2px solid ${GROUP_DIVIDER}` } : {}),
    ...extra,
  });

  /** 수치 td */
  const tdN = (idx: number, extra?: React.CSSProperties): React.CSSProperties =>
    td(idx, { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit', ...extra });

  /** sticky td */
  const stickyTd = (idx: number): React.CSSProperties => ({
    ...td(idx),
    position: 'sticky',
    left: stickyLeft(idx),
    zIndex: 1,
    background: hovered ? '#F7F7F9' : '#FFFFFF',
    boxShadow: idx === 1 ? '2px 0 8px rgba(14,14,20,0.06)' : undefined,
  });

  // 편집 셀 래퍼 — active 시 블루 50 틴트 배경 + border-border 외곽.
  const editCell: React.CSSProperties = {
    background: canEdit ? '#FFFFFF' : 'transparent',
    border: canEdit ? `1px solid ${COLOR.outlineVariant}` : '1px solid transparent',
    borderRadius: 4, padding: '2px 4px',
  };
  const inputNum: React.CSSProperties = {
    fontSize: 12, color: saving ? '#A0A0AC' : COLOR.onSurface,
    background: 'transparent', border: 'none', outline: 'none',
    width: '100%', textAlign: 'right', cursor: canEdit ? 'text' : 'default',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>

      {/* 0: 이름 / 본부·팀 (sticky) */}
      <td style={stickyTd(0)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: COLOR.onSurface }}>
          <span>{row.userName ?? '—'}</span>
        </div>
        {sub && <div style={{ fontSize: 10.5, color: COLOR.subtle, marginTop: 1 }}>{sub}</div>}
      </td>

      {/* 1: 직급 (sticky) */}
      <td style={{ ...stickyTd(1), fontSize: 12, color: COLOR.muted }}>
        {row.position ? getPositionLabel(row.position, positions) : '—'}
      </td>

      {/* 2: 입사일 */}
      <td style={td(2, { fontSize: 11.5, color: COLOR.muted })}>
        {fmtDate(row.hireDate)}
      </td>

      {/* 3: 근속력(월) */}
      <td style={tdN(3, { fontSize: 12, color: COLOR.muted })}>
        {row.tenureMonths ?? '—'}
      </td>

      {/* 4: 전경력(월) */}
      <td style={tdN(4, { fontSize: 12, color: COLOR.muted })}>
        {row.priorCareerMonths ?? '—'}
      </td>

      {/* 5: 총경력(월) */}
      <td style={tdN(5, { fontSize: 12, color: COLOR.muted })}>
        {row.totalCareerMonths ?? '—'}
      </td>

      {/* 6: 총경력(연월) */}
      <td style={td(6, { fontSize: 12, color: COLOR.muted })}>
        {row.totalCareerLabel ?? '—'}
      </td>

      {/* 7: 연차(년) — totalCareerMonths 기반 파생 */}
      <td style={tdN(7, { fontSize: 12, color: COLOR.muted })}>
        {calcTenureYears(row.totalCareerMonths)}
      </td>

      {/* 8: 고려대상 열외 */}
      <td style={td(8, { fontSize: 11, color: '#9A6103' })}>
        {row.considerationExclusion ?? <span style={{ color: COLOR.outlineVariant }}>—</span>}
      </td>

      {/* 9: 전년도 연봉 (salary 그룹 시작) */}
      <td style={tdN(9, { fontSize: 12, color: COLOR.muted })}>
        {toMoney(row.previousSalary)}
      </td>

      {/* 10: 금년도 연봉 (이전 포함) */}
      <td style={tdN(10, { fontSize: 12.5, fontWeight: 600, color: COLOR.onSurface })}>
        {toMoney(row.currentSalary)}
      </td>

      {/* 11: 조정분 — 편집 (compensation 그룹 시작) */}
      <td style={tdN(11)}>
        <div style={editCell}>
          <input type="text" inputMode="numeric" style={inputNum} value={adjWon}
            onChange={(e) => setAdjWon(e.target.value)}
            onBlur={() => void handleBlurSave()}
            disabled={!canEdit} placeholder="0" title="조정분(원)" />
        </div>
      </td>

      {/* 12: 제안연봉 */}
      <td style={tdN(12, { fontSize: 13.5, fontWeight: 700, color: COLOR.onSurface })}>
        {toMoney(row.finalProjectedSalary)}
      </td>

      {/* 13: 등급 전환 (작년→올해) */}
      <td style={td(13, { textAlign: 'center' })}>
        <GradeTransition
          previousGrade={row.previousGrade as Grade | null}
          previousCycleYear={row.previousCycleYear}
          currentGrade={row.currentGrade as Grade | null}
          currentCycleYear={row.currentCycleYear}
        />
      </td>

      {/* 14: 최종 인상률 */}
      <td style={tdN(14, { fontSize: 12, fontWeight: 600, color: rateColor })}>
        {row.finalRaiseRate != null
          ? `${row.finalRaiseRate > 0 ? '+' : ''}${row.finalRaiseRate.toFixed(1)}%`
          : '—'}
      </td>

      {/* 15: 최종 인상액 */}
      <td style={tdN(15, { fontSize: 12, fontWeight: 600, color: increaseAmount == null ? COLOR.subtle : increaseAmount >= 0 ? '#128240' : '#C8353A' })}>
        {toMoney(increaseAmount)}
      </td>

      {/* 16: 승격 — 편집 */}
      <td style={td(16)}>
        <div style={{ ...editCell, padding: '1px 2px' }}>
          <select style={{ fontSize: 11.5, color: COLOR.onSurface, background: 'transparent', border: 'none', width: '100%', cursor: canEdit ? 'pointer' : 'default' }}
            value={promotion} onChange={(e) => setPromotion(e.target.value)}
            onBlur={() => void handleBlurSave()} disabled={!canEdit}>
            <option value="">—</option>
            {positions.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </div>
      </td>

      {/* 17: 인센티브 — 편집 */}
      <td style={tdN(17)}>
        <div style={editCell}>
          <input type="text" inputMode="numeric" style={inputNum} value={incWon}
            onChange={(e) => setIncWon(e.target.value)}
            onBlur={() => void handleBlurSave()}
            disabled={!canEdit} placeholder="0" title="인센티브(원)" />
        </div>
      </td>

      {/* 18: 비고 — 편집 */}
      <td style={td(18)}>
        <div style={{ ...editCell, padding: '2px 4px' }}>
          <input type="text"
            style={{ fontSize: 11.5, color: COLOR.onSurface, background: 'transparent', border: 'none', outline: 'none', width: '100%', cursor: canEdit ? 'text' : 'default' }}
            value={note} onChange={(e) => setNote(e.target.value)}
            onBlur={() => void handleBlurSave()}
            disabled={!canEdit} placeholder="비고" maxLength={200} />
        </div>
      </td>

    </tr>
  );
}
