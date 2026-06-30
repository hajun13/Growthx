'use client';

import React from 'react';
import { GradeChip } from '@/components/GradeChip';
import { StatusBadge } from '@/components/StatusBadge';
import { KpiGradingDisplay } from '@/components/KpiGradingDisplay';
import { Collapsible } from '@/components/Collapsible';
import { kpiGroupLabel, kpiCategoryLabel } from '@/lib/ui';
import type { Kpi, Grade } from '@/lib/types';

const GRADE_KEYS = ['S', 'A', 'B', 'C', 'D'] as const;
type GradeKey = typeof GRADE_KEYS[number];

// ─── Collapsible 헤더 요약 (항상 보임) ───────────────────────────────
function LockedCardHeader({ kpi: k, index }: { kpi: Kpi; index: number }) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex h-5 min-w-5 flex-shrink-0 items-center justify-center border border-border bg-foreground px-1 text-[10px] font-bold tabular-nums text-background">
          {index + 1}
        </span>
        <span className={`whitespace-nowrap px-2 py-0.5 text-[10.5px] font-bold ${k.group === 'performance_core' ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background'}`}>
          {kpiGroupLabel[k.group]}
        </span>
        <span className="text-[10.5px] text-muted-foreground">
          {kpiCategoryLabel[k.category]}
        </span>
        <span className={`px-1.5 py-0.5 text-[10.5px] font-bold uppercase ${k.isQualitative ? 'bg-muted text-foreground' : 'bg-primary/[0.08] text-primary'}`}>
          {k.isQualitative ? '정성' : '정량'}
        </span>
        <span className="ml-auto rounded bg-primary/[0.07] px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-primary">
          {k.weight}%
        </span>
        <StatusBadge status={k.status} />
      </div>
      <div className="text-[15.5px] font-bold leading-snug text-foreground break-keep">
        {k.title}
      </div>
    </div>
  );
}

// ─── 상세 내용 (open 시에만 표시) ─────────────────────────────────
function LockedCardDetail({
  kpi: k,
  scales,
}: {
  kpi: Kpi;
  scales?: Parameters<typeof KpiGradingDisplay>[0]['scales'];
}) {
  const gc = k.gradingCriteria;
  const hasCustomGrading = gc && GRADE_KEYS.some((g) => (gc[g] ?? '').trim() !== '');
  // 헤더(접힘 바)에 제목·그룹·카테고리·정성정량·가중치·상태가 이미 있으므로 본문에선 생략(중첩 제거).
  const hasInfo = !!(k.coreStrategy || k.csf || k.targetText || k.measureMethod);
  const infoItems = [
    { label: '핵심전략', value: k.coreStrategy },
    { label: 'CSF(전략목표)', value: k.csf },
    { label: '목표', value: k.targetText },
    { label: '측정 방식', value: k.measureMethod },
  ].filter((item) => !!item.value);

  return (
    <>
      {k.status === 'rejected' && k.rejectReason && (
        <div className="px-6 pt-4 text-[11.5px] text-danger-600">반려사유: {k.rejectReason}</div>
      )}
      {hasInfo && (
        <div className="border-t border-border bg-card px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-3 w-1 bg-primary" aria-hidden />
            <div className="text-[12px] font-bold text-foreground">성과 내용</div>
          </div>
          <div className="grid grid-cols-1 gap-px border-y border-border/70 bg-border/70 xl:grid-cols-2">
            {infoItems.map((item) => (
              <div key={item.label} className="flex min-h-[76px] flex-col justify-center bg-card px-3 py-3">
                <span className="mb-1 block text-[11px] font-bold text-muted-foreground">{item.label}</span>
                <span className="text-[13.5px] leading-relaxed text-foreground break-keep">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 등급 부여 기준 섹션 */}
      <div className="border-t border-border bg-[#faf9f7] px-5 py-4">
        {hasCustomGrading && gc ? (
          <div className="rounded-none overflow-hidden border border-border/50">
            <div className="grid grid-cols-5" style={{ gap: 1, background: 'rgb(204 204 212 / 0.25)' }}>
              {GRADE_KEYS.map((g) => {
                const text = (gc[g] ?? '').trim();
                return (
                  <div key={g} className="flex items-center gap-2 bg-card p-3.5">
                    <GradeChip grade={g as Grade} />
                    <span className={`flex-1 text-[11px] leading-[1.55] ${text ? 'text-foreground' : 'text-disabled'}`}>
                      {text || '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <KpiGradingDisplay kpi={k} scales={scales} bare />
        )}
      </div>
    </>
  );
}

// ─── 제출 완료 모드: 접힘/펼침 KPI 카드 ─────────────────────────────
export function KpiLockedCard({
  kpi: k,
  index,
  scales,
  collapsed = true,
  onToggle,
}: {
  kpi: Kpi;
  index: number;
  scales?: Parameters<typeof KpiGradingDisplay>[0]['scales'];
  /** true(기본)이면 접힌 상태로 시작. false이면 펼쳐진 상태. */
  collapsed?: boolean;
  /** 헤더 클릭 시 호출. 제공되지 않으면 카드가 항상 펼쳐진 상태(레거시 호환). */
  onToggle?: () => void;
}) {
  // onToggle이 없으면 Collapsible 없이 기존처럼 완전 펼쳐 렌더 (레거시 호환)
  if (!onToggle) {
    return (
      <div className="overflow-hidden rounded-none border border-[#d1cbc4] border-l-4 border-l-primary bg-card transition-colors hover:border-primary/50">
        <LockedCardDetail kpi={k} scales={scales} />
      </div>
    );
  }

  return (
    <Collapsible
      open={!collapsed}
      onToggle={onToggle}
      className={[
        'rounded-none border-[#d1cbc4] border-l-4',
        collapsed ? 'border-l-[#9a948e]' : 'border-l-primary',
      ].join(' ')}
      header={<LockedCardHeader kpi={k} index={index} />}
      headerClassName="bg-card px-4 py-4 hover:bg-accent/40"
      bodyClassName="p-0"
    >
      <LockedCardDetail kpi={k} scales={scales} />
    </Collapsible>
  );
}
