'use client';

import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { T } from '@/lib/toss';

// ── Kinetic Enterprise 팔레트 ──────────────────────────────────
const K = {
  onSurface: '#18181c',
  onSurfaceVariant: '#565660',
  outline: '#74747f',
  white: '#ffffff',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

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

// 연도비교 요약 통계 카드 — 좌측 4px accent 바 + 아이콘 타일. Kinetic Enterprise.
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
    <div
      className="flex items-center gap-3 bg-white px-4 py-3.5 rounded-xl transition-colors"
      style={{
        border: '1px solid rgba(204,204,212,0.5)',
        borderLeft: `4px solid ${accent}`,
        boxShadow: CARD_SHADOW,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = '#f7f7f9';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = K.white;
      }}
    >
      {Icon && (
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: accent,
          }}
        >
          <Icon size={17} color="#fff" />
        </div>
      )}
      <div className="min-w-0">
        <div style={{ fontSize: 11, color: K.onSurfaceVariant }}>{label}</div>
        <div
          className="truncate tabular-nums"
          style={{ fontSize: 20, fontWeight: 800, color: accent, lineHeight: 1.2 }}
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
