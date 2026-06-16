'use client';

import { History } from 'lucide-react';
import { kpiGroupLabel, kpiCategoryLabel, measureTypeLabel } from '@/lib/ui';
import type { KpiDiffItem, KpiDiffField, KpiGroup, KpiCategory, MeasureType } from '@/lib/types';

const DIFF_FIELD_LABEL: Record<string, string> = {
  title: '지표명',
  category: '카테고리',
  group: '지표 그룹',
  measureType: '측정방식',
  targetValue: '목표값',
  weight: '가중치',
  isQualitative: '정성 여부',
};

function diffFieldLabel(field: string): string {
  return DIFF_FIELD_LABEL[field] ?? field;
}

function diffValueText(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '–';
  if (field === 'measureType') return measureTypeLabel[v as MeasureType] ?? String(v);
  if (field === 'group') return kpiGroupLabel[v as KpiGroup] ?? String(v);
  if (field === 'category') return kpiCategoryLabel[v as KpiCategory] ?? String(v);
  if (field === 'isQualitative') return v ? '정성' : '정량';
  if (field === 'weight') return `${v}%`;
  return String(v);
}

function DiffSection({
  title,
  count,
  colorClass,
  children,
}: {
  title: string;
  count: number;
  colorClass: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`text-[11px] font-bold text-white px-2 py-0.5 rounded ${colorClass}`}>
          {title}
        </span>
        <span className="text-[11.5px] text-muted-foreground">{count}건</span>
      </div>
      <ul className="space-y-1.5 pl-1">{children}</ul>
    </div>
  );
}

// ─── Cycle Ops §4: 1차 확정 대비 변경 내역 패널 ─────────────────
export function KpiDiffPanel({
  label,
  createdAt,
  added,
  removed,
  changed,
  unchangedCount,
}: {
  label: string;
  createdAt: string;
  added: KpiDiffItem[];
  removed: KpiDiffItem[];
  changed: KpiDiffItem[];
  unchangedCount: number;
}) {
  const createdStr = (() => {
    const d = new Date(createdAt);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  })();
  const hasChanges = added.length + removed.length + changed.length > 0;

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card shadow-elev-1">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-border bg-muted">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <History size={14} className="text-muted-foreground" aria-hidden />
          {label} 대비 변경 내역
        </h3>
        <span className="text-[11.5px] text-muted-foreground">
          {createdStr && `기준 ${createdStr} · `}변경 없음 {unchangedCount}건
        </span>
      </div>
      <div className="p-4 space-y-4">
        {!hasChanges ? (
          <p className="text-[12.5px] text-muted-foreground">1차 확정 이후 변경된 KPI가 없어요.</p>
        ) : (
          <>
            {added.length > 0 && (
              <DiffSection title="신규" count={added.length} colorClass="bg-success-600">
                {added.map((it) => (
                  <li key={`add-${it.id}`} className="text-[12.5px] text-default">
                    {it.title || '(제목 없음)'}
                  </li>
                ))}
              </DiffSection>
            )}
            {removed.length > 0 && (
              <DiffSection title="삭제" count={removed.length} colorClass="bg-danger-600">
                {removed.map((it) => (
                  <li key={`rm-${it.id}`} className="text-[12.5px] text-default line-through">
                    {it.title || '(제목 없음)'}
                  </li>
                ))}
              </DiffSection>
            )}
            {changed.length > 0 && (
              <DiffSection title="변경" count={changed.length} colorClass="bg-primary">
                {changed.map((it) => (
                  <li key={`ch-${it.id}`} className="text-[12.5px] text-default">
                    <div className="font-semibold">{it.title || '(제목 없음)'}</div>
                    <ul className="mt-0.5">
                      {(it.fields ?? []).map((f: KpiDiffField, i: number) => (
                        <li key={i} className="text-[12px] text-muted-foreground">
                          {diffFieldLabel(f.field)}: {diffValueText(f.field, f.before)}
                          {' → '}
                          <span className="text-foreground font-semibold">
                            {diffValueText(f.field, f.after)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </DiffSection>
            )}
          </>
        )}
      </div>
    </div>
  );
}
