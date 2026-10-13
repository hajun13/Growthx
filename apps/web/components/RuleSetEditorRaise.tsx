'use client';

// ④ 등급별 인상률 — 비례 가로 막대 + 최종 인상률 칩(등급 인상률 + 그룹실적 보너스).
import { cn } from '@/lib/utils';
import { GRADES, TIERS, tierLabel, type RuleSetDraft } from './RuleSetEditorModel';
import {
  ContentHeader,
  GRADE_BG,
  GradeBadge,
  HintBox,
  RuleError,
  TIER_BG,
} from './RuleSetEditorParts';
import { Stepper } from './RuleSetEditorStepper';

export function RaiseRatesSection({
  value,
  onChange,
  error,
}: {
  value: RuleSetDraft;
  onChange: (v: RuleSetDraft) => void;
  error?: string;
}) {
  const maxRaise = Math.max(1, ...GRADES.map((g) => value.raiseRates[g] || 0));
  return (
    <>
      <ContentHeader
        title="등급별 인상률"
        desc="확정 등급에 따라 내년 연봉이 오르는 비율이에요."
      />
      <div className="space-y-4 p-6">
        <HintBox>
          막대 길이가 곧 인상률이라 등급 간 격차가 한눈에 보여요. 예) S <b>+7%</b>면
          연봉 1억은 내년에 <b className="text-foreground">1억 700만원</b>이에요.
          인상률은 음수가 될 수 없어요. 우측 칩은 그룹실적 보너스까지 더한 최종
          인상률이에요.
        </HintBox>

        <div className="space-y-2.5">
          {GRADES.map((g) => {
            const r = value.raiseRates[g] || 0;
            const w = `${(r / maxRaise) * 100}%`;
            return (
              <div
                key={g}
                className="flex items-center gap-3 rounded-md border border-border px-4 py-3"
              >
                <GradeBadge grade={g} />
                <Stepper
                  ariaLabel={`${g} 등급 인상률`}
                  value={r}
                  onChange={(n) =>
                    onChange({
                      ...value,
                      raiseRates: { ...value.raiseRates, [g]: n ?? 0 },
                    })
                  }
                  min={0}
                  suffix="%"
                  className="w-32.5"
                  invalid={r < 0}
                />
                {/* 비례 막대 */}
                <div className="relative h-6.5 flex-1 rounded-xs border border-border bg-background">
                  <div
                    style={{ '--w': w } as React.CSSProperties}
                    className={cn(
                      'flex h-full w-(--w) items-center justify-end pr-2 text-11h font-bold tabular-nums text-neutral-0 transition-all duration-150 ease-out',
                      GRADE_BG[g],
                      r > 0 && 'min-w-7',
                    )}
                  >
                    {r > 0 ? `+${r}%` : ''}
                  </div>
                </div>
                {/* 최종 인상률 칩(표시용 — raiseRates + groupTierBonus) */}
                <div className="flex shrink-0 gap-1.5">
                  {TIERS.map((tt) => {
                    const final = r + (value.groupTierBonus[tt] || 0);
                    return (
                      <div
                        key={tt}
                        title={`${tierLabel[tt]} 그룹 최종 인상률`}
                        className={cn(
                          'min-w-11.5 rounded-xs border border-border px-1.5 py-1 text-center',
                          TIER_BG[tt],
                        )}
                      >
                        <div className="mb-px text-9h text-muted-foreground">
                          {tierLabel[tt]}
                        </div>
                        <div
                          className={cn(
                            'text-12h font-bold tabular-nums',
                            final < 0
                              ? 'text-danger-600'
                              : final === 0
                                ? 'text-neutral-500'
                                : 'text-foreground',
                          )}
                        >
                          {final > 0 ? '+' : ''}
                          {final}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-11h text-neutral-500">
          칩 = 등급 인상률 + 그룹실적 보너스(우수/보통/미흡). 표시용 계산이며 실제
          산정은 저장 후 백엔드가 수행해요.
        </p>
        <RuleError msg={error} />
      </div>
    </>
  );
}
