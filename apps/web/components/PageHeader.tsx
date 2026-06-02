'use client';

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
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {cycles && onSelectCycle && (
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <span className="sr-only">평가 주기 선택</span>
            <select
              value={selectedId ?? ''}
              onChange={(e) => onSelectCycle(e.target.value)}
              className="h-10 rounded-md border border-neutral-300 bg-neutral-0 px-3 text-base text-neutral-900 outline-none focus:border-primary-500 focus-visible:shadow-focus"
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {right}
      </div>
    </div>
  );
}
