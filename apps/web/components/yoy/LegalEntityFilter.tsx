'use client';

import { legalEntityLabel } from '@/lib/ui';
import type { LegalEntity } from '@/lib/types';

// ── Kinetic Enterprise 팔레트 ──────────────────────────────────
const K = {
  onSurface: '#18181c',
  onSurfaceVariant: '#565660',
  outline: '#74747f',
  outlineVariant: '#ccccd4',
  surfaceLow: '#efeff2',
  white: '#ffffff',
} as const;
const CARD_SHADOW = '0 4px 12px rgba(86,69,153,0.05)';

export type LegalEntityValue = 'all' | LegalEntity;

export interface LegalEntityFilterProps {
  value: LegalEntityValue;
  onChange: (v: LegalEntityValue) => void;
  counts?: Record<LegalEntityValue, number>; // 옵션 — 각 옵션 인원수 뱃지
}

const OPTIONS: { key: LegalEntityValue; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'energyx', label: legalEntityLabel.energyx },
  { key: 'mirae_plan', label: legalEntityLabel.mirae_plan },
];

// 법인별 보기 필터 — Kinetic rounded 세그먼트.
export function LegalEntityFilter({
  value,
  onChange,
  counts,
}: LegalEntityFilterProps) {
  return (
    <div
      role="tablist"
      aria-label="법인 필터"
      className="inline-flex items-center gap-1 p-1 rounded-lg"
      style={{ background: K.surfaceLow }}
    >
      {OPTIONS.map(({ key, label }) => {
        const active = value === key;
        const count = counts?.[key];
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className="outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background .12s, color .12s, box-shadow .12s',
              background: active ? K.white : 'transparent',
              color: active ? K.onSurface : K.onSurfaceVariant,
              boxShadow: active ? CARD_SHADOW : 'none',
            }}
          >
            {label}
            {count != null && (
              <span
                className="ml-1 tabular-nums"
                style={{ fontSize: 11, color: K.outline }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
