'use client';

import { T } from '@/lib/toss';
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';

export type YoyStatTrend = 'up' | 'down' | 'flat';

export interface YoyStatCardProps {
  label: string;
  value: string;
  accent?: string; // 좌측 강조 바·값 색(기본 grey900)
  icon?: LucideIcon;
  hint?: string; // 값 아래 보조 설명(추세 등)
  // 추세 방향 — 있으면 hint 옆에 ▲/▼/− 신호를 색과 함께 표시(색만으로 구분 금지).
  trend?: YoyStatTrend;
}

const TREND_META: Record<
  YoyStatTrend,
  { Icon: LucideIcon; color: string; label: string }
> = {
  up: { Icon: TrendingUp, color: T.green500, label: '상승' },
  down: { Icon: TrendingDown, color: T.red500, label: '하락' },
  flat: { Icon: Minus, color: T.grey400, label: '유지' },
};

// 연도비교 요약 통계 카드 — reports SummaryCard/MonthCard 패턴(사각·좌측 accent 바).
export function YoyStatCard({
  label,
  value,
  accent = T.grey900,
  icon: Icon,
  hint,
  trend,
}: YoyStatCardProps) {
  const trendMeta = trend ? TREND_META[trend] : null;
  return (
    <div
      className="flex items-center gap-3 bg-white px-4 py-3.5 transition-colors hover:bg-toss-grey50"
      style={{ border: `1px solid ${T.grey200}`, borderLeft: `3px solid ${accent}` }}
    >
      {Icon && (
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center"
          style={{ background: accent }}
        >
          <Icon size={17} color="#fff" />
        </div>
      )}
      <div className="min-w-0">
        <div style={{ fontSize: 11, color: T.grey500 }}>{label}</div>
        <div
          className="truncate tabular-nums"
          style={{ fontSize: 20, fontWeight: 700, color: accent, lineHeight: 1.2 }}
        >
          {value}
        </div>
        {hint && (
          <div
            className="flex items-center gap-1"
            style={{ fontSize: 11, color: T.grey500, marginTop: 1 }}
          >
            {trendMeta && (
              <trendMeta.Icon
                size={12}
                color={trendMeta.color}
                aria-label={trendMeta.label}
              />
            )}
            <span>{hint}</span>
          </div>
        )}
      </div>
    </div>
  );
}
