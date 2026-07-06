'use client';

/**
 * DeptHeadEvalView.tsx에서 분리 (파일 200줄 상한).
 * 성과중심/협업·성장 그룹별 KPI 카드 목록 — 그룹 헤더 + Collapsible + KpiEvalCard.
 */
import { HelpTooltip } from '@/components/HelpTooltip';
import { DesignLabel } from '@/components/DesignLabel';
import { GradeChip } from '@/components/GradeChip';
import { Collapsible } from '@/components/Collapsible';
import { kpiCategoryLabel } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { Grade, Kpi, KpiScore, KpiGroup, EvaluationEvidence, RuleSet } from '@/lib/types';
import { KpiEvalCard } from './DeptHeadKpiEvalCard';

const GROUP_CFG: Record<KpiGroup, { label: string; accent: string }> = {
  performance_core: { label: '성과중심 지표', accent: 'bg-primary' },
  collaboration_growth: { label: '협업·성장 지표', accent: 'bg-neutral-500' },
};

export function DeptHeadKpiGroupList({
  coreKpis,
  growthKpis,
  allKpis,
  selfScoreByKpi,
  directGrades,
  reviewerNotes,
  evidenceByKpi,
  isKpiOpen,
  isKpiDone,
  toggleKpi,
  onGrade,
  onReviewerNote,
  onPreview,
  readOnly,
  gradingScales,
  revenueGradeScale,
}: {
  coreKpis: Kpi[];
  growthKpis: Kpi[];
  allKpis: Kpi[];
  selfScoreByKpi: Map<string, KpiScore>;
  directGrades: Record<string, Grade>;
  reviewerNotes: Record<string, string>;
  evidenceByKpi: Map<string, EvaluationEvidence[]>;
  isKpiOpen: (kpiId: string) => boolean;
  isKpiDone: (kpi: Kpi) => boolean;
  toggleKpi: (kpiId: string) => void;
  onGrade: (kpiId: string, g: Grade) => void;
  onReviewerNote: (kpiId: string, v: string) => void;
  onPreview: (f: EvaluationEvidence) => void;
  readOnly: boolean;
  gradingScales?: RuleSet['gradingScales'];
  revenueGradeScale?: { grade: Grade; minAmount: number }[];
}) {
  return (
    <>
      {(['performance_core', 'collaboration_growth'] as KpiGroup[]).map((group) => {
        const rows = group === 'performance_core' ? coreKpis : growthKpis;
        if (rows.length === 0) return null;
        const cfg = GROUP_CFG[group];
        return (
          <div key={group} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={cn('w-1 h-4 inline-block rounded-sm flex-shrink-0', cfg.accent)} />
              <span className="text-[14px] font-bold text-foreground">{cfg.label}</span>
              <span className="text-[12px] text-muted-foreground">{rows.length}개 과제</span>
              <HelpTooltip
                label={`${cfg.label} 평가 방식 설명 보기`}
                content="수치 과제의 실적·등급은 본인평가에서 자동 연동돼요(부서장이 바꾸지 않아요). 정성 과제는 본인 등급을 참고해 부서장 등급을 직접 부여하세요."
              />
            </div>

            <div className="w-full space-y-4">
              {rows.map((kpi) => {
                const done = isKpiDone(kpi);
                const selfScore = selfScoreByKpi.get(kpi.id) ?? null;
                const displayGrade =
                  kpi.measureType === 'qualitative'
                    ? (directGrades[kpi.id] ?? selfScore?.grade ?? null)
                    : (selfScore?.grade ?? null);
                const index = allKpis.findIndex((item) => item.id === kpi.id) + 1;
                return (
                  <Collapsible
                    key={kpi.id}
                    open={isKpiOpen(kpi.id)}
                    onToggle={() => toggleKpi(kpi.id)}
                    header={
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-foreground px-1 text-[10px] font-bold tabular-nums text-background">
                          {index}
                        </span>
                        <DesignLabel tone={group === 'performance_core' ? 'primary' : 'darkgray'}>
                          {kpiCategoryLabel[kpi.category]}
                        </DesignLabel>
                        <span className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-foreground break-keep">
                          {kpi.title}
                        </span>
                        <span className="shrink-0 rounded bg-primary/[0.07] px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-primary">
                          가중치 {kpi.weight}%
                        </span>
                        {displayGrade && <GradeChip grade={displayGrade} size="sm" />}
                        {done ? (
                          <DesignLabel tone="green">평가 완료</DesignLabel>
                        ) : (
                          <DesignLabel tone="amber">미완료</DesignLabel>
                        )}
                      </div>
                    }
                    headerClassName="bg-card px-4 py-4 hover:bg-accent/40"
                    className={[
                      'w-full rounded-lg border-neutral-300 shadow-elev-1 border-l-4',
                      isKpiOpen(kpi.id) ? 'border-l-primary' : 'border-l-muted-foreground/40',
                    ].join(' ')}
                    bodyClassName="bg-card p-0"
                  >
                    <KpiEvalCard
                      kpi={kpi}
                      selfScore={selfScore}
                      directGrade={directGrades[kpi.id] ?? null}
                      onGrade={(g) => onGrade(kpi.id, g)}
                      reviewerNote={reviewerNotes[kpi.id] ?? ''}
                      onReviewerNote={(v) => onReviewerNote(kpi.id, v)}
                      noteMissing={!readOnly && (reviewerNotes[kpi.id] ?? '').trim().length === 0}
                      evidence={evidenceByKpi.get(kpi.id) ?? []}
                      onPreview={onPreview}
                      readOnly={readOnly}
                      gradingScales={gradingScales}
                      revenueGradeScale={revenueGradeScale}
                    />
                  </Collapsible>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
