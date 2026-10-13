'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { GradeChip } from './GradeChip';
import type { Grade } from '@/lib/types';

export interface DiffViewerProps {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  fieldLabels?: Record<string, string>;
  // 영문 enum 값(상태·권한 등) → 한글 표기 매핑.
  valueLabels?: Record<string, string>;
}

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
function isGrade(v: unknown): v is Grade {
  return typeof v === 'string' && (GRADES as string[]).includes(v);
}

function renderValue(
  v: unknown,
  valueLabels?: Record<string, string>,
): React.ReactNode {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  if (isGrade(v)) return <GradeChip grade={v} size="sm" />;
  if (typeof v === 'boolean') return v ? '예' : '아니오';
  if (typeof v === 'string' && valueLabels?.[v]) return valueLabels[v];
  if (typeof v === 'object') {
    return (
      <pre className="max-w-55 overflow-x-auto whitespace-pre-wrap break-words text-xs text-foreground">
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
export function DiffViewer({
  before,
  after,
  fieldLabels,
  valueLabels,
}: DiffViewerProps) {
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
    <Table>
      <TableHeader>
        <TableRow plain>
          <TableHead>필드</TableHead>
          <TableHead>이전</TableHead>
          <TableHead>이후</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((k) => {
          const b = before?.[k];
          const a = after?.[k];
          const changed = !equal(b, a);
          return (
            <TableRow
              key={k}
              aria-label={changed ? '변경됨' : undefined}
              className="align-top"
            >
              <TableCell className="font-medium text-foreground">
                {fieldLabels?.[k] ?? k}
              </TableCell>
              <TableCell
                className={cn(
                  'text-muted-foreground',
                  changed && 'line-through',
                )}
              >
                {renderValue(b, valueLabels)}
              </TableCell>
              <TableCell className={changed ? undefined : 'text-foreground'}>
                {changed ? (
                  <div className="inline-block rounded-sm bg-success-50 px-2 font-medium text-success-700">
                    {renderValue(a, valueLabels)}
                  </div>
                ) : (
                  renderValue(a, valueLabels)
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
