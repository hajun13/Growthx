'use client';

// ── Kinetic Enterprise 팔레트 ──────────────────────────────────
const K = {
  onSurfaceVariant: '#565660',
  outline: '#74747f',
  surfaceLow: '#efeff2',
  outlineVariant: '#ccccd4',
} as const;

export interface RuleSetChipProps {
  competencyIncluded: boolean; // 역량평가 포함 여부
  // 역량 점수 반영 여부(역량은 항상 참고용이라 false 가정 — 명시 false 면 "(참고)").
  reflected?: boolean;
  perfWeight?: number; // 실적 가중치(%) — 있으면 "실적 N%", 없으면 "실적 100%".
}

// 사이클 RuleSet 요약 칩 — "실적 100%" 또는 "실적 70%·역량(참고)".
// Kinetic surface 배경·8px rounded·소형. 백엔드 ruleSummary 표시만(재계산 없음).
export function RuleSetChip({
  competencyIncluded,
  reflected = false,
  perfWeight,
}: RuleSetChipProps) {
  const perfText = `실적 ${perfWeight != null ? perfWeight : 100}%`;
  // 역량 포함이지만 미반영이면 "역량(참고)" 회색.
  const compText = competencyIncluded
    ? reflected
      ? '역량 반영'
      : '역량(참고)'
    : null;
  const label = compText ? `${perfText}·${compText}` : perfText;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: K.surfaceLow,
        border: `1px solid ${K.outlineVariant}`,
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: 11,
        fontWeight: 500,
        color: K.outline,
      }}
      title={label}
    >
      {label}
    </span>
  );
}
