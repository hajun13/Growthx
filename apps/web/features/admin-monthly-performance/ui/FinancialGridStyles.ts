/**
 * 경영실적 그리드 공유 스타일·포맷터(Kinetic Enterprise — 평가 결과표 톤).
 * 엑셀 "2025년 경영실적" 레이아웃: 병합 2단 헤더 + 타이트한 셀 + 천단위 콤마.
 */
import type { CSSProperties } from 'react';
import { formatComma } from './FinancialGridHelpers';

export const K = {
  primary: '#3f2c80',
  secondary: '#0054ca',
  tertiary: '#0e9aa0',
  surface: '#f8f9fd',
  surfaceLow: '#f2f3f7',
  white: '#ffffff',
  onSurface: '#191c1f',
  onSurfaceVariant: '#484551',
  outline: '#797582',
  outlineVariant: '#cac4d2',
  readonlyBg: '#fafbfd',
} as const;

/** 헤더 셀(평가 결과표 stickyTh 톤) */
export const TH: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: K.onSurfaceVariant,
  background: K.surfaceLow,
  borderBottom: `1px solid rgba(202,196,210,0.4)`,
  borderRight: `1px solid rgba(202,196,210,0.3)`,
  padding: '7px 8px',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  position: 'sticky',
  top: 0,
  zIndex: 4, // 상단 헤더 — 본문 행머리(z3) 위
};

/** 행 머리(항목명) 셀 — 좌측 고정(불투명 + 우측 분리 그림자로 데이터와 겹침 방지) */
export const ROW_HEAD: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: K.onSurface,
  background: K.white, // ⚠ 불투명 필수 — 반투명이면 가로 스크롤 시 데이터가 비쳐 글자가 겹침
  borderBottom: `1px solid rgba(202,196,210,0.25)`,
  boxShadow: '2px 0 4px -2px rgba(86,69,153,0.18)', // 고정 열 우측 분리선
  padding: '6px 12px',
  whiteSpace: 'nowrap',
  textAlign: 'left',
  position: 'sticky',
  left: 0,
  zIndex: 3,
};

// 모든 숫자 셀의 우측 들여쓰기를 동일(CELL_PAD_X)하게 맞춰 입력행·자동행 숫자 기준선을 일치시킨다.
const CELL_PAD_X = 10;

/** 자동(읽기전용) 데이터 셀 — td 패딩으로 우측 들여쓰기 */
export const TD: CSSProperties = {
  fontSize: 12,
  color: K.onSurface,
  height: 32,
  borderBottom: `1px solid rgba(202,196,210,0.2)`,
  borderRight: `1px solid rgba(202,196,210,0.2)`,
  padding: `0 ${CELL_PAD_X}px`,
  textAlign: 'right',
  verticalAlign: 'middle',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

/** 입력 셀 wrapper td — 패딩 0(들여쓰기는 input 이 담당, 자동 셀과 동일 기준선) */
export const TD_INPUT: CSSProperties = {
  height: 32,
  padding: 0,
  borderBottom: `1px solid rgba(202,196,210,0.2)`,
  borderRight: `1px solid rgba(202,196,210,0.2)`,
  verticalAlign: 'middle',
};

/** 입력 셀 input — 우측 패딩을 TD 와 동일(CELL_PAD_X)하게 맞춰 숫자 기준선 일치 */
export const CELL_INPUT: CSSProperties = {
  height: 32,
  width: '100%',
  minWidth: 90,
  border: `1px solid transparent`,
  background: 'transparent',
  padding: `0 ${CELL_PAD_X}px`,
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
  outline: 'none',
  borderRadius: 4,
  color: K.onSurface,
  userSelect: 'text', // 표 전체 user-select:none 이어도 입력 셀 텍스트는 편집/선택 가능
};

/** 율 null → '-', 숫자 → 소수1자리% */
export function fmtMargin(v: number | null): string {
  return v === null ? '-' : `${v.toFixed(1)}%`;
}

/** 이익/금액 null → '-', 숫자 → 원 단위 천단위 콤마(엑셀과 동일, 억/만 축약 안 함) */
export function fmtProfit(v: number | null): string {
  return v === null ? '-' : formatComma(String(Math.round(v)));
}
