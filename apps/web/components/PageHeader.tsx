'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CycleTypeBadge } from '@/components/CycleTypeBadge';
import type { EvaluationCycle } from '@/lib/types';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  cycles?: EvaluationCycle[];
  selectedId?: string | null;
  onSelectCycle?: (id: string) => void;
  right?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  cycles,
  selectedId,
  onSelectCycle,
  right,
}: PageHeaderProps) {
  const selectedCycle = cycles?.find((c) => c.id === selectedId);

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {selectedCycle?.cycleType && (
            <CycleTypeBadge cycleType={selectedCycle.cycleType} />
          )}
        </div>
        {subtitle && (
          <p className="mt-1.5 text-[15px] font-medium text-foreground/70">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {cycles && onSelectCycle && (
          <Select
            value={selectedId ?? undefined}
            onValueChange={onSelectCycle}
          >
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
                        className={`rounded-full px-1.5 py-0 text-[11px] font-medium leading-5 ${
                          c.cycleType === 'MIDTERM'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
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
        {right}
      </div>
    </div>
  );
}
