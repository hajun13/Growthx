'use client';

import { Check } from 'lucide-react';

// ── Kinetic Enterprise 팔레트 ──────────────────────────────────
const K = {
  secondary: '#0054ca', // true blue — 완료 시 채움색
  onSurfaceVariant: '#484551',
  outline: '#797582',
  surfaceLow: '#f2f3f7',
  outlineVariant: '#cac4d2',
} as const;

export interface StepLabelProps {
  step: number; // 단계 번호(1, 2 …)
  label: string; // 단계 설명("임직원 선택")
  done?: boolean; // 완료 시 번호 대신 체크 + 블루 톤
}

// 컨트롤 바를 "1단계 → 2단계"로 읽히게 하는 번호 배지 + 라벨.
// 선택 완료(done)면 K.secondary 채움 + 체크, 미완료면 회색 외곽선.
export function StepLabel({ step, label, done = false }: StepLabelProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="flex items-center justify-center tabular-nums transition-colors"
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          fontSize: 10.5,
          fontWeight: 700,
          ...(done
            ? { background: K.secondary, color: '#fff' }
            : {
                background: K.surfaceLow,
                color: K.outline,
                border: `1px solid ${K.outlineVariant}`,
              }),
        }}
      >
        {done ? <Check size={11} strokeWidth={3} /> : step}
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: done ? K.onSurfaceVariant : K.outline,
        }}
      >
        {label}
      </span>
    </span>
  );
}
