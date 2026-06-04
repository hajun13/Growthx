'use client';

import { cn } from '@/lib/utils';
import { GradeChip } from './GradeChip';
import type { Grade } from '@/lib/types';

export interface DiffViewerProps {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  fieldLabels?: Record<string, string>;
}

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
function isGrade(v: unknown): v is Grade {
  return typeof v === 'string' && (GRADES as string[]).includes(v);
}

function renderValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  if (isGrade(v)) return <GradeChip grade={v} size="sm" />;
  if (typeof v === 'boolean') return v ? '예' : '아니오';
  if (typeof v === 'object') {
    return (
      <pre className="max-w-[220px] overflow-x-auto whitespace-pre-wrap break-words text-xs text-foreground">
        {JSON.stringify(v, null, 0)}
      </pre>
    );
  }
  return String(v);
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

// before/after 키 합집합 순회. 변경된 행만 강조(색+취소선+라벨 병기).
export function DiffViewer({ before, after, fieldLabels }: DiffViewerProps) {
  const keys = Array.from(
    new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]),
  );

  if (keys.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        기록된 변경 내역이 없어요.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th className="py-2 pr-3 font-medium">필드</th>
          <th className="py-2 pr-3 font-medium">이전</th>
          <th className="py-2 font-medium">이후</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => {
          const b = before?.[k];
          const a = after?.[k];
          const changed = !equal(b, a);
          return (
            <tr
              key={k}
              aria-label={changed ? '변경됨' : undefined}
              className="border-b border-border/60 align-top"
            >
              <td className="py-2 pr-3 font-medium text-foreground">
                {fieldLabels?.[k] ?? k}
              </td>
              <td
                className={cn(
                  'py-2 pr-3',
                  changed
                    ? 'text-muted-foreground line-through'
                    : 'text-muted-foreground',
                )}
              >
                {renderValue(b)}
              </td>
              <td
                className={cn(
                  'rounded-sm py-2',
                  changed
                    ? 'bg-success-50 px-2 font-medium text-success-700'
                    : 'text-foreground',
                )}
              >
                {renderValue(a)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
