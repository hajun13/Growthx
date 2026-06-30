'use client';

// 평가 규칙 설정(HR) — 현재 주기의 RuleSet(등급 척도·달성률표·그룹풀비율·등급별 인상률·
// 그룹실적 보너스·가중치 정책)을 편집. 인상률·그룹실적 보너스를 회사가 바꾸는 단일 화면.
// 데이터: @growthx/contracts ruleSetsController* (GET/PATCH /rule-sets) — 생성 클라이언트로 이관.
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Save, Scale } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import {
  RuleSetEditor,
  validateRuleSet,
  type RuleSetDraft,
} from '@/components/RuleSetEditor';
import { EmptyState, ErrorState, Forbidden, Skeleton } from '@/components/States';
import { isHrAdmin } from '@/lib/nav';
import type { Grade, RuleSet } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { useRuleSetData, ruleSetCommands } from '../hooks';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// groupTierBonus 미설정 시 기본값(business-rules §5, 2026 seed — 백엔드와 동일).
const DEFAULT_GROUP_TIER_BONUS: RuleSetDraft['groupTierBonus'] = {
  excellent: 2,
  standard: 0,
  poor: -1,
};

// 갭 #1·#2·#3 미설정 시 기본값(contract-ruleset-gaps.md — 백엔드 2026 폴백과 동일).
const DEFAULT_GROUP_TIER_THRESHOLDS: RuleSetDraft['groupTierThresholds'] = {
  excellent: 100,
  standard: 90,
};
const DEFAULT_REVENUE_GRADE_SCALE: RuleSetDraft['revenueGradeScale'] = [
  { grade: 'S', minAmount: 1_000_000_000 },
  { grade: 'A', minAmount: 800_000_000 },
  { grade: 'B', minAmount: 600_000_000 },
  { grade: 'C', minAmount: 400_000_000 },
  { grade: 'D', minAmount: 0 },
];
const DEFAULT_KPI_GROUP_WEIGHTS: RuleSetDraft['weightPolicy']['kpiGroupWeights'] = {
  performance_core: 80,
  collaboration_growth: 20,
};

// RuleSet(API) → RuleSetDraft(편집 모델). groupTierBonus·신규 5필드는 weightPolicy 에서 추출.
function toDraft(rs: RuleSet): RuleSetDraft {
  const wp = rs.weightPolicy;
  const gtb: Partial<RuleSetDraft['groupTierBonus']> = wp.groupTierBonus ?? {};
  // revenueGradeScale 은 S~D 5행을 보장(누락 등급은 기본값으로 채움).
  const rgsByGrade = new Map(
    (wp.revenueGradeScale ?? []).map((e) => [e.grade, e.minAmount]),
  );
  return {
    gradeScale: GRADES.map((g) => {
      const e = rs.gradeScale.find((x) => x.grade === g);
      return { grade: g, min: e?.min ?? 0, max: e?.max ?? 0 };
    }),
    gradingScales: {
      amount: GRADES.map((g) => {
        const e = rs.gradingScales.amount.find((x) => x.grade === g);
        return { grade: g, minRate: e?.minRate ?? 0, maxRate: e?.maxRate ?? null };
      }),
      rate: GRADES.map((g) => {
        const e = rs.gradingScales.rate.find((x) => x.grade === g);
        return { grade: g, minRate: e?.minRate ?? 0, maxRate: e?.maxRate ?? null };
      }),
    },
    poolRatios: {
      excellent: { ...rs.poolRatios.excellent },
      standard: { ...rs.poolRatios.standard },
      poor: { ...rs.poolRatios.poor },
    },
    raiseRates: { ...rs.raiseRates },
    groupTierBonus: {
      excellent: gtb.excellent ?? DEFAULT_GROUP_TIER_BONUS.excellent,
      standard: gtb.standard ?? DEFAULT_GROUP_TIER_BONUS.standard,
      poor: gtb.poor ?? DEFAULT_GROUP_TIER_BONUS.poor,
    },
    groupTierThresholds: {
      excellent:
        wp.groupTierThresholds?.excellent ??
        DEFAULT_GROUP_TIER_THRESHOLDS.excellent,
      standard:
        wp.groupTierThresholds?.standard ??
        DEFAULT_GROUP_TIER_THRESHOLDS.standard,
    },
    revenueGradeScale: GRADES.map((g) => ({
      grade: g,
      minAmount:
        rgsByGrade.get(g) ??
        DEFAULT_REVENUE_GRADE_SCALE.find((e) => e.grade === g)!.minAmount,
    })),
    stageWeights: {
      teamLeader: wp.stageWeights?.teamLeader ?? wp.evaluatorWeights?.teamLeader ?? 0.5,
      divisionHead: wp.stageWeights?.divisionHead ?? wp.evaluatorWeights?.divisionHead ?? 0.3,
      ceo: wp.stageWeights?.ceo ?? wp.evaluatorWeights?.ceo ?? 0.2,
    },
    perfCompWeights: {
      // 역량은 등급산정 미반영(참고용) → 기본 실적 1·역량 0.
      perf: wp.perfCompWeights?.perf ?? 1,
      comp: wp.perfCompWeights?.comp ?? 0,
    },
    weightPolicy: {
      totalMustEqual: wp.totalMustEqual,
      qualitativeMaxPercent: wp.qualitativeMaxPercent,
      kpiGroupWeights: {
        performance_core:
          wp.kpiGroupWeights?.performance_core ??
          DEFAULT_KPI_GROUP_WEIGHTS.performance_core,
        collaboration_growth:
          wp.kpiGroupWeights?.collaboration_growth ??
          DEFAULT_KPI_GROUP_WEIGHTS.collaboration_growth,
      },
      enforceQualitativeCap: wp.enforceQualitativeCap ?? false,
      enforceGroupRatio: wp.enforceGroupRatio ?? false,
    },
  };
}

// RuleSetDraft → PATCH 바디(API shape). 신규 5필드는 weightPolicy 안으로 직렬화(계약 §공통 원칙).
function toPatchBody(d: RuleSetDraft): Partial<RuleSet> {
  return {
    gradeScale: d.gradeScale,
    gradingScales: d.gradingScales,
    poolRatios: d.poolRatios,
    raiseRates: d.raiseRates,
    weightPolicy: {
      totalMustEqual: d.weightPolicy.totalMustEqual,
      qualitativeMaxPercent: d.weightPolicy.qualitativeMaxPercent,
      groupTierBonus: d.groupTierBonus,
      groupTierThresholds: d.groupTierThresholds,
      revenueGradeScale: d.revenueGradeScale,
      kpiGroupWeights: d.weightPolicy.kpiGroupWeights,
      enforceQualitativeCap: d.weightPolicy.enforceQualitativeCap,
      enforceGroupRatio: d.weightPolicy.enforceGroupRatio,
      // 다단계 평가 가중치 — stageWeights·evaluatorWeights 두 키 동기화(aggregate 폴백 호환).
      stageWeights: d.stageWeights,
      evaluatorWeights: d.stageWeights,
      perfCompWeights: d.perfCompWeights,
    },
  };
}

export function RulesView() {
  const { user } = useAuth();
  const toast = useToast();
  const { current, loading: cyclesLoading } = useCurrentCycle();
  const { hasFeature } = usePermissions();
  const allowed = !!user && isHrAdmin(user.role);
  // 저장 엔드포인트(PATCH /rule-sets/:id)는 백엔드에서 '시스템 설정' feature 하나만 요구한다.
  // '등급풀 수정'만 가진 사용자는 저장 시 403이 나므로 canEdit는 '시스템 설정' 단독으로 게이트한다.
  const canEdit = hasFeature('시스템 설정');

  const ruleSetId = current?.ruleSetId ?? null;
  const {
    data: ruleSet,
    loading: rsLoading,
    error,
    reload,
  } = useRuleSetData(allowed ? ruleSetId : null);

  const [draft, setDraft] = useState<RuleSetDraft | null>(null);
  const [measureTab, setMeasureTab] = useState<'amount' | 'rate'>('amount');
  const [busy, setBusy] = useState(false);

  // RuleSet 로드 → 편집 드래프트 초기화(역매핑).
  useEffect(() => {
    if (ruleSet) {
      setDraft(toDraft(ruleSet));
    }
  }, [ruleSet]);

  const validation = useMemo(
    () => (draft ? validateRuleSet(draft) : { ok: false }),
    [draft],
  );
  const validationIssues = useMemo(
    () =>
      Object.entries(validation)
        .filter(([key, value]) => key !== 'ok' && Boolean(value))
        .map(([, value]) => String(value)),
    [validation],
  );
  const ruleSummary = useMemo(() => {
    if (!draft) {
      return {
        stageWeightSum: 0,
        kpiWeightSum: 0,
        poolBalancedCount: 0,
      };
    }
    const stageWeightSum =
      draft.stageWeights.teamLeader +
      draft.stageWeights.divisionHead +
      draft.stageWeights.ceo;
    const kpiWeightSum =
      draft.weightPolicy.kpiGroupWeights.performance_core +
      draft.weightPolicy.kpiGroupWeights.collaboration_growth;
    const poolBalancedCount = TIERS_FOR_SUMMARY.filter((tier) => {
      const sum = GRADES.reduce((acc, grade) => acc + (draft.poolRatios[tier][grade] || 0), 0);
      return Math.abs(sum - 100) <= 0.01;
    }).length;
    return {
      stageWeightSum,
      kpiWeightSum,
      poolBalancedCount,
    };
  }, [draft]);

  async function handleSave() {
    if (!ruleSet || !draft || !canEdit) return;
    const v = validateRuleSet(draft);
    if (!v.ok) {
      toast.show({
        variant: 'danger',
        message: '입력값을 확인해 주세요. 빨간 안내가 있는 항목이 있어요.',
      });
      return;
    }
    setBusy(true);
    try {
      await ruleSetCommands.update(ruleSet.id, toPatchBody(draft));
      toast.show({ variant: 'success', message: '평가 규칙을 저장했어요.' });
      reload();
    } catch (err) {
      toast.show({
        variant: 'danger',
        message: err instanceof Error ? err.message : '저장에 실패했어요.',
      });
    } finally {
      setBusy(false);
    }
  }

  if (!allowed)
    return <Forbidden message="평가 규칙은 관리자(HR)만 설정할 수 있어요." />;
  if (cyclesLoading || rsLoading) return <Skeleton className="h-64 w-full" />;

  if (!ruleSetId)
    return (
      <PageContainer>
        <PageHeader title="평가 규칙" subtitle={rulesSubtitle(current?.name)} />
        <EmptyState
          title="규칙 세트가 없어요."
          description="현재 주기에 연결된 규칙 세트가 없어요. ‘평가 운영’에서 주기에 규칙을 먼저 연결해 주세요."
        />
      </PageContainer>
    );

  if (error)
    return (
      <PageContainer>
        <PageHeader title="평가 규칙" subtitle={rulesSubtitle(current?.name)} />
        <ErrorState message={error.message} onRetry={reload} />
      </PageContainer>
    );

  if (!draft) return <Skeleton className="h-64 w-full" />;

  return (
    <PageContainer>
      <PageHeader
        title="평가 규칙"
        subtitle={rulesSubtitle(current?.name)}
        right={
          canEdit ? (
            <>
              {!validation.ok && (
                <span className="text-[11.5px] font-semibold text-destructive">
                  빨간 표시 항목을 확인해 주세요
                </span>
              )}
              <Button
                variant="primary"
                leftIcon={<Save size={14} />}
                loading={busy}
                disabled={busy || !validation.ok}
                onClick={() => void handleSave()}
              >
                규칙 저장
              </Button>
            </>
          ) : (
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              읽기 전용 — 규칙 편집 권한이 없어요
            </span>
          )
        }
      />

      <div className="gx-workbench-grid">
        <Card
          title={
            <span className="flex items-center gap-2">
              <Scale size={16} className="text-primary" aria-hidden />
              규칙 요약
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
            <RuleMetric label="등급 구간" value="S-D 5단계" />
            <RuleMetric label="부서장 단계 가중치" value={`${Math.round(ruleSummary.stageWeightSum * 100)}%`} />
            <RuleMetric label="KPI 그룹 가중치" value={`${ruleSummary.kpiWeightSum}%`} />
            <RuleMetric label="풀 비율 정상" value={`${ruleSummary.poolBalancedCount}/3`} />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            이 화면의 변경은 등급 산정, 등급풀, 인상률, KPI 가중치에 영향을 줍니다. 저장 전 검증을 통과한 값만 백엔드 규칙 세트로 반영됩니다.
          </p>
        </Card>

        <Card title="저장 전 점검">
          <div className="space-y-3">
            <RuleCheck
              ok={validation.ok}
              title="입력값 검증"
              text={validation.ok ? '저장 가능한 상태입니다.' : validationIssues[0] ?? '입력값을 확인해 주세요.'}
            />
            <RuleCheck
              ok={Math.abs(ruleSummary.stageWeightSum - 1) <= 0.01}
              title="평가 단계 합계"
              text={`현재 ${Math.round(ruleSummary.stageWeightSum * 100)}%입니다. 팀장·본부장·대표 단계 합이 100%여야 합니다.`}
            />
            <RuleCheck
              ok={ruleSummary.kpiWeightSum === 100}
              title="KPI 그룹 가중치"
              text={`성과중심 + 협업·성장 합계가 현재 ${ruleSummary.kpiWeightSum}%입니다.`}
            />
          </div>
        </Card>
      </div>

      {/* 편집 권한이 없으면 에디터를 시각적으로 잠금(입력 차단 + 흐림). 백엔드도 403 강제. */}
      <div
        style={
          canEdit
            ? undefined
            : { pointerEvents: 'none', opacity: 0.65, userSelect: 'none' }
        }
        aria-disabled={!canEdit}
      >
        <RuleSetEditor
          value={draft}
          onChange={setDraft}
          measureTab={measureTab}
          onMeasureTabChange={setMeasureTab}
        />
      </div>
    </PageContainer>
  );
}

const TIERS_FOR_SUMMARY = ['excellent', 'standard', 'poor'] as const;

function RuleMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-[16px] font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function RuleCheck({
  ok,
  title,
  text,
}: {
  ok: boolean;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={
          ok
            ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-primary bg-primary text-primary-foreground'
            : 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-warning-300 bg-warning-50 text-warning-700'
        }
      >
        {ok ? <CheckCircle2 size={13} aria-hidden /> : <AlertTriangle size={13} aria-hidden />}
      </span>
      <span>
        <span className="block text-[13px] font-bold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">{text}</span>
      </span>
    </div>
  );
}

function rulesSubtitle(cycleName?: string): string {
  return `등급 척도·달성률·그룹풀·인상률·그룹실적 보너스 등 평가 산정 규칙을 설정합니다.${
    cycleName ? ` (현재 주기: ${cycleName})` : ''
  }`;
}
