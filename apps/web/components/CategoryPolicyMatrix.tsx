'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InfoBanner } from './InfoBanner';
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
    <Card>
      <div className="border-b border-border">
        <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
          <CardTitle className="text-15 leading-5.5 font-bold text-foreground">
            직급별 KPI 카테고리 권한
          </CardTitle>
        </CardHeader>
      </div>
      <CardContent className="p-4 md:p-5">
        <InfoBanner tone="tip" className="mb-4">
          체크된 카테고리만 해당 직급이 KPI에 쓸 수 있어요. 비직책자는 매출·수주를
          기본 차단해요. 바꾸면 다음 작성부터 적용돼요.
        </InfoBanner>

        <Table>
          <TableHeader>
            <TableRow plain>
              <TableHead scope="col" className="sticky left-0 bg-card text-muted-foreground">
                직급 \ 카테고리
              </TableHead>
              {CATEGORIES.map((cat) => (
                <TableHead key={cat} scope="col" textAlign="center">
                  <Button
                    variant="ghost-muted"
                    size="xs"
                    onClick={() => onToggleColumn?.(cat, !columnAllAllowed(cat))}
                    aria-label={`${kpiCategoryLabel[cat]} 열 전체 토글`}
                  >
                    {kpiCategoryLabel[cat]}
                  </Button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {value.map((entry) => (
              <TableRow key={entry.position}>
                <TableHead
                  scope="row"
                  className="sticky left-0 bg-card font-medium text-foreground"
                >
                  {entry.label || POSITION_LABEL[entry.position]}
                </TableHead>
                {CATEGORIES.map((cat) => {
                  const allowed = isAllowed(entry, cat);
                  return (
                    <TableCell key={cat} textAlign="center">
                      <span className="inline-flex justify-center">
                        <Checkbox
                          checked={allowed}
                          onCheckedChange={(c) =>
                            onToggle(entry.position, cat, c === true)
                          }
                          aria-label={`${POSITION_LABEL[entry.position]} 직급에 ${kpiCategoryLabel[cat]} 허용`}
                        />
                      </span>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onResetDefaults}>
            기본값으로 되돌리기
          </Button>
          <Button onClick={onSave} disabled={!dirty || saving} loading={saving}>
            정책 저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
