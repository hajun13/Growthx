'use client';

// 평가 규칙 에디터 공용 조각 — 섹션 헤더·안내 박스·등급/tier 배지·Stepper·토글 행.
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FieldError } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { Grade } from '@/lib/types';
import { tierLabel, type Tier } from './RuleSetEditorModel';

// 막대/세그먼트용 등급 면색(solid) — 테마 토큰 클래스.
export const GRADE_BG: Record<Grade, string> = {
  S: 'bg-grade-s',
  A: 'bg-grade-a',
  B: 'bg-grade-b',
  C: 'bg-grade-c',
  D: 'bg-grade-d',
};

// tier(우수/보통/미흡) 면색·상단 강조선.
export const TIER_BG: Record<Tier, string> = {
  excellent: 'bg-info-50',
  standard: 'bg-neutral-100',
  poor: 'bg-warning-50',
};
export const TIER_BORDER_T: Record<Tier, string> = {
  excellent: 'border-t-info-700',
  standard: 'border-t-neutral-700',
  poor: 'border-t-warning-600',
};
const TIER_VARIANT = { excellent: 'info', standard: 'neutral', poor: 'warning' } as const;

const GRADE_VARIANT = {
  S: 'grade-s',
  A: 'grade-a',
  B: 'grade-b',
  C: 'grade-c',
  D: 'grade-d',
} as const;

// §2-3 카드 섹션 헤더 — surface-muted 배경 + 헤어라인.
export function ContentHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="border-b border-border bg-muted px-6 py-4">
      <h3 className="text-14 font-bold text-foreground">{title}</h3>
      {desc && <p className="mt-0.5 text-11h text-muted-foreground">{desc}</p>}
    </div>
  );
}

// 친절 안내 박스 — 액션 블루 info 톤.
export function HintBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-info-200 bg-info-50/50 px-3.5 py-2.75 text-12 leading-relaxed text-neutral-700">
      {children}
    </div>
  );
}

// 인라인 검증 에러 — 빨강 줄.
export function RuleError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <FieldError className="mt-1 text-12 font-semibold text-danger-600">
      <span className="flex items-center gap-1.5">
        <AlertTriangle size={13} /> {msg}
      </span>
    </FieldError>
  );
}

// 합계 상태(초과/부족 ↔ 정상) 한 줄 — 풀 비율·가중치 도넛 공용.
export function SumStatus({ bad, badText, okText }: { bad: boolean; badText: string; okText: string }) {
  return bad ? (
    <span className="flex items-center gap-1 text-11h font-semibold text-danger-600">
      <AlertTriangle size={12} />
      {badText}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-11h font-semibold text-success-600">
      <CheckCircle2 size={12} /> {okText}
    </span>
  );
}

// 등급 배지(S~D) — 정사각 Badge. compact 는 풀 비율 인라인용 소형.
export function GradeBadge({ grade, compact = false }: { grade: Grade; compact?: boolean }) {
  return (
    <Badge variant={GRADE_VARIANT[grade]} size={compact ? 'grade-sm' : 'grade-md'}>
      {grade}
    </Badge>
  );
}

// tier 배지(우수/보통/미흡) — Pill.
export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <Badge variant={TIER_VARIANT[tier]} shape="pill">
      {tierLabel[tier]}
    </Badge>
  );
}

// 축 눈금(0~max 균등 5칸 라벨).
export function AxisTicks({ labels }: { labels: string[] }) {
  return (
    <div className="flex justify-between text-10 tabular-nums text-neutral-400">
      {labels.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  );
}

// 토글 한 행(라벨·설명·스위치) — 가중치 정책 강제 옵션.
export function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md border border-border px-3.5 py-3',
        checked ? 'bg-info-50/50' : 'bg-card',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-12h font-semibold text-foreground">
          {label}
          <span
            className={cn(
              'ml-2 text-10h font-bold',
              checked ? 'text-primary' : 'text-neutral-500',
            )}
          >
            {checked ? '강제 켜짐' : '꺼짐'}
          </span>
        </div>
        <p className="mt-0.75 text-11 leading-normal text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
