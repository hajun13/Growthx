'use client';

/**
 * 경영실적 그리드 — 엑셀식 셀 선택/이동/삭제 훅.
 * - 단일 클릭·드래그로 범위 선택(매출·원가 격자).
 * - Delete: 선택 범위(또는 현재 셀) 일괄 비우기. 다중 선택 시 Backspace 도 일괄 삭제.
 * - 방향키/Enter 셀 이동(입력 끝/처음에서만 좌우 이동, Shift 로 범위 확장).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type RowKey,
  type Coord,
  type NavDir,
  coordOf,
  coordInRange,
  rangeCells,
  navTarget,
} from './FinancialGridHelpers';

interface Sel {
  a: Coord;
  f: Coord;
}

export function useFinancialSelection(
  onDraftChange: (patches: { colKey: string; rowKey: RowKey; value: string }[]) => void,
  tableRef: React.RefObject<HTMLTableElement | null>,
) {
  const [sel, setSel] = useState<Sel | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const startSel = useCallback((col: string, rk: RowKey) => {
    const c = coordOf(col, rk);
    if (!c) return;
    dragging.current = true;
    setSel({ a: c, f: c });
  }, []);

  const extendSel = useCallback((col: string, rk: RowKey) => {
    if (!dragging.current) return;
    const c = coordOf(col, rk);
    if (!c) return;
    setSel((s) => (s ? { a: s.a, f: c } : { a: c, f: c }));
  }, []);

  const isSelected = useCallback((col: string, rk: RowKey): boolean => {
    if (!sel) return false;
    const c = coordOf(col, rk);
    return c ? coordInRange(c, sel.a, sel.f) : false;
  }, [sel]);

  const focusCell = useCallback((col: string, rk: RowKey) => {
    const el = tableRef.current?.querySelector<HTMLInputElement>(
      `input[data-col="${col}"][data-row="${rk}"]`,
    );
    el?.focus();
    el?.select();
  }, [tableRef]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, col: string, rk: RowKey) => {
      const k = e.key;
      const multi = !!sel && (sel.a.r !== sel.f.r || sel.a.c !== sel.f.c);

      // 삭제: Delete 는 항상(단일·범위), Backspace 는 다중 선택일 때만 일괄 삭제.
      if (k === 'Delete' || (k === 'Backspace' && multi)) {
        e.preventDefault();
        const cells = multi && sel ? rangeCells(sel.a, sel.f) : [{ col, rk }];
        onDraftChange(cells.map((c) => ({ colKey: c.col, rowKey: c.rk, value: '' })));
        return;
      }

      // 이동(방향키/Enter). 좌우는 캐럿이 끝/처음일 때만 셀 이동(아니면 텍스트 편집).
      const input = e.currentTarget;
      const atStart = (input.selectionStart ?? 0) === 0;
      const atEnd = (input.selectionStart ?? 0) === (input.value?.length ?? 0);
      let dir: NavDir | null = null;
      if (k === 'ArrowUp') dir = 'up';
      else if (k === 'ArrowDown' || k === 'Enter') dir = 'down';
      else if (k === 'ArrowLeft' && atStart) dir = 'left';
      else if (k === 'ArrowRight' && atEnd) dir = 'right';
      if (!dir) return;

      const t = navTarget(col, rk, dir);
      if (!t) return;
      e.preventDefault();
      const tc = coordOf(t.col, t.rk);
      if (tc) setSel((s) => (e.shiftKey && s ? { a: s.a, f: tc } : { a: tc, f: tc }));
      focusCell(t.col, t.rk);
    },
    [sel, onDraftChange, focusCell],
  );

  return { isSelected, startSel, extendSel, handleKeyDown };
}
