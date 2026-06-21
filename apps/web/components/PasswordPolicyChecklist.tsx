'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PasswordRule {
  key: string;
  label: string;
  passed: boolean;
}

export interface PasswordPolicyChecklistProps {
  rules: PasswordRule[];
}

// 정책 체크리스트 — 아이콘+색+텍스트 3중 병기(색 단독 금지).
export function PasswordPolicyChecklist({
  rules,
}: PasswordPolicyChecklistProps) {
  return (
    <ul
      aria-live="polite"
      className="flex flex-col gap-1.5 border border-border bg-muted/30 p-3"
    >
      {rules.map((r) => (
        <li key={r.key} className="flex items-center gap-2 text-sm">
          {r.passed ? (
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
          <span className={cn(r.passed ? 'text-foreground' : 'text-muted-foreground')}>
            {r.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
