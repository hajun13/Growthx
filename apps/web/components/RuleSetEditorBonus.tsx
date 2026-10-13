'use client';

// ⑤ 그룹실적 경계·보너스 — 달성률 축 tier 경계 + 3카드 큰 stepper + 즉시 환산 예시.
import { Gauge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TIERS, tierLabel, type RuleSetDraft } from './RuleSetEditorModel';
import {
  AxisTicks,
  ContentHeader,
  HintBox,
  RuleError,
  TIER_BORDER_T,
  TierBadge,
} from './RuleSetEditorParts';
import { Stepper } from './RuleSetEditorStepper';

const clampPct = (n: number) => `${Math.max(0, Math.min(100, n))}%`;
const BAR_MOTION = 'transition-all duration-150 ease-out';

export function GroupTierBonusSection({
  value,
  onChange,
  error,
  thresholdsError,
}: {
  value: RuleSetDraft;
  onChange: (v: RuleSetDraft) => void;
  error?: string;
  thresholdsError?: string;
}) {
  const sRaise = value.raiseRates.S || 0;
  const gt = value.groupTierThresholds;
  const setThreshold = (field: 'excellent' | 'standard', n: number) =>
    onChange({
      ...value,
      groupTierThresholds: { ...gt, [field]: n },
    });
  // 달성률 축(0~axisMax) — 경계 위치 시각화용(표시 전용).
  const axisMax = Math.max(120, Math.ceil((gt.excellent + 20) / 20) * 20);
  const posPct = (n: number) => clampPct((n / axisMax) * 100);
  const lo = Math.min(gt.standard, gt.excellent);
  const hi = Math.max(gt.excellent, gt.standard);
  const midWidth = Math.max(0, Math.min(100, (hi / axisMax) * 100) - Math.max(0, Math.min(100, (lo / axisMax) * 100)));
  const badThr = gt.excellent <= gt.standard;
  return (
    <>
      <ContentHeader
        title="그룹실적 경계·보너스 (그룹 실적 → 등급·인상률)"
        desc="그룹 실적 달성률이 몇 %부터 우수/보통/미흡인지(경계)와, 그에 따른 인상률 가산을 함께 정해요."
      />
      <div className="space-y-5 p-6">
        {/* ── 갭 #1: 그룹실적 tier 경계(달성률 축) ── */}
        <div className="rounded-md border border-border px-4.5 py-4">
          <div className="mb-2.5 flex items-center gap-1.5 text-12h font-bold text-neutral-800">
            <Gauge size={14} className="text-warning-600" /> 그룹 실적 tier 경계 (달성률 %)
          </div>
          <HintBox>
            그룹 실적 <b>달성률</b>이 <b>{gt.excellent}% 이상</b>이면{' '}
            <b className="text-success-600">우수</b>, <b>{gt.standard}% 이상</b>이면{' '}
            <b>보통</b>, 그 미만이면 <b className="text-warning-600">미흡</b>이에요. 위 우수
            경계는 보통 경계보다 커야 해요.
          </HintBox>

          {/* 달성률 축 + 두 경계(우수/보통) 구간 색칠 */}
          <div className="mt-3 space-y-1">
            <div
              className={cn(
                'relative h-10 overflow-hidden rounded-xs border bg-warning-50',
                badThr ? 'border-danger-600' : 'border-border',
              )}
            >
              {/* 보통 구간(standard~excellent) */}
              <div
                style={{ '--l': posPct(lo), '--w': clampPct(midWidth) } as React.CSSProperties}
                className={cn('absolute inset-y-0 left-(--l) w-(--w) bg-neutral-200', BAR_MOTION)}
              />
              {/* 우수 구간(excellent~) */}
              <div
                style={{ '--l': posPct(gt.excellent) } as React.CSSProperties}
                className={cn(
                  'absolute inset-y-0 right-0 left-(--l) flex items-center bg-success-50 pl-1.5',
                  BAR_MOTION,
                )}
              >
                <span className="text-10h font-bold text-success-600">우수</span>
              </div>
              {/* 경계 마커: standard */}
              <div
                style={{ '--l': posPct(gt.standard) } as React.CSSProperties}
                className="absolute inset-y-0 left-(--l) w-0.5 bg-neutral-700"
              />
              {/* 경계 마커: excellent */}
              <div
                style={{ '--l': posPct(gt.excellent) } as React.CSSProperties}
                className="absolute inset-y-0 left-(--l) w-0.5 bg-success-600"
              />
            </div>
            {/* 축 눈금 */}
            <AxisTicks
              labels={[0, 0.25, 0.5, 0.75, 1].map((f) => `${Math.round(axisMax * f)}%`)}
            />
          </div>

          {/* 경계 stepper */}
          <div className="mt-3.5 flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="success" shape="pill">
                우수 경계
              </Badge>
              <Stepper
                ariaLabel="우수 경계 달성률"
                value={gt.excellent}
                onChange={(n) => setThreshold('excellent', n ?? 0)}
                min={0}
                step={5}
                suffix="%"
                className="w-32.5"
                invalid={badThr}
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="neutral" shape="pill">
                보통 경계
              </Badge>
              <Stepper
                ariaLabel="보통 경계 달성률"
                value={gt.standard}
                onChange={(n) => setThreshold('standard', n ?? 0)}
                min={0}
                step={5}
                suffix="%"
                className="w-32.5"
                invalid={badThr}
              />
            </div>
          </div>
          <p className="mt-2 text-11 text-neutral-500">
            예) 우수 {gt.excellent}% · 보통 {gt.standard}% → 달성률 {gt.excellent}%↑ 우수
            · {gt.standard}~{gt.excellent - 1}% 보통 · {gt.standard}% 미만 미흡
          </p>
          <RuleError msg={thresholdsError} />
        </div>

        {/* ── 그룹실적 보너스(인상률 가산) ── */}
        <HintBox>
          예) 우수 <b>+2%p</b>면 S 등급(+{sRaise}%)인 사람이 우수 그룹이면 최종{' '}
          <b className="text-foreground">
            +{sRaise + (value.groupTierBonus.excellent || 0)}%
          </b>
          가 돼요. 미흡은 음수(예 −1)도 입력할 수 있어요.
        </HintBox>
        <div className="grid grid-cols-3 gap-3">
          {TIERS.map((t) => {
            const b = value.groupTierBonus[t] || 0;
            const final = sRaise + b;
            return (
              <div
                key={t}
                className={cn(
                  'rounded-md border border-border border-t-3 px-4 py-4.5 text-center',
                  TIER_BORDER_T[t],
                )}
              >
                <div className="mb-3">
                  <TierBadge tier={t} />
                </div>
                <div className="flex justify-center">
                  <Stepper
                    ariaLabel={`${tierLabel[t]} 보너스`}
                    value={b}
                    onChange={(n) =>
                      onChange({
                        ...value,
                        groupTierBonus: { ...value.groupTierBonus, [t]: n ?? 0 },
                      })
                    }
                    suffix="%p"
                    className="w-35"
                    big
                  />
                </div>
                <div className="mt-3 text-11 leading-normal text-muted-foreground">
                  S등급이면{' '}
                  <b
                    className={cn(
                      'tabular-nums',
                      final < 0 ? 'text-danger-600' : 'text-foreground',
                    )}
                  >
                    {final > 0 ? '+' : ''}
                    {final}%
                  </b>
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
