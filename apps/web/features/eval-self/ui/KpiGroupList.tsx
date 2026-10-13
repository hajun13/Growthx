'use client';

// 그룹별(성과중심/협업·성장) KPI 접이식 카드 목록 — 완료 항목은 접힘, 미완료는 펼침.
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GradeChip } from '@/components/GradeChip';
import { kpiCategoryLabel } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { EvaluationEvidence, Grade, Kpi, KpiGroup, KpiScore, RuleSet } from '@/lib/types';
import { KpiCard } from './KpiCard';

export interface AchInput {
  actualValue?: number;
  count?: number;
  actualAmount?: number;
  qualitativeNote?: string;
  directGrade?: Grade;
}

// KPI 그룹 색 — KPI 작성/검토 화면과 동일 쌍(bg-primary=성과중심 / bg-foreground=협업·성장)으로 통일.
const GROUP_CFG: Record<KpiGroup, { label: string; bar: string; chip: string }> = {
  performance_core: { label: '성과중심 지표', bar: 'bg-primary', chip: 'bg-primary text-primary-foreground' },
  collaboration_growth: { label: '협업·성장 지표', bar: 'bg-foreground', chip: 'bg-foreground text-background' },
};

const GROUPS: KpiGroup[] = ['performance_core', 'collaboration_growth'];

interface Props {
  kpis: Kpi[];
  inputs: Record<string, AchInput>;
  scoreByKpi: Map<string, KpiScore>;
  readOnly: boolean;
  ruleSet: RuleSet | null | undefined;
  evaluationId: string;
  evidenceByKpi: Map<string, EvaluationEvidence[]>;
  isComplete: (k: Kpi) => boolean;
  isKpiOpen: (kpiId: string) => boolean;
  onToggle: (kpiId: string) => void;
  onUpdateInput: (kpiId: string, patch: AchInput) => void;
  onEvidenceChanged: () => void;
}

export function KpiGroupList({
  kpis,
  inputs,
  scoreByKpi,
  readOnly,
  ruleSet,
  evaluationId,
  evidenceByKpi,
  isComplete,
  isKpiOpen,
  onToggle,
  onUpdateInput,
  onEvidenceChanged,
}: Props) {
  return (
    <>
      {GROUPS.map((group) => {
        const rows = kpis.filter((k) => k.group === group);
        if (rows.length === 0) return null;
        const cfg = GROUP_CFG[group];
        return (
          <div key={group} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-3.75 w-1 rounded-sm ${cfg.bar}`} aria-hidden />
              <span className="text-14 font-bold text-foreground">{cfg.label}</span>
              <span className="text-12 text-muted-foreground">{rows.length}개 과제</span>
            </div>
            <div className="space-y-5">
              {rows.map((kpi) => {
                const open = isKpiOpen(kpi.id);
                const done = isComplete(kpi);
                const score = scoreByKpi.get(kpi.id);
                const liveGrade =
                  kpi.measureType === 'qualitative'
                    ? (inputs[kpi.id]?.directGrade ?? score?.grade)
                    : score?.grade;
                const index = kpis.findIndex((item) => item.id === kpi.id) + 1;
                return (
                  <div
                    key={kpi.id}
                    className={cn(
                      'overflow-hidden rounded-lg border border-l-4 border-neutral-300 bg-card shadow-sm',
                      open ? 'border-l-primary' : 'border-l-muted-foreground/40',
                    )}
                  >
                    <Collapsible open={open} onOpenChange={() => onToggle(kpi.id)}>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center gap-3 bg-card px-4 py-4 text-left transition-colors hover:bg-accent/40">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-foreground px-1 text-10 font-bold tabular-nums text-background">
                                {index}
                              </span>
                              <span
                                className={`inline-block shrink-0 rounded-sm px-2 py-0.5 text-10h font-bold ${cfg.chip}`}
                              >
                                {kpiCategoryLabel[kpi.category] ?? kpi.category}
                              </span>
                              <span className="min-w-0 flex-1 break-keep text-15 font-bold leading-snug text-foreground">
                                {kpi.title}
                              </span>
                              <span className="shrink-0 rounded-sm bg-primary/7 px-2 py-0.5 text-11h font-bold tabular-nums text-primary">
                                가중치 {kpi.weight}%
                              </span>
                              {liveGrade ? (
                                <GradeChip grade={liveGrade} size="sm" />
                              ) : done ? (
                                <Badge variant="success" shape="pill" size="xs" className="shrink-0">
                                  완료
                                </Badge>
                              ) : (
                                <Badge variant="warning" shape="pill" size="xs" className="shrink-0">
                                  미완료
                                </Badge>
                              )}
                            </div>
                          </div>
                          <ChevronDown
                            aria-hidden
                            className={cn(
                              'size-4.5 shrink-0 text-muted-foreground transition-transform duration-200',
                              open && 'rotate-180',
                            )}
                          />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t border-border">
                          <KpiCard
                            kpi={kpi}
                            score={score ?? null}
                            inp={inputs[kpi.id] ?? {}}
                            readOnly={readOnly}
                            ruleSet={ruleSet}
                            evaluationId={evaluationId}
                            evidenceFiles={evidenceByKpi.get(kpi.id) ?? []}
                            onUpdateInput={onUpdateInput}
                            onEvidenceChanged={onEvidenceChanged}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
