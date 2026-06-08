'use client';

import { Checkbox } from '@/components/ui/checkbox';

export interface ResignedToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

// 퇴사자 표시 토글. 라벨 "퇴사자 포함". 사각 체크박스(기존 ui).
// 개인 타임라인 탭 전용 — 분포 탭은 당시 재직 인원 기준이라 토글이 의미 없음(#7-b).
export function ResignedToggle({ checked, onChange }: ResignedToggleProps) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-1.5 text-[12.5px] font-medium text-toss-grey700">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        aria-label="퇴사자 포함"
        className="rounded-none"
      />
      <span>퇴사자 포함</span>
    </label>
  );
}
