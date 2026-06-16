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
 * [9] 전년도연봉  [10] 이전제외A  [11] 이전포함B  [12] 증감(B-A)
 * [13] 조정분(편집)  [14] 제안연봉  [15] 등급전환  [16] 인상률
 * [17] 승격(편집)  [18] 인센티브(편집)  [19] 비고(편집)
 *
 * ~200줄 파일상한 준수.
 */

import { useRef, useState } from 'react';
import type { PositionDef } from '@/lib/types';
import { getPositionLabel } from '@/lib/ui';
import { tierLabel } from '@/lib/ui';
import type { Grade, GroupTier } from '@/lib/types';
import type { CompensationSimulation, UpsertCompensationAdjustmentDto } from '../api';
import { COLUMNS, stickyLeft, GROUP_DIVIDER, type ColDef } from './columns';
import { GradeTransition } from './GradeChip';

const K = {
  onSurface: '#18181c',
  outlineVariant: '#ccccd4',
  secondary: '#7A37D8',
  muted: '#565660',
  subtle: '#74747f',
} as const;

const tierBadge: Record<GroupTier, { bg: string; fg: string }> = {
  excellent: { bg: '#e9f8ef', fg: '#128240' },
  standard:  { bg: '#efeff2', fg: '#565660' },
  poor:      { bg: '#fef5e7', fg: '#9a6103' },
};

function toManwon(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${Math.round(v / 10000).toLocaleString()}만`;
}
function wanToWon(s: string): number | null {
  const v = parseFloat(s.replace(/,/g, ''));
  return isNaN(v) ? null : Math.round(v * 10000);
}
function wonToWan(v: number | null): string {
  return v == null ? '' : String(Math.round(v / 10000));
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
  isLast: boolean;
  cycleId: string;
  canEdit: boolean;
  positions: PositionDef[];
  onSave: (dto: UpsertCompensationAdjustmentDto) => Promise<void>;
  /** 동적 연도 라벨이 반영된 컬럼 배열 (CompensationView 에서 buildColumns 결과). */
  columns?: ColDef[];
}

export function CompensationRow({ row, isLast, cycleId, canEdit, positions, onSave, columns }: Props) {
  const [adjWan,    setAdjWan]    = useState(wonToWan(row.adjustmentAmount));
  const [promotion, setPromotion] = useState(row.promotionPositionCode ?? '');
  const [incWan,    setIncWan]    = useState(wonToWan(row.incentiveAmount));
  const [note,      setNote]      = useState(row.note ?? '');
  const [saving,    setSaving]    = useState(false);
  const [hovered,   setHovered]   = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sub        = [row.divisionName, row.teamName].filter(Boolean).join(' · ') || (row.departmentName ?? '');
  const salaryA    = row.currentSalaryExclTransfer ?? row.currentSalary;
  const diffBA     = row.salaryDiffBA;
  const diffColor  = diffBA == null || diffBA === 0 ? K.subtle : diffBA > 0 ? '#128240' : '#c8353a';
  const hasFinal   = row.finalProjectedSalary != null;
  const rateColor  = !hasFinal || (row.finalRaiseRate ?? 0) === 0 ? K.subtle
    : (row.finalRaiseRate ?? 0) > 0 ? '#128240' : '#c8353a';

  async function handleBlurSave() {
    if (!canEdit) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await onSave({
          cycleId, userId: row.userId,
          adjustmentAmount: wanToWon(adjWan),
          promotionPositionCode: promotion || null,
          incentiveAmount: wanToWon(incWan),
          note: note || null,
        });
      } finally { setSaving(false); }
    }, 150);
  }

  const COLS       = columns ?? COLUMNS;
  const border     = isLast ? 'none' : '1px solid rgba(204,204,212,0.2)';
  const rowBg      = hovered ? '#f7f7f9' : 'transparent';

  /** 일반 td 기본 스타일 */
  const td = (idx: number, extra?: React.CSSProperties): React.CSSProperties => ({
    borderBottom: border,
    background: rowBg,
    padding: '9px 10px',
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
    background: hovered ? '#f7f7f9' : '#fff',
    boxShadow: idx === 1 ? '2px 0 8px rgba(0,0,0,0.06)' : undefined,
  });

  const editCell: React.CSSProperties = {
    background: canEdit ? 'rgba(122,55,216,0.04)' : 'transparent',
    border: canEdit ? `1px solid ${K.outlineVariant}` : '1px solid transparent',
    borderRadius: 4, padding: '2px 4px',
  };
  const inputNum: React.CSSProperties = {
    fontSize: 12, color: saving ? '#a0a0ac' : K.onSurface,
    background: 'transparent', border: 'none', outline: 'none',
    width: '100%', textAlign: 'right', cursor: canEdit ? 'text' : 'default',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <tr onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>

      {/* 0: 이름 / 본부·팀 (sticky) */}
      <td style={stickyTd(0)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: K.onSurface }}>
          <span>{row.userName ?? '—'}</span>
          {row.groupTier && (
            <span title={`그룹 ${tierLabel[row.groupTier as GroupTier]} · +${row.groupTierBonus}%p`}
              style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                background: tierBadge[row.groupTier as GroupTier].bg,
                color: tierBadge[row.groupTier as GroupTier].fg }}>
              {tierLabel[row.groupTier as GroupTier]}
              {row.groupTierBonus !== 0 ? ` ${row.groupTierBonus > 0 ? '+' : ''}${row.groupTierBonus}%p` : ''}
            </span>
          )}
        </div>
        {sub && <div style={{ fontSize: 10.5, color: K.subtle, marginTop: 1 }}>{sub}</div>}
      </td>

      {/* 1: 직급 (sticky) */}
      <td style={{ ...stickyTd(1), fontSize: 12, color: '#565660' }}>
        {row.position ? getPositionLabel(row.position, positions) : '—'}
      </td>

      {/* 2: 입사일 */}
      <td style={td(2, { fontSize: 11.5, color: '#565660' })}>
        {fmtDate(row.hireDate)}
      </td>

      {/* 3: 근속력(월) */}
      <td style={tdN(3, { fontSize: 12, color: K.muted })}>
        {row.tenureMonths ?? '—'}
      </td>

      {/* 4: 전경력(월) */}
      <td style={tdN(4, { fontSize: 12, color: K.muted })}>
        {row.priorCareerMonths ?? '—'}
      </td>

      {/* 5: 총경력(월) */}
      <td style={tdN(5, { fontSize: 12, color: K.muted })}>
        {row.totalCareerMonths ?? '—'}
      </td>

      {/* 6: 총경력(연월) */}
      <td style={td(6, { fontSize: 12, color: '#565660' })}>
        {row.totalCareerLabel ?? '—'}
      </td>

      {/* 7: 연차(년) — totalCareerMonths 기반 파생 */}
      <td style={tdN(7, { fontSize: 12, color: K.muted })}>
        {calcTenureYears(row.totalCareerMonths)}
      </td>

      {/* 8: 고려대상 열외 */}
      <td style={td(8, { fontSize: 11, color: '#9a6103' })}>
        {row.considerationExclusion ?? <span style={{ color: K.outlineVariant }}>—</span>}
      </td>

      {/* 9: 전년도 연봉 (salary 그룹 시작) */}
      <td style={tdN(9, { fontSize: 12, color: K.muted })}>
        {toManwon(row.previousSalary)}
      </td>

      {/* 10: 25년도(이전제외A) */}
      <td style={tdN(10, { fontSize: 12, color: '#565660' })}>
        {toManwon(salaryA)}
      </td>

      {/* 11: 금년도(이전포함B) */}
      <td style={tdN(11, { fontSize: 12.5, fontWeight: 600, color: K.onSurface })}>
        {toManwon(row.currentSalary)}
      </td>

      {/* 12: 증감(B-A) */}
      <td style={tdN(12, { fontSize: 12, fontWeight: 600, color: diffColor })}>
        {diffBA == null ? '—' : `${diffBA > 0 ? '+' : ''}${toManwon(diffBA)}`}
      </td>

      {/* 13: 조정분(만원) — 편집 (compensation 그룹 시작) */}
      <td style={tdN(13)}>
        <div style={editCell}>
          <input type="number" style={inputNum} value={adjWan}
            onChange={(e) => setAdjWan(e.target.value)}
            onBlur={() => void handleBlurSave()}
            disabled={!canEdit} placeholder="0" title="조정분(만원)" />
        </div>
      </td>

      {/* 14: 제안연봉 */}
      <td style={tdN(14, { fontSize: 13.5, fontWeight: 700, color: K.onSurface })}>
        {toManwon(row.finalProjectedSalary)}
      </td>

      {/* 15: 등급 전환 (작년→올해) */}
      <td style={td(15, { textAlign: 'center' })}>
        <GradeTransition
          previousGrade={row.previousGrade as Grade | null}
          previousCycleYear={row.previousCycleYear}
          currentGrade={row.currentGrade as Grade | null}
          currentCycleYear={row.currentCycleYear}
        />
      </td>

      {/* 16: 인상률 */}
      <td style={tdN(16, { fontSize: 12, fontWeight: 600, color: rateColor })}>
        {row.finalRaiseRate != null
          ? `${row.finalRaiseRate > 0 ? '+' : ''}${row.finalRaiseRate.toFixed(1)}%`
          : '—'}
      </td>

      {/* 17: 승격 — 편집 */}
      <td style={td(17)}>
        <div style={{ ...editCell, padding: '1px 2px' }}>
          <select style={{ fontSize: 11.5, color: K.onSurface, background: 'transparent', border: 'none', width: '100%', cursor: canEdit ? 'pointer' : 'default' }}
            value={promotion} onChange={(e) => setPromotion(e.target.value)}
            onBlur={() => void handleBlurSave()} disabled={!canEdit}>
            <option value="">—</option>
            {positions.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </div>
      </td>

      {/* 18: 인센티브(만원) — 편집 */}
      <td style={tdN(18)}>
        <div style={editCell}>
          <input type="number" style={inputNum} value={incWan}
            onChange={(e) => setIncWan(e.target.value)}
            onBlur={() => void handleBlurSave()}
            disabled={!canEdit} placeholder="0" min={0} title="인센티브(만원)" />
        </div>
      </td>

      {/* 19: 비고 — 편집 */}
      <td style={td(19)}>
        <div style={{ ...editCell, padding: '2px 4px' }}>
          <input type="text"
            style={{ fontSize: 11.5, color: K.onSurface, background: 'transparent', border: 'none', outline: 'none', width: '100%', cursor: canEdit ? 'text' : 'default' }}
            value={note} onChange={(e) => setNote(e.target.value)}
            onBlur={() => void handleBlurSave()}
            disabled={!canEdit} placeholder="비고" maxLength={200} />
        </div>
      </td>

    </tr>
  );
}
