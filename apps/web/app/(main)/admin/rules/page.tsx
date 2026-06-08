'use client';

// 평가 규칙 설정(HR) — 현재 주기의 RuleSet(등급 척도·달성률표·그룹풀비율·등급별 인상률·
// 그룹실적 보너스·가중치 정책)을 편집. 인상률·그룹실적 보너스를 회사가 바꾸는 단일 화면.
import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useRuleSet, ruleSetCommands } from '@/hooks/useRuleSets';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import {
  RuleSetEditor,
  validateRuleSet,
  type RuleSetDraft,
} from '@/components/RuleSetEditor';
import { ErrorState, Forbidden, Skeleton } from '@/components/States';
import { ApiError } from '@/lib/api';
import { isHrAdmin } from '@/lib/nav';
import { T } from '@/lib/toss';
import type { Grade, RuleSet } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { PageContainer } from '@/components/PageContainer';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const TIERS = ['excellent', 'standard', 'poor'] as const;

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
    },
  };
}

export default function RulesPage() {
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
  } = useRuleSet(allowed ? ruleSetId : null);

  const [draft, setDraft] = useState<RuleSetDraft | null>(null);
  const [measureTab, setMeasureTab] = useState<'amount' | 'rate'>('amount');
  const [busy, setBusy] = useState(false);

  // RuleSet 로드 → 편집 드래프트 초기화(역매핑).
  useEffect(() => {
    if (ruleSet) setDraft(toDraft(ruleSet));
  }, [ruleSet]);

  const validation = useMemo(
    () => (draft ? validateRuleSet(draft) : { ok: false }),
    [draft],
  );

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
        message: err instanceof ApiError ? err.message : '저장에 실패했어요.',
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
        <div
          className="py-16 text-center"
          style={{ fontSize: 13, color: T.grey500, border: `1px solid ${T.grey200}`, background: '#fff' }}
        >
          현재 주기에 연결된 규칙 세트가 없어요. ‘평가 운영’에서 주기에 규칙을 먼저 연결해 주세요.
        </div>
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
                <span style={{ fontSize: 11.5, fontWeight: 600, color: T.red500 }}>
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
            <span style={{ fontSize: 11.5, fontWeight: 600, color: T.grey500 }}>
              읽기 전용 — 규칙 편집 권한이 없어요
            </span>
          )
        }
      />

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

function rulesSubtitle(cycleName?: string): string {
  return `등급 척도·달성률·그룹풀·인상률·그룹실적 보너스 등 평가 산정 규칙을 설정합니다.${
    cycleName ? ` (현재 주기: ${cycleName})` : ''
  }`;
}
