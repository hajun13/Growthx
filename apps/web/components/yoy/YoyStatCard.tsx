'use client';

import { T } from '@/lib/toss';
import type { LucideIcon } from 'lucide-react';

export interface YoyStatCardProps {
  label: string;
  value: string;
  accent?: string; // 좌측 강조 바·값 색(기본 grey900)
  icon?: LucideIcon;
  hint?: string; // 값 아래 보조 설명(추세 등)
}

// 연도비교 요약 통계 카드 — reports SummaryCard/MonthCard 패턴(사각·좌측 accent 바).
export function YoyStatCard({
  label,
  value,
  accent = T.grey900,
  icon: Icon,
  hint,
}: YoyStatCardProps) {
  return (
    <div
      className="flex items-center gap-3 bg-white px-4 py-3.5"
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
          <div style={{ fontSize: 11, color: T.grey500, marginTop: 1 }}>{hint}</div>
        )}
      </div>
    </div>
  );
}
