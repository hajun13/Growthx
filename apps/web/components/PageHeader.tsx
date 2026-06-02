'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-foreground">
          {title}
        </h1>
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
            <SelectTrigger className="w-[180px]" aria-label="평가 주기 선택">
              <SelectValue placeholder="평가 주기" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
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
