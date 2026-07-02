// 월별실적 화면 공유 포맷터·등급 판정 — image 11 재현.
// 저장값(매출/원가 목표·실적)은 백엔드 응답을 표시하고, 화면 표시용 파생(억/만 축약·달성상태)만 여기서 계산한다.

/** 억/만 단위 축약(예: 123.2억, 890만). 카드 요약 수치용. */
export function fmtEok(value: number | null): string {
  if (value === null) return '-';
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`;
  return value.toLocaleString('ko-KR');
}

/** 퍼센트 소수1자리, null → '-'. */
export function fmtPct1(value: number | null): string {
  return value === null ? '-' : `${value.toFixed(1)}%`;
}

/** 증감률(%p 아닌 상대 증감률) 부호 포함 표시. */
export function fmtDeltaPct(value: number | null): string {
  if (value === null) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export type AchievementTone = 'good' | 'warn' | 'risk';

/** 달성률 → 색 톤(100%↑=양호, 80~99%=보통, 80%미만=위험). image 11 우측 패널 배지 기준. */
export function achievementTone(rate: number | null): AchievementTone {
  if (rate === null) return 'warn';
  if (rate >= 100) return 'good';
  if (rate >= 80) return 'warn';
  return 'risk';
}

export const achievementToneLabel: Record<AchievementTone, string> = {
  good: '양호',
  warn: '주의',
  risk: '위험',
};

export const achievementToneClass: Record<AchievementTone, string> = {
  good: 'bg-status-finalized-bg text-status-finalized-fg',
  warn: 'bg-status-in-progress-bg text-status-in-progress-fg',
  risk: 'bg-danger-50 text-danger-700',
};

/** 전년 대비 증감률 = (올해-전년)/|전년| × 100. 전년 0/null → null. */
export function yoyDelta(curr: number | null, prev: number | null): number | null {
  if (curr === null || prev === null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}
