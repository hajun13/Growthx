'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CycleTypeBadge } from '@/components/CycleTypeBadge';
import { T } from '@/lib/toss';
import type { EvaluationCycle } from '@/lib/types';

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  cycles?: EvaluationCycle[];
  selectedId?: string | null;
  onSelectCycle?: (id: string) => void;
  right?: React.ReactNode;
  /** 제목 옆 주기 유형 배지(최종평가/중간평가) 숨김. */
  hideCycleBadge?: boolean;
}

/**
 * 모든 (main) 페이지 제목 블록의 유일한 출처.
 * 렌더 규격(고정) — 페이지 간 제목의 좌측 정렬선(x)·상단 위치(y)를 구조적으로 강제한다.
 *  - 제목 <h1>: 20px / 700 / #18181c / leading-tight
 *  - subtitle <p>: 13px / #565660 / marginTop 2px
 *  - 우측 슬롯: flex items-center gap-2.5 flex-wrap
 * 인라인 fontFamily 금지 — 전역 body 폰트(Pretendard Variable) 상속.
 */
export function PageHeader({
  title,
  subtitle,
  cycles,
  selectedId,
  onSelectCycle,
  right,
  hideCycleBadge,
}: PageHeaderProps) {
  const selectedCycle = cycles?.find((c) => c.id === selectedId);

  return (
    <div className="flex items-start justify-between flex-wrap gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1
            className="text-[20px] font-bold leading-[1.3]"
            style={{ color: T.grey900 }}
          >
            {title}
          </h1>
          {!hideCycleBadge && selectedCycle?.cycleType && (
            <CycleTypeBadge cycleType={selectedCycle.cycleType} />
          )}
        </div>
        {subtitle && (
          <p className="text-[13px]" style={{ color: T.grey600, marginTop: 2 }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2.5 flex-wrap">
        {right}
        {cycles && onSelectCycle && (
          <Select value={selectedId ?? undefined} onValueChange={onSelectCycle}>
            <SelectTrigger className="w-[200px]" aria-label="평가 주기 선택">
              <SelectValue placeholder="평가 주기" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-1.5">
                    {c.name}
                    {c.cycleType && (
                      <span
                        className={`px-1.5 py-0 text-[11px] font-medium leading-5 ${
                          c.cycleType === 'MIDTERM'
                            ? 'bg-[#EAF1FE] text-[#1D4FC4]'
                            : 'bg-[#E9F8EF] text-[#0E6633]'
                        }`}
                      >
                        {c.cycleType === 'MIDTERM' ? '중간' : '최종'}
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
