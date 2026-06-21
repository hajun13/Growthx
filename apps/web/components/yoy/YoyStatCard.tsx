'use client';

import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { T } from '@/lib/palette';

// ── Notion Low Color 팔레트 ──────────────────────────────────
const K = {
  onSurface: '#18181c',
  onSurfaceVariant: '#565660',
  outline: '#74747f',
} as const;

export type YoyStatTrend = 'up' | 'down' | 'flat';

export interface YoyStatCardProps {
  label: string;
  value: string;
  accent?: string; // 좌측 강조 바·아이콘 타일 색
  icon?: LucideIcon;
  hint?: string; // 값 아래 보조 설명
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

// 연도비교 요약 — 카드 타일보다는 패널 안의 낮은 밀도 메타 블록으로 유지.
export function YoyStatCard({
  label,
  value,
  accent = K.onSurface,
  icon: Icon,
  hint,
  trend,
}: YoyStatCardProps) {
  const trendMeta = trend ? TREND_META[trend] : null;
  return (
    <div className="rounded-none border border-border bg-card px-4 py-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: accent }}
            aria-hidden
          />
          <div className="truncate" style={{ fontSize: 11, color: K.onSurfaceVariant }}>{label}</div>
        </div>
        {Icon && (
          <Icon size={15} color={accent} aria-hidden className="shrink-0" />
        )}
      </div>
      <div className="mt-1 min-w-0">
        <div
          className="truncate tabular-nums"
          style={{ fontSize: 20, fontWeight: 700, color: K.onSurface, lineHeight: 1.2 }}
        >
          {value}
        </div>
        {hint && (
          <div
            className="flex items-center gap-1"
            style={{ fontSize: 11, color: K.outline, marginTop: 1 }}
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
