'use client';

import { useMemo } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Card } from './Card';
import { Tabs } from './Tabs';
import { Select } from './Select';
import { Button } from './Button';
import { EmptyState } from './States';
import { cn } from '@/lib/utils';
import {
  kpiCategoryLabel,
  kpiGroupLabel,
  measureTypeLabel,
  jobLevelLabel,
} from '@/lib/ui';
import type {
  JobLevel,
  KpiCategory,
  KpiGroup,
  MeasureType,
} from '@/lib/types';

// 편집 중 항목(로컬 key 부여 — 서버 id 없는 신규 행도 추적).
export interface TemplateItemDraft {
  key: string;
  category: KpiCategory;
  group: KpiGroup;
  defaultMeasureType: MeasureType;
  defaultWeight: number;
  isQualitative: boolean;
}

export interface TemplateEditorProps {
  jobLevel: JobLevel;
  onJobLevelChange: (j: JobLevel) => void;
  items: TemplateItemDraft[];
  qualitativeMax: number; // 정성 상한(RuleSet 정책)
  onAdd: () => void;
  onChange: (key: string, patch: Partial<TemplateItemDraft>) => void;
  onRemove: (key: string) => void;
}

const JOB_LEVELS: JobLevel[] = [
  'division_head',
  'team_lead',
  'senior_plus',
  'senior_minus',
];

const categoryOptions = (Object.keys(kpiCategoryLabel) as KpiCategory[]).map(
  (c) => ({ value: c, label: kpiCategoryLabel[c] }),
);
const groupOptions = (Object.keys(kpiGroupLabel) as KpiGroup[]).map((g) => ({
  value: g,
  label: kpiGroupLabel[g],
}));
const measureOptions = (Object.keys(measureTypeLabel) as MeasureType[]).map(
  (m) => ({ value: m, label: measureTypeLabel[m] }),
);

export function TemplateEditor({
  jobLevel,
  onJobLevelChange,
  items,
  qualitativeMax,
  onAdd,
  onChange,
  onRemove,
}: TemplateEditorProps) {
  const total = useMemo(
    () => items.reduce((acc, it) => acc + (it.defaultWeight || 0), 0),
    [items],
  );
  const qualTotal = useMemo(
    () =>
      items
        .filter((it) => it.isQualitative)
        .reduce((acc, it) => acc + (it.defaultWeight || 0), 0),
    [items],
  );
  const totalBad = items.length > 0 && total !== 100;
  const qualBad = qualTotal > qualitativeMax;

  return (
    <Card title="KPI 양식 (jobLevel별 항목)">
      <Tabs
        items={JOB_LEVELS.map((j) => ({ key: j, label: jobLevelLabel[j] }))}
        activeKey={jobLevel}
        onChange={(k) => onJobLevelChange(k as JobLevel)}
      />

      <div className="mt-4 flex flex-col gap-4">
        {items.length === 0 ? (
          <EmptyState
            title="이 직급의 양식 항목이 없어요."
            action={
              <Button variant="secondary" size="sm" onClick={onAdd}>
                항목 추가
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">카테고리</th>
                    <th className="py-2 pr-3 font-medium">그룹</th>
                    <th className="py-2 pr-3 font-medium">기본 측정방식</th>
                    <th className="py-2 pr-3 font-medium">기본 가중치</th>
                    <th className="py-2 pr-3 font-medium">정성</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.key} className="border-t border-border/60">
                      <td className="py-2 pr-3">
                        <Select
                          value={it.category}
                          options={categoryOptions}
                          onChange={(v) =>
                            onChange(it.key, { category: v as KpiCategory })
                          }
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Select
                          value={it.group}
                          options={groupOptions}
                          onChange={(v) =>
                            onChange(it.key, { group: v as KpiGroup })
                          }
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Select
                          value={it.defaultMeasureType}
                          options={measureOptions}
                          onChange={(v) =>
                            onChange(it.key, {
                              defaultMeasureType: v as MeasureType,
                              isQualitative: v === 'qualitative',
                            })
                          }
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <div className="relative w-24">
                          <input
                            type="number"
                            aria-label="기본 가중치"
                            value={it.defaultWeight}
                            onChange={(e) =>
                              onChange(it.key, {
                                defaultWeight: Number(e.target.value),
                              })
                            }
                            className="h-9 w-24 rounded-md border border-input bg-background px-2 pr-7 text-right text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {it.isQualitative ? '예' : '아니오'}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          aria-label="항목 삭제"
                          onClick={() => onRemove(it.key)}
                          className="rounded-md p-1.5 text-danger-600 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" aria-hidden />}
              onClick={onAdd}
            >
              항목 추가
            </Button>

            <div className="border-t border-border pt-3 text-sm">
              <span
                className={cn(
                  'font-medium',
                  totalBad ? 'text-destructive' : 'text-success-700',
                )}
              >
                가중치 합계: {total}%{' '}
                {totalBad ? '(100%가 되어야 해요)' : '✓'}
              </span>
              {qualBad && (
                <span className="ml-3 text-warning-700">
                  정성 합 {qualTotal}% — 상한 {qualitativeMax}% 초과
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

// 양식 저장 가드.
export function templateValid(
  items: TemplateItemDraft[],
  qualitativeMax: number,
): boolean {
  if (items.length === 0) return false;
  const total = items.reduce((a, it) => a + (it.defaultWeight || 0), 0);
  const qual = items
    .filter((it) => it.isQualitative)
    .reduce((a, it) => a + (it.defaultWeight || 0), 0);
  return total === 100 && qual <= qualitativeMax;
}
