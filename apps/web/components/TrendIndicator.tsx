'use client';

// 추세 표시(▲▼–) — component-spec-midterm §2.
// 직전 대비 누적 달성률/건수 변화. 부호·수치·단위 텍스트 병기(색만 의존 금지). tabular-nums.
// 백엔드는 trend(enum)만 주고 델타 수치는 별도 제공하지 않으므로, 두 입력 방식을 모두 지원:
//  - delta(숫자)가 있으면 부호·값 표기
//  - 없으면 trend(up/flat/down)만으로 화살표·라벨 표기
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { ProgressTrend } from '@/lib/types';

export interface TrendIndicatorProps {
  // 변화량(+8 = +8%p, count면 +건). null/미지정이면 trend 만으로 표시.
  delta?: number | null;
  // 백엔드 enum 추세(델타 없을 때 방향 표시용).
  trend?: ProgressTrend | null;
  unit?: '%p' | '건' | '';
}

const COLOR = {
  up: '#0F9457',
  down: '#D6303D',
  flat: '#8B95A1',
  none: '#B0B8C1',
} as const;

const DIR_LABEL: Record<ProgressTrend, string> = {
  up: '상승',
  down: '하락',
  flat: '보합',
};

export function TrendIndicator({ delta, trend, unit = '%p' }: TrendIndicatorProps) {
  // 방향 판정: delta 우선, 없으면 trend.
  const dir: ProgressTrend | null =
    delta != null
      ? delta > 0
        ? 'up'
        : delta < 0
          ? 'down'
          : 'flat'
      : trend ?? null;

  if (dir === null) {
    return (
      <span style={{ color: COLOR.none, fontSize: 12 }} aria-label="추세 정보 없음">
        —
      </span>
    );
  }

  const color = COLOR[dir];
  const Icon = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : Minus;
  const valueText =
    delta != null && dir !== 'flat'
      ? `${delta > 0 ? '+' : ''}${delta}${unit}`
      : DIR_LABEL[dir];
  const aria =
    delta != null && dir !== 'flat'
      ? `추세 ${DIR_LABEL[dir]} ${Math.abs(delta)}${unit === '%p' ? '퍼센트포인트' : unit}`
      : `추세 ${DIR_LABEL[dir]}`;

  return (
    <span
      className="inline-flex items-center gap-0.5 tabular-nums"
      style={{ color, fontSize: 12, fontWeight: 600 }}
      aria-label={aria}
    >
      <Icon size={13} aria-hidden />
      {valueText}
    </span>
  );
}
