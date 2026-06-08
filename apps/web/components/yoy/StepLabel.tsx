'use client';

import { Check } from 'lucide-react';
import { T } from '@/lib/toss';

export interface StepLabelProps {
  step: number; // 단계 번호(1, 2 …)
  label: string; // 단계 설명("임직원 선택")
  done?: boolean; // 완료 시 번호 대신 체크 + 블루 톤
}

// 컨트롤 바를 "1단계 → 2단계"로 읽히게 하는 번호 배지 + 라벨.
// 선택 완료(done)면 블루 채움 + 체크, 미완료면 회색 외곽선.
export function StepLabel({ step, label, done = false }: StepLabelProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10.5px] font-bold tabular-nums transition-colors"
        style={
          done
            ? { background: T.blue500, color: '#fff' }
            : { background: T.grey100, color: T.grey600, border: `1px solid ${T.grey300}` }
        }
      >
        {done ? <Check size={11} strokeWidth={3} /> : step}
      </span>
      <span
        className="text-[12px] font-semibold"
        style={{ color: done ? T.grey800 : T.grey500 }}
      >
        {label}
      </span>
    </span>
  );
}
