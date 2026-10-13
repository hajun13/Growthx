'use client';

// ⑥ 가중치 정책 — 다단계 평가 가중치 + kpiGroupWeights 도넛(편집 가능, 합100) + 정성 상한 + 강제 토글.
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { RuleSetDraft } from './RuleSetEditorModel';
import {
  ContentHeader,
  HintBox,
  RuleError,
  SumStatus,
  ToggleRow,
} from './RuleSetEditorParts';
import { Stepper } from './RuleSetEditorStepper';
import { MultiStageWeights } from './RuleSetEditorStages';

// 그룹 가중치 한 줄(범례 색칩 + 라벨 + stepper).
function GroupWeightRow({
  swatch,
  label,
  ariaLabel,
  value,
  onChange,
  invalid,
}: {
  swatch: string;
  label: string;
  ariaLabel: string;
  value: number;
  onChange: (n: number | null) => void;
  invalid: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex min-w-30 items-center gap-1.5 text-12h font-semibold text-neutral-800">
        <span className={cn('size-2.5 rounded-xs', swatch)} /> {label}
      </span>
      <Stepper
        ariaLabel={ariaLabel}
        value={value}
        onChange={onChange}
        min={0}
        max={100}
        step={5}
        suffix="%"
        className="w-37.5"
        invalid={invalid}
      />
    </div>
  );
}

// 합 100 스택 막대 세그먼트.
function WeightSegment({
  title,
  pct,
  share,
  tone,
}: {
  title: string;
  pct: number;
  share: number;
  tone: string;
}) {
  return (
    <div
      title={title}
      style={{ '--w': `${share}%` } as React.CSSProperties}
      className={cn(
        'flex w-(--w) items-center justify-center text-10h font-bold text-neutral-0 transition-all duration-150 ease-out',
        tone,
      )}
    >
      {share >= 14 ? `${pct}%` : ''}
    </div>
  );
}

export function WeightPolicySection({
  value,
  onChange,
  error,
}: {
  value: RuleSetDraft;
  onChange: (v: RuleSetDraft) => void;
  error?: string;
}) {
  const q = value.weightPolicy.qualitativeMaxPercent;
  const kw = value.weightPolicy.kpiGroupWeights;
  const corePct = kw.performance_core || 0;
  const collabPct = kw.collaboration_growth || 0;
  const kwSum = corePct + collabPct;
  const kwBad = Math.abs(kwSum - 100) > 0.01;
  const denom = Math.max(kwSum, 1);

  const setWeight = (field: 'performance_core' | 'collaboration_growth', n: number) =>
    onChange({
      ...value,
      weightPolicy: {
        ...value.weightPolicy,
        kpiGroupWeights: { ...kw, [field]: n },
      },
    });
  const setFlag = (field: 'enforceQualitativeCap' | 'enforceGroupRatio', v: boolean) =>
    onChange({
      ...value,
      weightPolicy: { ...value.weightPolicy, [field]: v },
    });

  return (
    <>
      <ContentHeader
        title="가중치 정책"
        desc="KPI 그룹 가중치(성과중심·협업·성장)와 정성 상한·강제 옵션을 정해요."
      />
      <div className="space-y-5 p-6">
        <HintBox>
          모든 KPI 가중치 합은 항상{' '}
          <b className="text-foreground">{value.weightPolicy.totalMustEqual}%</b>(고정)이에요.
          아래 <b>그룹 가중치</b>는 성과중심·협업·성장이 각각 몇 %를 차지할지 정하고{' '}
          <b>합은 100%</b>여야 해요. 도넛이 입력에 따라 즉시 바뀌어요.
        </HintBox>

        {/* ── 다단계 평가 가중치(1차/2차/최종 + 실적/역량) ── */}
        <MultiStageWeights value={value} onChange={onChange} />

        {/* ── 그룹 가중치(편집 가능 도넛) ── */}
        <div className="flex items-center gap-5">
          <div className="flex w-50 shrink-0 flex-col items-center gap-2.5">
            <div className="relative size-33 rounded-full bg-muted">
              <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-card">
                <span className="text-10 text-neutral-500">합계</span>
                <span
                  className={cn(
                    'text-18 font-bold tabular-nums',
                    kwBad ? 'text-danger-600' : 'text-foreground',
                  )}
                >
                  {Math.round(kwSum * 10) / 10}%
                </span>
              </div>
            </div>
            <SumStatus bad={kwBad} badText="합 100% 필요" okText="합 100%" />
          </div>

          {/* 그룹 가중치 stepper */}
          <div className="min-w-0 flex-1 space-y-3">
            <GroupWeightRow
              swatch="bg-foreground"
              label="성과중심"
              ariaLabel="성과중심 그룹 가중치"
              value={corePct}
              onChange={(n) => setWeight('performance_core', n ?? 0)}
              invalid={kwBad}
            />
            <GroupWeightRow
              swatch="bg-neutral-500"
              label="협업·성장"
              ariaLabel="협업·성장 그룹 가중치"
              value={collabPct}
              onChange={(n) => setWeight('collaboration_growth', n ?? 0)}
              invalid={kwBad}
            />
            {/* 합 100 스택 막대(비례) */}
            <div
              className={cn(
                'flex h-5.5 overflow-hidden rounded-xs border bg-muted',
                kwBad ? 'border-danger-600' : 'border-border',
              )}
            >
              {corePct > 0 && (
                <WeightSegment
                  title={`성과중심 ${corePct}%`}
                  pct={corePct}
                  share={(corePct / denom) * 100}
                  tone="bg-foreground"
                />
              )}
              {collabPct > 0 && (
                <WeightSegment
                  title={`협업·성장 ${collabPct}%`}
                  pct={collabPct}
                  share={(collabPct / denom) * 100}
                  tone="bg-neutral-500"
                />
              )}
            </div>
          </div>
        </div>

        {/* ── 정성 KPI 상한 ── */}
        <div>
          <Label className="mb-1.5 text-11 font-semibold tracking-wide text-muted-foreground uppercase">
            정성 KPI 상한
          </Label>
          <Stepper
            ariaLabel="정성 KPI 상한"
            value={q}
            onChange={(n) =>
              onChange({
                ...value,
                weightPolicy: {
                  ...value.weightPolicy,
                  qualitativeMaxPercent: n ?? 0,
                },
              })
            }
            min={0}
            max={100}
            step={5}
            suffix="%"
            className="w-40"
            invalid={q < 0 || q > 100}
          />
          <div className="relative mt-2.5 h-3.5 rounded-xs border border-border bg-muted">
            <div
              style={{ '--w': `${Math.max(0, Math.min(100, q))}%` } as React.CSSProperties}
              className="h-full w-(--w) bg-success-600 transition-all duration-150 ease-out"
            />
          </div>
          <p className="mt-1.5 text-11 text-neutral-500">
            정성 KPI는 전체의 최대 <b className="text-foreground">{q}%</b>까지 차지할 수
            있어요.
          </p>
        </div>

        {/* ── 강제 옵션 토글(갭 #3) ── */}
        <div className="flex flex-col gap-2.5">
          <ToggleRow
            label="정성 상한 강제"
            desc={`켜면 제출 시 정성 KPI 합이 상한(${q}%)을 넘으면 막아요. (현재 전부 서술형 전환으로 기본 꺼짐)`}
            checked={value.weightPolicy.enforceQualitativeCap}
            onChange={(v) => setFlag('enforceQualitativeCap', v)}
          />
          <ToggleRow
            label="그룹 비율 강제"
            desc="켜면 제출 시 성과중심/협업·성장 가중치 비율을 위 설정대로 강제해요. (기본 꺼짐)"
            checked={value.weightPolicy.enforceGroupRatio}
            onChange={(v) => setFlag('enforceGroupRatio', v)}
          />
        </div>

        <RuleError msg={error} />
      </div>
    </>
  );
}
