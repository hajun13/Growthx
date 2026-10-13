'use client';

// 평가 규칙 에디터 — "숫자 입력 폼"이 아니라 "규칙을 시각적으로 보면서 조정"하는 도구.
// 각 규칙을 데이터 시각화(구간 바·스택 막대·비례 막대·도넛)로 표현해 비전문가도
// 한눈에 이해·편집한다. 기능·계약·검증 로직은 동일(RuleSetDraft/props/
// validateRuleSet/weightPolicy 직렬화는 RulesView 가 의존하므로 절대 변경 금지).
// 구현은 섹션별 파일로 분리: Model(타입·검증) / Parts(공용) / Grade / Pool / Bonus / Weights.
import { useMemo, useState } from 'react';
import {
  Layers,
  Gauge,
  PieChart,
  TrendingUp,
  Award,
  Scale,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { humanizeRateBand } from '@/lib/ui';
import type { Grade } from '@/lib/types';
import {
  GRADES,
  validateRuleSet,
  type RuleSetDraft,
  type RuleSetEditorProps,
  type Tier,
} from './RuleSetEditorModel';
import { GradeScaleSection } from './RuleSetEditorGrade';
import { GradingScalesSection } from './RuleSetEditorBands';
import { PoolRatiosSection } from './RuleSetEditorPool';
import { RaiseRatesSection } from './RuleSetEditorRaise';
import { GroupTierBonusSection } from './RuleSetEditorBonus';
import { WeightPolicySection } from './RuleSetEditorWeights';

export { validateRuleSet };
export type { RuleSetDraft, RuleSetEditorProps };

type SectionKey =
  | 'gradeScale'
  | 'gradingScales'
  | 'poolRatios'
  | 'raiseRates'
  | 'groupTierBonus'
  | 'weightPolicy';

const MENU: { key: SectionKey; label: string; Icon: LucideIcon }[] = [
  { key: 'gradeScale', label: '등급 척도', Icon: Layers },
  { key: 'gradingScales', label: '측정방식별 달성률', Icon: Gauge },
  { key: 'poolRatios', label: '그룹 풀 비율', Icon: PieChart },
  { key: 'raiseRates', label: '등급별 인상률', Icon: TrendingUp },
  { key: 'groupTierBonus', label: '그룹실적 보너스', Icon: Award },
  { key: 'weightPolicy', label: '가중치 정책', Icon: Scale },
];

export function RuleSetEditor({
  value,
  onChange,
  measureTab,
  onMeasureTabChange,
}: RuleSetEditorProps) {
  const errors = useMemo(() => validateRuleSet(value), [value]);
  const [active, setActive] = useState<SectionKey>('gradeScale');

  // 섹션별 에러 여부(좌측 메뉴 빨강 점 표시용).
  const sectionHasError: Record<SectionKey, boolean> = {
    gradeScale: !!errors.gradeScale,
    gradingScales: !!errors.gradingScales,
    poolRatios: !!errors.poolRatios,
    raiseRates: !!errors.raiseRates,
    // 그룹실적 보너스 섹션은 보너스 + tier 경계(갭 #1) 둘 다 품으므로 둘 중 하나라도 에러면 표시.
    groupTierBonus: !!errors.groupTierBonus || !!errors.groupTierThresholds,
    weightPolicy: !!errors.weightPolicy,
  };

  // 좌측 메뉴 부제(현재 핵심값 요약) — 탐색성↑.
  const sSc = value.gradeScale.find((e) => e.grade === 'S');
  const aSc = value.gradeScale.find((e) => e.grade === 'A');
  const sBand = value.gradingScales[measureTab].find((e) => e.grade === 'S');
  const sumPool = (t: Tier) =>
    GRADES.reduce((acc, g) => acc + (value.poolRatios[t][g] || 0), 0);
  const kw = value.weightPolicy.kpiGroupWeights;
  const menuSummary: Record<SectionKey, string> = {
    gradeScale: `S ${sSc?.min ?? 0}+ · A ${aSc?.min ?? 0}+`,
    gradingScales: `S ${humanizeRateBand(sBand?.minRate ?? 0, sBand?.maxRate ?? null)} (${measureTab === 'amount' ? '금액' : '증감'})`,
    poolRatios: `우수 S ${value.poolRatios.excellent.S ?? 0}% · 합 ${Math.round(sumPool('excellent'))}%`,
    raiseRates: `S +${value.raiseRates.S ?? 0}% ~ D ${value.raiseRates.D ?? 0}%`,
    groupTierBonus: `경계 ${value.groupTierThresholds.excellent}% · 우수 ${value.groupTierBonus.excellent >= 0 ? '+' : ''}${value.groupTierBonus.excellent}%p`,
    weightPolicy: `성과 ${kw.performance_core}% · 협업 ${kw.collaboration_growth}%`,
  };

  const setGradeScale = (grade: Grade, field: 'min' | 'max', n: number) =>
    onChange({
      ...value,
      gradeScale: value.gradeScale.map((e) =>
        e.grade === grade ? { ...e, [field]: n } : e,
      ),
    });

  const setBandNum = (
    key: 'amount' | 'rate',
    grade: Grade,
    field: 'minRate' | 'maxRate',
    n: number | null,
  ) =>
    onChange({
      ...value,
      gradingScales: {
        ...value.gradingScales,
        [key]: value.gradingScales[key].map((e) =>
          e.grade === grade
            ? { ...e, [field]: field === 'maxRate' ? n : (n ?? 0) }
            : e,
        ),
      },
    });

  const setPool = (t: Tier, grade: Grade, n: number) =>
    onChange({
      ...value,
      poolRatios: {
        ...value.poolRatios,
        [t]: { ...value.poolRatios[t], [grade]: n },
      },
    });

  return (
    <div className="flex items-start gap-5">
      {/* 좌측 섹션 메뉴 — 각 항목에 핵심값 부제 */}
      <Card className="w-61 shrink-0 overflow-hidden">
        {MENU.map(({ key, label, Icon }) => {
          const isActive = active === key;
          const hasError = sectionHasError[key];
          return (
            <div key={key} className="border-b border-border last:border-b-0">
              <Button
                variant="row-select"
                size="row-select"
                data-active={isActive}
                onClick={() => setActive(key)}
                className="items-center"
              >
                <span
                  className={cn(
                    'flex size-7.5 shrink-0 items-center justify-center rounded-xs',
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-neutral-500',
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'flex items-center gap-1.5 text-12h',
                      isActive ? 'font-bold text-foreground' : 'font-medium text-neutral-700',
                    )}
                  >
                    {label}
                    {hasError && (
                      <span
                        aria-label="입력 확인 필요"
                        className="size-1.5 rounded-full bg-danger-600"
                      />
                    )}
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 block truncate text-10h font-normal tabular-nums',
                      hasError ? 'text-danger-600' : 'text-muted-foreground',
                    )}
                  >
                    {hasError ? '확인이 필요해요' : menuSummary[key]}
                  </span>
                </span>
              </Button>
            </div>
          );
        })}
      </Card>

      {/* 우측 콘텐츠 */}
      <Card className="min-w-0 flex-1 overflow-hidden">
        {active === 'gradeScale' && (
          <GradeScaleSection value={value} onSet={setGradeScale} error={errors.gradeScale} />
        )}
        {active === 'gradingScales' && (
          <GradingScalesSection
            value={value}
            measureTab={measureTab}
            onMeasureTabChange={onMeasureTabChange}
            onSet={setBandNum}
            error={errors.gradingScales}
          />
        )}
        {active === 'poolRatios' && (
          <PoolRatiosSection value={value} onSet={setPool} error={errors.poolRatios} />
        )}
        {active === 'raiseRates' && (
          <RaiseRatesSection value={value} onChange={onChange} error={errors.raiseRates} />
        )}
        {active === 'groupTierBonus' && (
          <GroupTierBonusSection
            value={value}
            onChange={onChange}
            error={errors.groupTierBonus}
            thresholdsError={errors.groupTierThresholds}
          />
        )}
        {active === 'weightPolicy' && (
          <WeightPolicySection value={value} onChange={onChange} error={errors.weightPolicy} />
        )}

        {/* 재산정 영향 안내 배너(모든 섹션 하단 공통) */}
        <div className="flex items-start gap-2 border-t border-info-100 bg-info-50/50 px-6 py-3">
          <AlertTriangle size={15} className="mt-px shrink-0 text-primary" />
          <p className="text-11h leading-relaxed text-primary">
            <b>재산정 영향 안내</b> — 활성 주기의 규칙을 바꾸면 점수·등급·풀·인상률이
            다시 산정돼요. 저장 전 변경 내용을 확인해 주세요.
          </p>
        </div>
      </Card>
    </div>
  );
}
