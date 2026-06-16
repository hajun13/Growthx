'use client';

import React from 'react';
import { GradeChip } from '@/components/GradeChip';
import { StatusBadge } from '@/components/StatusBadge';
import { KpiGradingDisplay } from '@/components/KpiGradingDisplay';
import { kpiGroupLabel, kpiCategoryLabel } from '@/lib/ui';
import { gradeColor } from '@/lib/grade';
import type { Kpi, Grade } from '@/lib/types';

const GRADE_KEYS = ['S', 'A', 'B', 'C', 'D'] as const;
type GradeKey = typeof GRADE_KEYS[number];

// ─── 제출 완료 모드: 상세형 KPI 카드 ────────────────────────────────
export function KpiLockedCard({
  kpi: k,
  index,
  scales,
}: {
  kpi: Kpi;
  index: number;
  scales?: Parameters<typeof KpiGradingDisplay>[0]['scales'];
}) {
  const gc = k.gradingCriteria;
  const hasCustomGrading = gc && GRADE_KEYS.some((g) => (gc[g] ?? '').trim() !== '');

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card shadow-elev-1 transition-colors hover:border-primary/30">
      <div className="p-6">
        {/* 카드 상단: 제목 + 뱃지 / 가중치 원형 */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="inline-flex items-center justify-center tabular-nums w-[22px] h-[22px] text-[11px] font-bold text-white bg-primary rounded-md flex-shrink-0">
                {index + 1}
              </span>
              <h4 className="text-[15px] font-bold text-primary">{k.title}</h4>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${k.isQualitative ? 'bg-info-50 text-info-700' : 'bg-purple-50 text-purple-700'}`}>
                {k.isQualitative ? '정성' : '정량'}
              </span>
              <StatusBadge status={k.status} />
            </div>
            <div className="text-[11.5px] text-muted-foreground">
              {kpiGroupLabel[k.group]} · {kpiCategoryLabel[k.category]}
              {k.status === 'rejected' && k.rejectReason ? ` · 반려사유: ${k.rejectReason}` : ''}
            </div>
          </div>
          {/* 우측: 가중치 원형 */}
          <div className="flex flex-col items-center justify-center flex-shrink-0 w-20 h-20 rounded-full border-[3px] border-primary/12 bg-primary/4">
            <span className="text-[9px] font-semibold text-primary uppercase">가중치</span>
            <span className="tabular-nums text-[20px] font-extrabold text-primary leading-tight">
              {k.weight}%
            </span>
          </div>
        </div>

        {/* 2컬럼 정보 그리드 */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-muted border border-border/50 p-4 mt-3.5">
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

      {/* 등급 부여 기준 섹션 */}
      <div className="border-t border-border p-6 bg-card">
        {hasCustomGrading && gc ? (
          <div className="rounded-xl overflow-hidden border border-border/50">
            <div className="grid grid-cols-5" style={{ gap: 1, background: 'rgb(204 204 212 / 0.25)' }}>
              {GRADE_KEYS.map((g) => {
                const gcol = gradeColor(g as Grade);
                const text = (gc[g] ?? '').trim();
                return (
                  <div key={g} className="flex flex-col items-center gap-2 bg-card p-3.5">
                    <GradeChip grade={g as Grade} variant="soft" />
                    <span className={`text-[11px] text-center leading-[1.55] mt-0.5 ${text ? 'text-foreground' : 'text-disabled'}`}>
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
    </div>
  );
}
