'use client';

// 평가 규칙 상단 요약 — "규칙 요약" 지표 4종 + "저장 전 점검" 체크 3종.
import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RuleSetDraft } from '@/components/RuleSetEditor';
import { GRADES } from '../draft';

const TIERS_FOR_SUMMARY = ['excellent', 'standard', 'poor'] as const;

function RuleMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-3">
      <div className="text-11 font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-16 font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function RuleCheck({ ok, title, text }: { ok: boolean; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center border',
          ok
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-warning-300 bg-warning-50 text-warning-700',
        )}
      >
        {ok ? <CheckCircle2 size={13} aria-hidden /> : <AlertTriangle size={13} aria-hidden />}
      </span>
      <span>
        <span className="block text-13 font-bold text-foreground">{title}</span>
        <span className="mt-0.5 block text-12 leading-relaxed text-muted-foreground">{text}</span>
      </span>
    </div>
  );
}

function SummaryTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-border">
      <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-4 px-4 py-3">
        <CardTitle className="text-15 font-bold leading-5.5 tracking-normal text-foreground">
          {children}
        </CardTitle>
      </CardHeader>
    </div>
  );
}

export function RulesSummary({
  draft,
  ok,
  issues,
}: {
  draft: RuleSetDraft;
  ok: boolean;
  issues: string[];
}) {
  const s = useMemo(() => {
    const stageWeightSum =
      draft.stageWeights.teamLeader + draft.stageWeights.divisionHead + draft.stageWeights.ceo;
    const kpiWeightSum =
      draft.weightPolicy.kpiGroupWeights.performance_core +
      draft.weightPolicy.kpiGroupWeights.collaboration_growth;
    const poolBalancedCount = TIERS_FOR_SUMMARY.filter((tier) => {
      const sum = GRADES.reduce((acc, grade) => acc + (draft.poolRatios[tier][grade] || 0), 0);
      return Math.abs(sum - 100) <= 0.01;
    }).length;
    return { stageWeightSum, kpiWeightSum, poolBalancedCount };
  }, [draft]);

  return (
    <div className="gx-workbench-grid">
      <Card>
        <SummaryTitle>
          <span className="flex items-center gap-2">
            <Scale size={16} className="text-primary" aria-hidden />
            규칙 요약
          </span>
        </SummaryTitle>
        <CardContent className="p-4 md:p-5">
          <div className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
            <RuleMetric label="등급 구간" value="S-D 5단계" />
            <RuleMetric label="부서장 단계 가중치" value={`${Math.round(s.stageWeightSum * 100)}%`} />
            <RuleMetric label="KPI 그룹 가중치" value={`${s.kpiWeightSum}%`} />
            <RuleMetric label="풀 비율 정상" value={`${s.poolBalancedCount}/3`} />
          </div>
          <p className="mt-3 text-12 leading-relaxed text-muted-foreground">
            이 화면의 변경은 등급 산정, 등급풀, 인상률, KPI 가중치에 영향을 줍니다. 저장 전 검증을 통과한 값만 백엔드 규칙 세트로 반영됩니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <SummaryTitle>저장 전 점검</SummaryTitle>
        <CardContent className="p-4 md:p-5">
          <div className="space-y-3">
            <RuleCheck
              ok={ok}
              title="입력값 검증"
              text={ok ? '저장 가능한 상태입니다.' : issues[0] ?? '입력값을 확인해 주세요.'}
            />
            <RuleCheck
              ok={Math.abs(s.stageWeightSum - 1) <= 0.01}
              title="평가 단계 합계"
              text={`현재 ${Math.round(s.stageWeightSum * 100)}%입니다. 팀장·본부장·대표 단계 합이 100%여야 합니다.`}
            />
            <RuleCheck
              ok={s.kpiWeightSum === 100}
              title="KPI 그룹 가중치"
              text={`성과중심 + 협업·성장 합계가 현재 ${s.kpiWeightSum}%입니다.`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
