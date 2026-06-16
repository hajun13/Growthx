'use client';

/**
 * 경영실적 그리드(엑셀 "2025년 경영실적" 양식과 동일 레이아웃).
 * 헤더 = [구분][2024년][1~12월(목표/실적)][년계(목표/실적)] 병합 2단.
 * 본문 4행 = 매출·원가(입력) / 매출총이익·매출총이익율(자동) = FinancialRow.
 * TSV 복붙(handlePaste): 시작 셀 인덱스 기준 오른쪽(목표→실적→다음 월)·아래(매출→원가)로 채움.
 */
import React, { useRef } from 'react';
import type { FinancialGridColumn } from '../api';
import {
  MONTHS,
  EDIT_TOP_ROWS,
  type GridDraft,
  type RowKey,
  type TopRow,
  cellKey,
  parseTsv,
  normalizePasteNum,
  editableCellsFor,
} from './FinancialGridHelpers';
import { K, TH } from './FinancialGridStyles';
import { FinancialRow, type RowDef, type CellInteract } from './FinancialGridRows';
import { useFinancialSelection } from './useFinancialSelection';

interface Props {
  columns: FinancialGridColumn[];
  draft: GridDraft;
  canEdit: boolean;
  onChange: (colKey: string, rowKey: RowKey, value: string) => void;
  onDraftChange: (patches: { colKey: string; rowKey: RowKey; value: string }[]) => void;
}

// 본문 4행 정의(엑셀 행 순서). headBg 는 **불투명**이어야 가로 스크롤 시 데이터가 비치지 않음.
const ROW_DEFS: RowDef[] = [
  { kind: 'revenue', label: '매출', accent: K.secondary, headBg: '#eaf1fe' },
  { kind: 'cost', label: '원가', accent: K.primary, headBg: '#f7f7f9' },
  { kind: 'gross', label: '매출총이익', accent: K.tertiary, headBg: '#e9f8ef' },
  { kind: 'margin', label: '매출총이익율', accent: K.tertiary, headBg: '#f7f7f9' },
];

const topRowOf = (rk: RowKey): TopRow => (rk.startsWith('revenue') ? 'revenue' : 'cost');

export function FinancialGrid({ columns, draft, canEdit, onChange, onDraftChange }: Props) {
  const tableRef = useRef<HTMLTableElement | null>(null);
  const { isSelected, startSel, extendSel, handleKeyDown } = useFinancialSelection(
    onDraftChange,
    tableRef,
  );
  const interact: CellInteract = { isSelected, startSel, extendSel, onKeyDown: handleKeyDown };

  // ── TSV 붙여넣기 — 엑셀 시각 순서(editableCellsFor)에 맞춰 채움 ──────
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, startCol: string, startRk: RowKey) {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return; // 단일 셀은 기본 동작
    e.preventDefault();

    const tsv = parseTsv(text);
    const startTop = topRowOf(startRk);
    const startTopIdx = EDIT_TOP_ROWS.indexOf(startTop);
    const startCells = editableCellsFor(startTop);
    const startIndex = startCells.findIndex((c) => c.col === startCol && c.rk === startRk);
    if (startIndex === -1) return;

    const patches: { colKey: string; rowKey: RowKey; value: string }[] = [];
    for (let ri = 0; ri < tsv.length; ri++) {
      const top = EDIT_TOP_ROWS[startTopIdx + ri];
      if (!top) break; // 입력 행은 매출·원가 2개뿐
      const cells = editableCellsFor(top);
      for (let ci = 0; ci < tsv[ri].length; ci++) {
        const target = cells[startIndex + ci];
        if (!target) break; // 행 끝(년계 넘어가면 중단)
        patches.push({ colKey: target.col, rowKey: target.rk, value: normalizePasteNum(tsv[ri][ci]) });
      }
    }
    if (patches.length > 0) onDraftChange(patches);
  }

  // ── 셀 값(draft 우선, 서버 columns 폴백) ──────────────────────────
  function getCellValue(col: FinancialGridColumn, rowKey: RowKey): string {
    const dk = cellKey(col.key, rowKey);
    if (draft[dk] !== undefined) return draft[dk];
    if (rowKey === 'revenueTarget') return col.revenue.target !== null ? String(col.revenue.target) : '';
    if (rowKey === 'revenueActual') return col.revenue.actual !== null ? String(col.revenue.actual) : '';
    if (rowKey === 'costTarget') return col.cost.target !== null ? String(col.cost.target) : '';
    if (rowKey === 'costActual') return col.cost.actual !== null ? String(col.cost.actual) : '';
    return '';
  }

  const prevLabel = columns.find((c) => c.isPrevYear)?.label ?? '전년';

  return (
    <div className="overflow-auto" style={{ maxHeight: 560 }}>
      {/* border-collapse:separate — collapse 면 sticky 열 경계에서 뒤 셀이 1px 비침(공유 테두리 버그) */}
      <table ref={tableRef} style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: 1600, userSelect: 'none' }}>
        <thead>
          {/* 1단: 구분 · 전년 · 월(2칸 병합) · 년계(2칸 병합) */}
          <tr>
            <th rowSpan={2} style={{ ...TH, ...stickyLeft, minWidth: 116 }}>구    분</th>
            <th rowSpan={2} style={{ ...TH, minWidth: 110 }}>{prevLabel}</th>
            {MONTHS.map((m) => (
              <th key={m} colSpan={2} style={TH}>{m}월</th>
            ))}
            <th colSpan={2} style={{ ...TH, background: '#eaf1fe', color: K.secondary }}>년계</th>
          </tr>
          {/* 2단: 월·년계 하위 목표/실적 */}
          <tr>
            {MONTHS.map((m) => (
              <React.Fragment key={m}>
                <th style={{ ...TH, top: 30, fontWeight: 500 }}>목표</th>
                <th style={{ ...TH, top: 30, fontWeight: 500 }}>실적</th>
              </React.Fragment>
            ))}
            <th style={{ ...TH, top: 30, fontWeight: 600, background: '#eaf1fe' }}>목표</th>
            <th style={{ ...TH, top: 30, fontWeight: 600, background: '#eaf1fe' }}>실적</th>
          </tr>
        </thead>
        <tbody>
          {ROW_DEFS.map((rd) => (
            <FinancialRow
              key={rd.kind}
              rowDef={rd}
              columns={columns}
              draft={draft}
              canEdit={canEdit}
              onChange={onChange}
              onPaste={handlePaste}
              getCellValue={getCellValue}
              interact={interact}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const stickyLeft: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 5 }; // 좌상단 모서리 — 최상위
