'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Save, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EvaluationActionPanel } from '@/components/EvaluationActionPanel';
import { cn } from '@/lib/utils';
import type { Kpi } from '@/lib/types';
import { KpiLockedCard } from './KpiLockedCard';

// ─── 제출·확정된 과제 섹션 (편집/완료 모드 공용) ─────────────────
export function LockedKpiSection({
  kpis,
  weightTotal,
  scales,
  expanded,
  onToggle,
}: {
  kpis: Kpi[];
  weightTotal: number;
  scales?: Parameters<typeof KpiLockedCard>[0]['scales'];
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <span className="text-11 font-semibold text-muted-foreground uppercase tracking-widest">
          제출·확정된 과제
        </span>
        <span className="text-12 text-muted-foreground">
          총 가중치: <span className="text-primary font-bold tabular-nums">{weightTotal}%</span> / 100%
        </span>
      </div>
      <div className="space-y-4 rounded-lg bg-muted/40 p-4">
        {kpis.map((k, idx) => (
          <KpiLockedCard
            key={k.id}
            kpi={k}
            index={idx}
            scales={scales}
            collapsed={!expanded[k.id]}
            onToggle={() => onToggle(k.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── 하단 고정 액션 바 ────────────────────────────────────────────
export function BottomActionBar({
  weightTotal,
  lockedWeightTotal,
  qualitativeTotal,
  canSubmit,
  savingAll,
  submitting,
  draftsEmpty,
  isLocked,
  onSave,
  onSubmit,
}: {
  weightTotal: number;
  lockedWeightTotal: number;
  qualitativeTotal: number;
  canSubmit: boolean;
  savingAll: boolean;
  submitting: boolean;
  draftsEmpty: boolean;
  isLocked: boolean;
  onSave: () => void;
  onSubmit: () => void;
}) {
  const qualitativeOver = qualitativeTotal > 30;
  // 부분 반려 시나리오: 확정(locked) 가중치 + 작성중(draft) 가중치의 합이 제출 게이트.
  // draft 만 100%를 요구하면 확정 90% + 반려 10% 재작성 케이스에서 제출이 영구 불가해진다.
  const combinedTotal = weightTotal + lockedWeightTotal;
  const weightOk = combinedTotal === 100;
  const weightColor = weightOk ? 'text-success-600' : combinedTotal > 100 ? 'text-danger-600' : 'text-warning-600';

  return (
    <EvaluationActionPanel
      sticky
      message={
        weightOk
          ? '제출 가능한 가중치입니다.'
          : combinedTotal > 100
            ? '전체 가중치가 100%를 초과했어요.'
            : '전체 가중치를 100%로 맞춰야 제출할 수 있어요.'
      }
      summary={
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-12 text-muted-foreground">
          <span>
            전체 가중치{' '}
            {lockedWeightTotal > 0 ? (
              <>
                <span className="tabular-nums">작성중 {weightTotal}%</span>
                <span> + </span>
                <span className="tabular-nums">확정 {lockedWeightTotal}%</span>
                <span> = </span>
                <b className={cn('tabular-nums', weightColor)}>{combinedTotal}%</b>
              </>
            ) : (
              <b className={cn('tabular-nums', weightColor)}>{weightTotal}%</b>
            )}
            <span className="text-muted-foreground"> / 100%</span>
          </span>
          <span>
            정성 KPI{' '}
            <b className={cn('tabular-nums', qualitativeOver ? 'text-warning-600' : 'text-foreground')}>
              {qualitativeTotal}%
            </b>
            <span className="text-muted-foreground"> / 권장 30%</span>
          </span>
        </div>
      }
      actions={
        <>
          <Button
            variant="outline"
            onClick={onSave}
            disabled={savingAll || draftsEmpty || isLocked}
            loading={savingAll}
          >
            {!savingAll && <Save aria-hidden />}
            임시저장
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit || submitting} loading={submitting}>
            {!submitting && <Send aria-hidden />}
            최종 제출
          </Button>
        </>
      }
    />
  );
}

// ── 체크리스트 항목 ───────────────────────────────────────────────
export function ChecklistItem({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1', ok ? 'text-success-600' : 'text-muted-foreground')}>
      {ok ? <Check className="size-3.25" aria-hidden /> : <span className="w-3.5 text-center">·</span>}
      {children}
    </span>
  );
}

// ─── 가중치 도넛 SVG ─────────────────────────────────────────────
const DONUT_TONE = {
  ok: { stroke: 'stroke-success-500', fill: 'fill-success-500' },
  over: { stroke: 'stroke-danger-500', fill: 'fill-danger-500' },
  base: { stroke: 'stroke-primary', fill: 'fill-primary' },
} as const;

function WeightDonut({ weight }: { weight: number }) {
  const r = 18;
  const c = 22;
  const circumference = 2 * Math.PI * r;
  const fill = Math.min(weight, 100) / 100;
  const dash = fill * circumference;
  const tone = DONUT_TONE[weight === 100 ? 'ok' : weight > 100 ? 'over' : 'base'];
  return (
    <svg width={44} height={44} viewBox="0 0 44 44" aria-hidden>
      <circle cx={c} cy={c} r={r} fill="none" className="stroke-muted" strokeWidth={5} />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        className={tone.stroke}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="butt"
        transform={`rotate(-90 ${c} ${c})`}
      />
      <text x={c} y={c + 4} textAnchor="middle" className={cn('text-9h font-bold', tone.fill)}>
        {weight}%
      </text>
    </svg>
  );
}

function KpiReviewLine({
  label,
  value,
  description,
  valueClassName = 'text-foreground',
}: {
  label: string;
  value: string;
  description: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-h-11 flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
      <p className="gx-muted-label sm:w-29 sm:shrink-0">{label}</p>
      <p className="truncate text-12 font-medium text-muted-foreground sm:min-w-0 sm:flex-1">{description}</p>
      <p className={cn('text-15 font-bold tabular-nums sm:text-right', valueClassName)}>{value}</p>
    </div>
  );
}

export function KpiBalancePanel({
  weightTotal,
  lockedWeightTotal,
  coreTotal,
  growthTotal,
  qualitativeTotal,
  draftCount,
  lockedCount,
}: {
  weightTotal: number;
  lockedWeightTotal: number;
  coreTotal: number;
  growthTotal: number;
  qualitativeTotal: number;
  draftCount: number;
  lockedCount: number;
}) {
  // 제출 게이트와 동일하게 확정(locked)+작성중(draft) 합산으로 검토한다.
  const combinedTotal = weightTotal + lockedWeightTotal;
  const weightColor = combinedTotal === 100 ? 'text-success-700' : combinedTotal > 100 ? 'text-danger-700' : 'text-foreground';
  const qualityColor = qualitativeTotal > 30 ? 'text-warning-700' : 'text-muted-foreground';
  const progressTone = combinedTotal === 100 ? 'bg-success-600' : combinedTotal > 100 ? 'bg-danger-600' : 'bg-primary';
  const progressStyle = { '--w': `${Math.min(combinedTotal, 100)}%` } as CSSProperties;
  const weightMessage =
    combinedTotal === 100
      ? '제출 가능한 가중치입니다'
      : combinedTotal > 100
        ? `${combinedTotal - 100}% 초과되었습니다`
        : `${100 - combinedTotal}% 더 배분해야 합니다`;

  return (
    <section className="gx-panel overflow-hidden">
      <div className="lg:flex">
        <div className="border-b border-border px-5 py-5 lg:w-85 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="gx-muted-label">가중치 검토</p>
              <div className="mt-2 flex items-end gap-1.5">
                <span className={cn('text-34 font-bold leading-none tabular-nums', weightColor)}>
                  {combinedTotal}
                </span>
                <span className="pb-1 text-13 font-semibold text-muted-foreground">/ 100%</span>
              </div>
              {lockedWeightTotal > 0 && (
                <p className="mt-1.5 text-11h text-muted-foreground tabular-nums">
                  작성중 {weightTotal}% + 확정 {lockedWeightTotal}% = {combinedTotal}%
                </p>
              )}
            </div>
            <WeightDonut weight={combinedTotal} />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div style={progressStyle} className={cn('h-full w-(--w) rounded-full', progressTone)} />
          </div>
          <p className={cn('mt-3 text-12 font-semibold', weightColor)}>{weightMessage}</p>
        </div>

        <div className="divide-y divide-border px-5 py-3 lg:min-w-0 lg:flex-1">
          <KpiReviewLine
            label="그룹 구성"
            value={`${coreTotal}% / ${growthTotal}%`}
            description="성과중심 / 협업·성장"
          />
          <KpiReviewLine
            label="정성 비중"
            value={`${qualitativeTotal}%`}
            valueClassName={qualityColor}
            description="권장 30% 이하"
          />
          <KpiReviewLine
            label="작성 상태"
            value={`${draftCount}개 작성`}
            description={lockedCount > 0 ? `${lockedCount}개 제출·확정` : '제출 전'}
          />
        </div>
      </div>
    </section>
  );
}
