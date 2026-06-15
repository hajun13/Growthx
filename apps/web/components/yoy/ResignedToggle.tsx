'use client';

import { Checkbox } from '@/components/ui/checkbox';

// ── Kinetic Enterprise 팔레트 ──────────────────────────────────
const K = {
  onSurfaceVariant: '#484551',
} as const;

export interface ResignedToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

// 퇴사자 표시 토글. 라벨 "퇴사자 포함". Kinetic 체크박스.
// 개인 타임라인 탭 전용 — 분포 탭은 당시 재직 인원 기준이라 토글이 의미 없음(#7-b).
export function ResignedToggle({ checked, onChange }: ResignedToggleProps) {
  return (
    <label
      className="flex cursor-pointer select-none items-center gap-1.5"
      style={{ fontSize: 12.5, fontWeight: 600, color: K.onSurfaceVariant }}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        aria-label="퇴사자 포함"
        className="rounded"
      />
      <span>퇴사자 포함</span>
    </label>
  );
}
