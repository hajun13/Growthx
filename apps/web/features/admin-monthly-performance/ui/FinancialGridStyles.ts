/**
 * 경영실적 그리드 공유 스타일·포맷터 (EnergyX Common Design System 2026).
 * 엑셀 "2025년 경영실적" 레이아웃: 병합 2단 헤더 + 타이트한 셀 + 천단위 콤마.
 *
 * K — DESIGN.md 시맨틱 토큰 색 상수. FinancialGrid·FinancialGridRows 에서 import해 사용.
 * 인라인 style이 불가피한 표 셀(sticky header, 동적 배경 등)에서만 참조. 일반 컴포넌트는
 * Tailwind 시맨틱 클래스(text-foreground, bg-muted, border-border 등)를 우선한다.
 */
import type { CSSProperties } from 'react';
import { formatComma } from './FinancialGridHelpers';

// K — 색 토큰 (DESIGN.md §2 뉴트럴 + §2-1 블루 + 시맨틱). 다른 파일 import 허용.
// secondary = primary(동일), tertiary = info-500(데이터 시각화·성장 지표).
export const K = {
  primary:          '#0075DE', // primary
  secondary:        '#0075DE', // primary (= primary; accent alias)
  tertiary:         '#168A45', // success-500 (성장·그린 accent)
  surface:          '#F7F7F9', // neutral-50 (페이지 캔버스)
  surfaceLow:       '#EFEFF2', // neutral-100 (sunken / 테이블 헤더)
  white:            '#FFFFFF', // neutral-0
  onSurface:        '#18181C', // neutral-950 (최고 명도 텍스트)
  onSurfaceVariant: '#565660', // neutral-600 (보조 텍스트)
  outline:          '#74747F', // neutral-500 (muted 텍스트)
  outlineVariant:   '#CCCCD4', // neutral-300 (기본 보더)
  readonlyBg:       '#F7F7F9', // neutral-50 (읽기전용 셀 배경)
} as const;

/** 헤더 셀(평가 결과표 stickyTh 톤) */
export const TH: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: K.onSurfaceVariant,
  background: K.surfaceLow,
  borderBottom: `1px solid rgba(204,204,212,0.4)`,
  borderRight: `1px solid rgba(204,204,212,0.3)`,
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
  borderBottom: `1px solid rgba(204,204,212,0.25)`,
  boxShadow: '2px 0 4px -2px rgba(0,0,0,0.08)', // 고정 열 우측 중립 분리선(컬러 그림자 금지)
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
  borderBottom: `1px solid rgba(204,204,212,0.2)`,
  borderRight: `1px solid rgba(204,204,212,0.2)`,
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
  borderBottom: `1px solid rgba(204,204,212,0.2)`,
  borderRight: `1px solid rgba(204,204,212,0.2)`,
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
