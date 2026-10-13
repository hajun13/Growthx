'use client';

// ② 측정방식별 달성률표 — 수평 구간 바(달성률 축) + 측정방식 탭, 상한 비움 = ∞ 화살표.
import { ArrowRight } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { humanizeRateBand } from '@/lib/ui';
import type { Grade } from '@/lib/types';
import { GRADES, type RuleSetDraft } from './RuleSetEditorModel';
import { BAR_MOTION, clampPct } from './RuleSetEditorGrade';
import { AxisTicks, ContentHeader, GRADE_BG, GradeBadge, HintBox, RuleError } from './RuleSetEditorParts';
import { Stepper } from './RuleSetEditorStepper';

const MEASURE_TABS = [
  { key: 'amount', label: '달성금액 (amount)' },
  { key: 'rate', label: '증감률 (rate)' },
] as const;

export function GradingScalesSection({
  value,
  measureTab,
  onMeasureTabChange,
  onSet,
  error,
}: {
  value: RuleSetDraft;
  measureTab: 'amount' | 'rate';
  onMeasureTabChange: (t: 'amount' | 'rate') => void;
  onSet: (
    k: 'amount' | 'rate',
    g: Grade,
    f: 'minRate' | 'maxRate',
    n: number | null,
  ) => void;
  error?: string;
}) {
  const bands = GRADES.map((g) => ({
    grade: g,
    band: value.gradingScales[measureTab].find((x) => x.grade === g),
  }));
  // 바 축 상한(가시화용) — 데이터 최대치에 여유. 표시 전용(저장값 영향 없음).
  const maxSeen = Math.max(
    140,
    ...bands.map((b) => b.band?.maxRate ?? 0).filter((n) => Number.isFinite(n)),
    ...bands.map((b) => b.band?.minRate ?? 0),
  );
  const axisMax = Math.ceil((maxSeen + 20) / 20) * 20;
  const pos = (n: number) => clampPct((n / axisMax) * 100);

  return (
    <>
      <ContentHeader
        title="측정방식별 달성률표 (달성률 % → 등급)"
        desc="달성률이 몇 % 이상이면 어떤 등급인지 측정방식별로 정해요."
      />
      <div className="space-y-4 p-6">
        <HintBox>
          아래 띠는 <b>달성률 축</b>이에요. 예) 달성금액 S를 <b>120% 이상</b>으로
          정하면 목표 대비 120%를 넘긴 KPI는 S 등급이에요. 상한을 비우면 상한
          없음(∞ → 화살표)이에요. 건수(count)는 KPI별 임계 건수에서 관리해요.
        </HintBox>

        {/* 측정방식 탭 — 세그먼트 토글 */}
        <ToggleGroup
          type="single"
          variant="outline"
          value={measureTab}
          onValueChange={(v) => {
            if (v) onMeasureTabChange(v as 'amount' | 'rate');
          }}
        >
          {MEASURE_TABS.map((tab) => (
            <ToggleGroupItem key={tab.key} value={tab.key}>
              {tab.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* 등급별 수평 밴드 바 + stepper */}
        <div className="space-y-2.5">
          {bands.map(({ grade: g, band }) => {
            const minR = band?.minRate ?? 0;
            const maxR = band?.maxRate ?? null;
            const noCap = maxR === null || maxR === undefined;
            const width = noCap
              ? 0
              : Math.max(0, ((Math.min(maxR, axisMax) - minR) / axisMax) * 100);
            return (
              <div key={g} className="rounded-md border border-border px-3.5 py-2.5">
                {/* 1행: 사람말 규칙 — 저장값의 꼬리 숫자(110.0001 등)는 숨기고 "110% 초과"로 표기 */}
                <div className="mb-2 flex items-center gap-2">
                  <GradeBadge grade={g} />
                  <span className="text-12h font-semibold text-neutral-800">
                    {humanizeRateBand(minR, maxR)}
                  </span>
                  <ArrowRight size={13} className="text-neutral-400" />
                  <span className="text-12h font-bold text-foreground">{g} 등급</span>
                </div>
                {/* 2행: 시각화 바 + 정밀 입력(하한 ~ 상한) */}
                <div className="flex items-center gap-3">
                  {/* 밴드 바 */}
                  <div className="relative h-6 min-w-0 flex-1 rounded-xs border border-border bg-background">
                    <div
                      style={
                        { '--l': pos(minR), '--w': clampPct(width) } as React.CSSProperties
                      }
                      className={cn(
                        'absolute inset-y-0 left-(--l) flex items-center',
                        BAR_MOTION,
                        GRADE_BG[g],
                        noCap ? 'right-0 justify-end pr-1' : 'w-(--w) justify-center',
                      )}
                    >
                      {noCap && <ArrowRight size={14} className="text-neutral-0" />}
                    </div>
                  </div>
                  {/* stepper: 하한 ~ 상한 (소수 경계도 안 잘리게 넉넉히) */}
                  <Stepper
                    ariaLabel={`${g} 하한`}
                    value={minR}
                    onChange={(n) => onSet(measureTab, g, 'minRate', n ?? 0)}
                    step={5}
                    suffix="%"
                    className="w-37.5 shrink-0"
                  />
                  <span className="w-3.5 shrink-0 text-center text-13 text-neutral-400">~</span>
                  <Stepper
                    ariaLabel={`${g} 상한`}
                    value={maxR}
                    onChange={(n) => onSet(measureTab, g, 'maxRate', n)}
                    step={5}
                    suffix="%"
                    className="w-37.5 shrink-0"
                    allowEmpty
                    emptyValue={null}
                    placeholder="∞"
                  />
                </div>
              </div>
            );
          })}
        </div>
        {/* 축 눈금 — 밴드 바와 같은 첫 컬럼에 정렬(스테퍼 영역 제외). 15px = 밴드 박스 border+padding */}
        <div className="flex px-3.75">
          <div className="min-w-0 flex-1">
            <AxisTicks
              labels={[0, 0.25, 0.5, 0.75, 1].map((f) => `${Math.round(axisMax * f)}%`)}
            />
          </div>
          <div className="w-87.5 shrink-0" />
        </div>
        <RuleError msg={error} />
      </div>
    </>
  );
}
