'use client';

import { Trash2 } from 'lucide-react';
import { kpiGroupLabel, kpiCategoryLabel, kpiTypeLabel } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type {
  KpiCategory,
  KpiGroup,
  MeasureType,
  KpiStatus,
} from '@/lib/types';
import { StatusBadge } from './StatusBadge';

export interface KpiCardData {
  id: string;
  category: KpiCategory;
  group: KpiGroup;
  measureType: MeasureType;
  coreStrategy: string;
  title: string;
  csf?: string;
  measureMethod?: string;
  targetValue?: number;
  unit?: string;
  weight: number;
  isQualitative: boolean;
  parentKpiTitle?: string;
  status?: KpiStatus;
}

export interface KpiCardProps {
  data: KpiCardData;
  mode: 'edit' | 'review' | 'self';
  onRemove?: () => void;
  // self/edit 모드: AchievementField·입력 필드 슬롯.
  children?: React.ReactNode;
  // edit 모드 헤더 우측 추가 액션(예: 상위연계 셀렉트)
  headerExtra?: React.ReactNode;
}

const groupTone: Record<KpiGroup, string> = {
  performance_core: 'bg-secondary text-secondary-foreground',
  collaboration_growth: 'bg-success-50 text-success-700',
};

export function KpiCard({
  data,
  mode,
  onRemove,
  children,
  headerExtra,
}: KpiCardProps) {
  return (
    <section
      aria-label={`${data.title} (${kpiGroupLabel[data.group]} / ${kpiCategoryLabel[data.category]})`}
      className="border bg-card"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            className={cn('border-transparent font-medium', groupTone[data.group])}
          >
            {kpiGroupLabel[data.group]}
          </Badge>
          <Badge variant="secondary" className="font-medium">
            {kpiCategoryLabel[data.category]}
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            {kpiTypeLabel(data)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {data.status && <StatusBadge status={data.status} />}
          {headerExtra}
          {mode === 'edit' && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="과제 삭제"
              className="inline-flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              삭제
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-4 p-5">
        {/* review/self 모드: 핵심전략·과제명·CSF·측정방식 읽기 표시 */}
        {mode !== 'edit' && (
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-foreground">
              {data.title}
            </h3>
            <dl className="grid grid-cols-1 gap-1 text-sm text-foreground sm:grid-cols-2">
              <Row label="핵심전략" value={data.coreStrategy || '—'} />
              <Row label="CSF" value={data.csf || '—'} />
              <Row label="측정방법" value={data.measureMethod || '—'} />
              <Row
                label="목표값"
                value={
                  data.targetValue === undefined
                    ? '—'
                    : `${data.targetValue}${data.unit ?? ''}`
                }
              />
              <Row label="가중치" value={`${data.weight}%`} />
              {data.parentKpiTitle && (
                <Row label="상위연계" value={data.parentKpiTitle} />
              )}
            </dl>
          </div>
        )}

        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
