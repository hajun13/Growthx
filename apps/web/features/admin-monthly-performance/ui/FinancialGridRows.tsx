'use client';

/**
 * 경영실적 그리드 한 행(엑셀 "2025년 경영실적" 레이아웃).
 * 행 = 매출·원가(입력) | 매출총이익·매출총이익율(자동).
 * 열 = [항목][전년 단일][1~12월 목표/실적][년계 목표/실적].
 * 매출/원가 행은 목표·실적이 편집 가능(천단위 콤마), 이익·이익율은 라이브 자동계산.
 */
import React from 'react';
import type { FinancialGridColumn } from '../api';
import {
  MONTHS,
  type GridDraft,
  type RowKey,
  liveGross,
  liveMargin,
  liveYearTotal,
  liveGrossYearTotal,
  grossProfitMargin,
  formatComma,
  sanitizeNumInput,
} from './FinancialGridHelpers';
import { K, TD, TD_INPUT, ROW_HEAD, CELL_INPUT, fmtMargin, fmtProfit } from './FinancialGridStyles';

export type RowKind = 'revenue' | 'cost' | 'gross' | 'margin';

export interface RowDef {
  kind: RowKind;
  label: string;
  /** 항목 머리 셀 좌측 강조선 색 */
  accent: string;
  /** 항목 머리 배경 */
  headBg: string;
}

/** 선택/이동/삭제 핸들러 묶음(useFinancialSelection 에서 주입) */
export interface CellInteract {
  isSelected: (colKey: string, rk: RowKey) => boolean;
  startSel: (colKey: string, rk: RowKey) => void;
  extendSel: (colKey: string, rk: RowKey) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, colKey: string, rk: RowKey) => void;
}

interface Props {
  rowDef: RowDef;
  columns: FinancialGridColumn[];
  draft: GridDraft;
  canEdit: boolean;
  onChange: (colKey: string, rowKey: RowKey, value: string) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>, colKey: string, rowKey: RowKey) => void;
  getCellValue: (col: FinancialGridColumn, rowKey: RowKey) => string;
  interact: CellInteract;
}

/** 입력 셀(천단위 콤마, type=text · 엑셀식 선택/이동/삭제) */
function InputCell({
  colKey,
  rk,
  raw,
  canEdit,
  onChange,
  onPaste,
  ariaLabel,
  interact,
}: {
  colKey: string;
  rk: RowKey;
  raw: string;
  canEdit: boolean;
  onChange: (colKey: string, rk: RowKey, v: string) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>, colKey: string, rk: RowKey) => void;
  ariaLabel: string;
  interact: CellInteract;
}) {
  const selected = interact.isSelected(colKey, rk);
  return (
    <td
      style={{ ...TD_INPUT, background: selected ? 'rgba(0,84,202,0.14)' : undefined }}
      onMouseDown={() => interact.startSel(colKey, rk)}
      onMouseEnter={() => interact.extendSel(colKey, rk)}
    >
      <input
        type="text"
        inputMode="numeric"
        data-col={colKey}
        data-row={rk}
        value={formatComma(raw)}
        readOnly={!canEdit}
        disabled={!canEdit}
        onChange={(e) => onChange(colKey, rk, sanitizeNumInput(e.target.value))}
        onPaste={(e) => onPaste(e, colKey, rk)}
        onKeyDown={(e) => interact.onKeyDown(e, colKey, rk)}
        onFocus={(e) => { if (canEdit) e.currentTarget.style.borderColor = K.secondary; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
        className="disabled:opacity-70"
        style={{ ...CELL_INPUT, background: 'transparent' }}
        placeholder="0"
        aria-label={ariaLabel}
      />
    </td>
  );
}

/** 자동계산(읽기전용) 셀 */
function DerivedCell({ text, em }: { text: string; em?: boolean }) {
  return (
    <td style={{ ...TD, background: K.readonlyBg, color: em ? K.onSurface : K.onSurfaceVariant, fontWeight: em ? 700 : 500 }}>
      {text}
    </td>
  );
}

export function FinancialRow({ rowDef, columns, draft, canEdit, onChange, onPaste, getCellValue, interact }: Props) {
  const { kind } = rowDef;
  const isEditable = kind === 'revenue' || kind === 'cost';
  const tKey: RowKey = kind === 'cost' ? 'costTarget' : 'revenueTarget';
  const aKey: RowKey = kind === 'cost' ? 'costActual' : 'revenueActual';
  const prevCol = columns.find((c) => c.isPrevYear);

  // 자동행: (열, 목표여부) → 표시 문자열
  const derived = (colKey: string, isTarget: boolean): string => {
    if (kind === 'gross') return fmtProfit(liveGross(draft, colKey, isTarget));
    return fmtMargin(liveMargin(draft, colKey, isTarget)); // margin
  };

  // 전년(2024) 단일 셀 — 실적 기준(엑셀과 동일, 목표 없음)
  const prevCell = () => {
    if (isEditable && prevCol) {
      return (
        <InputCell
          colKey="prevYear"
          rk={aKey}
          raw={getCellValue(prevCol, aKey)}
          canEdit={canEdit}
          onChange={onChange}
          onPaste={onPaste}
          ariaLabel={`전년 ${rowDef.label}`}
          interact={interact}
        />
      );
    }
    return <DerivedCell text={prevCol ? derived('prevYear', false) : '-'} />;
  };

  // 년계 셀(목표/실적) — 자동
  const yearTotalCells = () => {
    if (kind === 'revenue' || kind === 'cost') {
      return (
        <>
          <DerivedCell em text={fmtProfit(liveYearTotal(draft, tKey))} />
          <DerivedCell em text={fmtProfit(liveYearTotal(draft, aKey))} />
        </>
      );
    }
    if (kind === 'gross') {
      return (
        <>
          <DerivedCell em text={fmtProfit(liveGrossYearTotal(draft, true))} />
          <DerivedCell em text={fmtProfit(liveGrossYearTotal(draft, false))} />
        </>
      );
    }
    // margin 년계 = Σ이익 / Σ매출
    const mt = grossProfitMargin(liveYearTotal(draft, 'revenueTarget'), liveGrossYearTotal(draft, true));
    const ma = grossProfitMargin(liveYearTotal(draft, 'revenueActual'), liveGrossYearTotal(draft, false));
    return (
      <>
        <DerivedCell em text={fmtMargin(mt)} />
        <DerivedCell em text={fmtMargin(ma)} />
      </>
    );
  };

  return (
    <tr>
      <td style={{ ...ROW_HEAD, borderLeft: `3px solid ${rowDef.accent}`, background: rowDef.headBg }}>
        {rowDef.label}
      </td>
      {prevCell()}
      {MONTHS.map((m) => {
        const col = columns.find((c) => c.key === String(m));
        if (isEditable) {
          return (
            <React.Fragment key={m}>
              <InputCell colKey={String(m)} rk={tKey} raw={col ? getCellValue(col, tKey) : ''} canEdit={canEdit} onChange={onChange} onPaste={onPaste} ariaLabel={`${m}월 ${rowDef.label} 목표`} interact={interact} />
              <InputCell colKey={String(m)} rk={aKey} raw={col ? getCellValue(col, aKey) : ''} canEdit={canEdit} onChange={onChange} onPaste={onPaste} ariaLabel={`${m}월 ${rowDef.label} 실적`} interact={interact} />
            </React.Fragment>
          );
        }
        return (
          <React.Fragment key={m}>
            <DerivedCell text={derived(String(m), true)} />
            <DerivedCell text={derived(String(m), false)} />
          </React.Fragment>
        );
      })}
      {yearTotalCells()}
    </tr>
  );
}
