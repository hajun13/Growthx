/**
 * 보상 현황 출력(새 창) HTML 빌더 + 표 공용 표시 헬퍼.
 * CompensationView 에서 분리(파일 상한) — 로직은 그대로.
 */

import { getPositionLabel } from '@/lib/ui';
import type { PositionDef } from '@/lib/types';
import type { CompensationSimulation } from '../api';
import type { ColDef } from './columns';
import { GRADE_SYSTEM_START_YEAR } from './GradeChip';

// 출력용: 금액을 원 단위 끝자리까지 표시.
export function printMoney(v: number | null | undefined): string {
  return v == null ? '—' : `${Math.round(v).toLocaleString()}원`;
}

// 출력(새 창) HTML 이스케이프 — 비고 등 사용자 입력이 마크업으로 해석되는 것 차단.
function escapeHtml(v: string | number | null | undefined): string {
  if (v == null) return '—';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** null 은 마지막으로 보내는 수치 합계(전부 null 이면 null). */
export function sumOf(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v != null);
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
}

function fmtDate(iso: string | null): string {
  return iso ? iso.slice(0, 10).replace(/-/g, '.') : '—';
}

function calcTenureYears(totalCareerMonths: number | null | undefined): string {
  if (totalCareerMonths == null) return '—';
  return String(Math.floor(totalCareerMonths / 12));
}

function printGradeTransition(
  prevGrade: string | null | undefined,
  prevYear: number | null | undefined,
  curGrade: string | null | undefined,
): string {
  const prev = prevGrade ?? (prevYear != null && prevYear < GRADE_SYSTEM_START_YEAR ? '도입전' : null);
  const curr = curGrade ?? null;
  if (!prev && !curr) return '—';
  return `${escapeHtml(prev)} → ${escapeHtml(curr)}`;
}

/** 새 창을 열어 현재 필터 결과 표를 출력한다. */
export function printCompensation(
  columns: ColDef[],
  rows: CompensationSimulation[],
  positions: PositionDef[],
): void {
  const win = window.open('', '_blank', 'width=1600,height=900');
  if (!win) return;

  const thd = columns.map((c) =>
    `<th>${c.label}${c.sub ? `<br/><small>${c.sub}</small>` : ''}</th>`
  ).join('');

  // 동적 문자열은 전부 escapeHtml 경유 — 비고 등 사용자 입력이 출력 문서에서 HTML 로 해석되지 않게.
  const body = rows.map((r) => {
    const pos       = r.position ? getPositionLabel(r.position, positions) : '—';
    const promLabel = r.promotionPositionCode
      ? (positions.find((p) => p.code === r.promotionPositionCode)?.label ?? r.promotionPositionCode)
      : '—';
    const rate      = r.finalRaiseRate != null ? `${r.finalRaiseRate > 0 ? '+' : ''}${r.finalRaiseRate.toFixed(2)}%` : '—';
    const raiseAmount = r.finalProjectedSalary != null && r.currentSalary != null
      ? printMoney(r.finalProjectedSalary - r.currentSalary)
      : '—';
    const adj       = r.adjustmentAmount != null ? printMoney(r.adjustmentAmount) : '—';
    const inc       = r.incentiveAmount  != null ? printMoney(r.incentiveAmount)  : '—';
    const gradeCell = printGradeTransition(r.previousGrade, r.previousCycleYear, r.currentGrade);
    const tenureYrs = calcTenureYears(r.totalCareerMonths);

    return `<tr>
        <td>${escapeHtml(r.userName)}<br/><small>${escapeHtml([r.divisionName, r.teamName].filter(Boolean).join(' · '))}</small></td>
        <td>${escapeHtml(pos)}</td>
        <td>${fmtDate(r.hireDate)}</td>
        <td>${escapeHtml(r.tenureMonths)}</td>
        <td>${escapeHtml(r.priorCareerMonths)}</td>
        <td>${escapeHtml(r.totalCareerMonths)}</td>
        <td>${escapeHtml(r.totalCareerLabel)}</td>
        <td>${escapeHtml(tenureYrs)}</td>
        <td>${escapeHtml(r.considerationExclusion)}</td>
        <td>${printMoney(r.previousSalary)}</td>
        <td>${printMoney(r.currentSalary)}</td>
        <td>${adj}</td>
        <td><b>${printMoney(r.finalProjectedSalary)}</b></td>
        <td>${gradeCell}</td>
        <td>${rate}</td>
        <td>${raiseAmount}</td>
        <td>${escapeHtml(promLabel)}</td>
        <td>${inc}</td>
        <td>${escapeHtml(r.note)}</td>
      </tr>`;
  }).join('');

  win.document.write(`<!DOCTYPE html><html><head><title>보상 현황</title>
      <style>
        body { font-family: Pretendard, sans-serif; padding: 20px; font-size: 10px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #e3e3e8; padding: 5px 8px; }
        th { background: #f7f7f9; font-weight: 600; white-space: nowrap; }
        small { color: #6B6980; }
        b { color: #111111; }
        .grp { border-left: 2px solid #D8DCEB; }
      </style>
    </head><body>
      <h2 style="margin-bottom:12px;font-size:14px">에너지엑스 차기년도 보상 현황</h2>
      <table><thead><tr>${thd}</tr></thead><tbody>${body}</tbody></table>
    </body></html>`);
  win.document.close();
  win.print();
}
