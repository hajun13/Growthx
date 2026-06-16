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
    <div className="flex items-center gap-2.5 flex-wrap py-0.5">
      {/* 순번 배지 */}
      <span className="inline-flex items-center justify-center tabular-nums w-[22px] h-[22px] text-[11px] font-bold text-white bg-primary rounded-md flex-shrink-0">
        {index + 1}
      </span>
      {/* KPI 제목 */}
      <span className="text-[14px] font-bold text-foreground truncate max-w-[240px] sm:max-w-none">
        {k.title}
      </span>
      {/* 그룹 칩 */}
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${k.group === 'performance_core' ? 'bg-primary/10 text-primary' : 'bg-success-50 text-success-700'}`}>
        {kpiGroupLabel[k.group]}
      </span>
      {/* 카테고리 칩 */}
      <span className="text-[10px] text-muted-foreground">
        {kpiCategoryLabel[k.category]}
      </span>
      {/* 정성/정량 */}
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${k.isQualitative ? 'bg-info-50 text-info-700' : 'bg-purple-50 text-purple-700'}`}>
        {k.isQualitative ? '정성' : '정량'}
      </span>
      {/* 가중치 */}
      <span className="tabular-nums text-[12px] font-extrabold text-primary ml-auto">
        {k.weight}%
      </span>
      {/* 상태 배지 */}
      <StatusBadge status={k.status} />
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

  return (
    <>
      {k.status === 'rejected' && k.rejectReason && (
        <div className="px-6 pt-4 text-[11.5px] text-danger-600">반려사유: {k.rejectReason}</div>
      )}
      {hasInfo && (
        <div className="p-6">
        {/* 2컬럼 정보 그리드 */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-muted border border-border/50 p-4">
          {k.coreStrategy && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">핵심전략</span>
              <span className="text-[13px] font-semibold text-foreground">{k.coreStrategy}</span>
            </div>
          )}
          {k.csf && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">전략목표 (CSF)</span>
              <span className="text-[13px] font-semibold text-foreground">{k.csf}</span>
            </div>
          )}
          {k.targetText && (
            <div className="flex flex-col gap-1 border-t border-border pt-2.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">2026년 목표</span>
              <span className="text-[13px] font-semibold text-foreground">{k.targetText}</span>
            </div>
          )}
          {k.measureMethod && (
            <div className="flex flex-col gap-1 border-t border-border pt-2.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">측정방식</span>
              <span className="text-[13px] font-semibold text-foreground">{k.measureMethod}</span>
            </div>
          )}
        </div>
        </div>
      )}

      {/* 등급 부여 기준 섹션 */}
      <div className="border-t border-border p-6 bg-card">
        {hasCustomGrading && gc ? (
          <div className="rounded-xl overflow-hidden border border-border/50">
            <div className="grid grid-cols-5" style={{ gap: 1, background: 'rgb(204 204 212 / 0.25)' }}>
              {GRADE_KEYS.map((g) => {
                const text = (gc[g] ?? '').trim();
                return (
                  <div key={g} className="flex items-start gap-2 bg-card p-3.5">
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
      <div className="rounded-xl overflow-hidden border border-border bg-card shadow-elev-1 transition-colors hover:border-primary/30">
        <LockedCardDetail kpi={k} scales={scales} />
      </div>
    );
  }

  return (
    <Collapsible
      open={!collapsed}
      onToggle={onToggle}
      className="rounded-xl"
      header={<LockedCardHeader kpi={k} index={index} />}
      bodyClassName="p-0"
    >
      <LockedCardDetail kpi={k} scales={scales} />
    </Collapsible>
  );
}
