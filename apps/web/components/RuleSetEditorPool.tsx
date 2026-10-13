'use client';

// ③ 그룹 풀 비율 — tier별 100% 스택 가로 막대 + 합계 게이지.
import { cn } from '@/lib/utils';
import type { Grade } from '@/lib/types';
import { GRADES, TIERS, tierLabel, type RuleSetDraft, type Tier } from './RuleSetEditorModel';
import {
  ContentHeader,
  GRADE_BG,
  GradeBadge,
  HintBox,
  RuleError,
  SumStatus,
  TierBadge,
} from './RuleSetEditorParts';
import { Stepper } from './RuleSetEditorStepper';

export function PoolRatiosSection({
  value,
  onSet,
  error,
}: {
  value: RuleSetDraft;
  onSet: (t: Tier, g: Grade, n: number) => void;
  error?: string;
}) {
  return (
    <>
      <ContentHeader
        title="그룹 풀 비율 (그룹 실적 × 등급)"
        desc="그룹 실적(우수/보통/미흡)마다 S~D를 몇 %씩 줄지 정해요. 행 합은 반드시 100%."
      />
      <div className="space-y-4 p-6">
        <HintBox>
          각 줄은 <b>100% 스택 막대</b>예요 — 색 면적이 그 등급에 배정되는 인원
          비율이에요. 예) 우수 그룹의 S를 <b>20%</b>로 하면 인원의 20%까지 S를
          받아요. 우측 게이지가 <b className="text-success-600">100%</b>가 되어야
          저장돼요.
        </HintBox>

        {/* 등급 범례 */}
        <div className="flex flex-wrap gap-3.5">
          {GRADES.map((g) => (
            <span
              key={g}
              className="flex items-center gap-1.5 text-11h text-muted-foreground"
            >
              <span className={cn('size-3', GRADE_BG[g])} />
              {g}
            </span>
          ))}
        </div>

        <div className="space-y-4">
          {TIERS.map((t) => {
            const sum = GRADES.reduce((acc, g) => acc + (value.poolRatios[t][g] || 0), 0);
            const bad = Math.abs(sum - 100) > 0.01;
            const diff = Math.round((sum - 100) * 10) / 10;
            return (
              <div key={t} className="rounded-md border border-border px-4 py-3.5">
                <div className="mb-2.5 flex items-center justify-between">
                  <TierBadge tier={t} />
                  {/* 합계 게이지 */}
                  <div className="flex items-center gap-2">
                    <SumStatus
                      bad={bad}
                      badText={diff > 0 ? `초과 ${diff}%` : `부족 ${-diff}%`}
                      okText="100%"
                    />
                    <span
                      className={cn(
                        'min-w-10.5 text-right text-13 font-bold tabular-nums',
                        bad ? 'text-danger-600' : 'text-success-600',
                      )}
                    >
                      {Math.round(sum * 10) / 10}%
                    </span>
                  </div>
                </div>

                {/* 100% 스택 가로 막대 */}
                <div
                  className={cn(
                    'mb-2.5 flex h-7.5 overflow-hidden rounded-xs border bg-background',
                    bad ? 'border-danger-600' : 'border-border',
                  )}
                >
                  {GRADES.map((g) => {
                    const v = value.poolRatios[t][g] || 0;
                    const wPct = sum > 0 ? (v / Math.max(sum, 100)) * 100 : 0;
                    if (v <= 0) return null;
                    return (
                      <div
                        key={g}
                        title={`${g} ${v}%`}
                        style={{ '--w': `${wPct}%` } as React.CSSProperties}
                        className={cn(
                          'flex w-(--w) items-center justify-center border-r border-neutral-0/40 text-11 font-bold text-neutral-0 transition-all duration-150 ease-out',
                          GRADE_BG[g],
                        )}
                      >
                        {wPct >= 9 ? `${g} ${v}%` : ''}
                      </div>
                    );
                  })}
                </div>

                {/* 인라인 등급별 stepper */}
                <div className="flex flex-wrap gap-2">
                  {GRADES.map((g) => (
                    <div key={g} className="flex items-center gap-1.5">
                      <GradeBadge grade={g} compact />
                      <Stepper
                        ariaLabel={`${tierLabel[t]} ${g} 비율`}
                        value={value.poolRatios[t][g]}
                        onChange={(n) => onSet(t, g, n ?? 0)}
                        step={5}
                        min={0}
                        suffix="%"
                        className="w-31"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <RuleError msg={error} />
      </div>
    </>
  );
}
