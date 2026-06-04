'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Card } from './Card';
import { InfoBanner } from './InfoBanner';
import { Button } from './Button';
import { cn } from '@/lib/utils';
import { POSITION_LABEL, kpiCategoryLabel } from '@/lib/ui';
import type { KpiCategory, KpiCategoryPolicyEntry, Position } from '@/lib/types';

const CATEGORIES: KpiCategory[] = [
  'revenue',
  'construction',
  'orders',
  'collaboration',
  'development',
];

export interface CategoryPolicyMatrixProps {
  // 직급별 허용 카테고리(계약 GET /kpi-category-policy 와 동일 array form).
  value: KpiCategoryPolicyEntry[];
  onToggle: (position: Position, category: KpiCategory, allowed: boolean) => void;
  onToggleColumn?: (category: KpiCategory, allowed: boolean) => void;
  onSave: () => void;
  onResetDefaults: () => void;
  saving?: boolean;
  dirty?: boolean;
}

export function CategoryPolicyMatrix({
  value,
  onToggle,
  onToggleColumn,
  onSave,
  onResetDefaults,
  saving,
  dirty,
}: CategoryPolicyMatrixProps) {
  const isAllowed = (entry: KpiCategoryPolicyEntry, cat: KpiCategory) =>
    entry.allowed.includes(cat);

  // 열 전체 토글 기준: 한 명이라도 미허용이면 → 전체 허용으로, 모두 허용이면 → 해제.
  const columnAllAllowed = (cat: KpiCategory) =>
    value.length > 0 && value.every((e) => isAllowed(e, cat));

  return (
    <Card title="직급별 KPI 카테고리 권한">
      <InfoBanner tone="tip" className="mb-4">
        체크된 카테고리만 해당 직급이 KPI에 쓸 수 있어요. 비직책자는 매출·수주를
        기본 차단해요. 바꾸면 다음 작성부터 적용돼요.
      </InfoBanner>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="sticky left-0 bg-card px-3 py-2 text-left font-semibold text-muted-foreground"
              >
                직급 \ 카테고리
              </th>
              {CATEGORIES.map((cat) => (
                <th
                  key={cat}
                  scope="col"
                  className="px-3 py-2 text-center font-semibold text-muted-foreground"
                >
                  <button
                    type="button"
                    onClick={() =>
                      onToggleColumn?.(cat, !columnAllAllowed(cat))
                    }
                    className="hover:text-foreground"
                    aria-label={`${kpiCategoryLabel[cat]} 열 전체 토글`}
                  >
                    {kpiCategoryLabel[cat]}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {value.map((entry) => (
              <tr key={entry.position} className="border-b border-border/60">
                <th
                  scope="row"
                  className="sticky left-0 bg-card px-3 py-2 text-left font-medium text-foreground"
                >
                  {entry.label || POSITION_LABEL[entry.position]}
                </th>
                {CATEGORIES.map((cat) => {
                  const allowed = isAllowed(entry, cat);
                  return (
                    <td key={cat} className={cn('px-3 py-2 text-center')}>
                      <span className="inline-flex justify-center">
                        <Checkbox
                          checked={allowed}
                          onCheckedChange={(c) =>
                            onToggle(entry.position, cat, c === true)
                          }
                          aria-label={`${POSITION_LABEL[entry.position]} 직급에 ${kpiCategoryLabel[cat]} 허용`}
                        />
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onResetDefaults}>
          기본값으로 되돌리기
        </Button>
        <Button onClick={onSave} disabled={!dirty || saving} loading={saving}>
          정책 저장
        </Button>
      </div>
    </Card>
  );
}
