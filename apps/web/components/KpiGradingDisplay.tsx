'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { measureTypeLabel, fmtAmount, humanizeRateBand } from '@/lib/ui';
import type {
  Kpi,
  Grade,
  CountGradingEntry,
  GradingScaleEntry,
  RuleSet,
} from '@/lib/types';

// 등급 표시 순서(S→D 고정).
const GRADE_ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];

// 절대금액(원) → 등급 매칭(내림차순, minAmount 이상 첫 등급). revenueGrade 백엔드 로직과 동일.
export function matchRevenueGrade(
  amount: number | null | undefined,
  scale: { grade: Grade; minAmount: number }[] | undefined,
): Grade | undefined {
  if (amount === null || amount === undefined || !scale || scale.length === 0)
    return undefined;
  const sorted = [...scale].sort((a, b) => b.minAmount - a.minAmount);
  for (const e of sorted) if (amount >= e.minAmount) return e.grade;
  return undefined;
}

const GRADE_VARIANT = {
  S: 'grade-s',
  A: 'grade-a',
  B: 'grade-b',
  C: 'grade-c',
  D: 'grade-d',
} as const;

// 하이라이트 행 틴트 — 등급 Solid 색의 6% (구 `${bg}10`).
const GRADE_TINT: Record<Grade, string> = {
  S: 'bg-grade-s/6',
  A: 'bg-grade-a/6',
  B: 'bg-grade-b/6',
  C: 'bg-grade-c/6',
  D: 'bg-grade-d/6',
};

function GradeChip({ grade }: { grade: Grade }) {
  return (
    <Badge variant={GRADE_VARIANT[grade] ?? GRADE_VARIANT.B} size="grade-sm">
      {grade}
    </Badge>
  );
}

// 등급 1칸(칩 + 기준 텍스트) — 서술형/금액 표시 공용.
function GradeCell({
  grade,
  on,
  tabular,
  children,
}: {
  grade: Grade;
  on: boolean;
  tabular?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2 p-2', on && GRADE_TINT[grade])}>
      <GradeChip grade={grade} />
      <span
        className={cn(
          'min-w-0 flex-1 text-12 leading-normal',
          tabular && 'tabular-nums',
          on ? 'font-semibold text-foreground' : 'font-normal text-neutral-700',
        )}
      >
        {children}
      </span>
    </div>
  );
}

// "등급 부여 기준" 소제목 줄.
function GradingHeading({ source }: { source: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="text-11 font-semibold text-muted-foreground">등급 부여 기준</span>
      <span className="text-10h text-neutral-400">· {source}</span>
    </div>
  );
}

function formatCountBand(e: CountGradingEntry): string {
  if (e.maxCount === null) return `${e.minCount}건 이상`;
  if (e.minCount === e.maxCount) return `${e.minCount}건`;
  return `${e.minCount}~${e.maxCount}건`;
}

function formatRateBand(e: GradingScaleEntry): string {
  // 경계 꼬리 숫자(110.0001 등)를 "110% 초과"처럼 사람말로. 저장값은 불변.
  return humanizeRateBand(e.minRate, e.maxRate);
}

// KpiGradingDisplay 가 실제로 읽는 필드만 요구하는 최소 형태 — 축약 진척 응답(KpiProgress 등,
// count 기준 grading 필드가 아예 없는 payload)에서도 원본 Kpi 를 흉내 내지 않고 그대로 넘길 수 있다.
export type GradingDisplayKpi = Pick<Kpi, 'gradingCriteria' | 'grading' | 'measureType'>;

// KPI 1건의 등급 부여 기준을 결정 — 측정방식별로 출처가 다르다.
//  ① 정성 서술(gradingCriteria, KPI별) → ② 건수 임계값(grading, KPI별) → ③ amount/rate 공통 달성률표(RuleSet)
function resolveGradingRows(
  kpi: GradingDisplayKpi,
  scales?: RuleSet['gradingScales'],
): { sourceLabel: string; items: { grade: Grade; text: string }[] } | null {
  const gc = kpi.gradingCriteria;
  if (gc && GRADE_ORDER.some((g) => (gc[g] ?? '').trim() !== '')) {
    return {
      sourceLabel: '정성 서술 기준',
      items: GRADE_ORDER.map((g) => ({ grade: g, text: (gc[g] ?? '').trim() || '—' })),
    };
  }

  if (kpi.grading && kpi.grading.length > 0) {
    const byGrade = new Map(kpi.grading.map((e) => [e.grade, e]));
    return {
      sourceLabel: '건수 기준',
      items: GRADE_ORDER.filter((g) => byGrade.has(g)).map((g) => ({
        grade: g,
        text: formatCountBand(byGrade.get(g)!),
      })),
    };
  }

  if ((kpi.measureType === 'amount' || kpi.measureType === 'rate') && scales) {
    const list = kpi.measureType === 'amount' ? scales.amount : scales.rate;
    if (list && list.length > 0) {
      const byGrade = new Map(list.map((e) => [e.grade, e]));
      return {
        sourceLabel:
          kpi.measureType === 'amount' ? '금액 달성률 기준 (공통)' : '증감률 기준 (공통)',
        items: GRADE_ORDER.filter((g) => byGrade.has(g)).map((g) => ({
          grade: g,
          text: formatRateBand(byGrade.get(g)!),
        })),
      };
    }
  }

  return null;
}

/**
 * KPI의 등급 부여 기준(S~D)을 읽기 전용으로 표시.
 * 검토 화면·본인 작성 화면(제출/확정 과제)에서 공통 사용.
 * highlightGrade: 달성/선택 등급 행을 강조(자동 산정 등급 표시용).
 * bare: 제목 없이 행만 렌더(카드 내부 임베드용).
 */
export function KpiGradingDisplay({
  kpi,
  scales,
  highlightGrade,
  bare,
}: {
  kpi: GradingDisplayKpi;
  scales?: RuleSet['gradingScales'];
  highlightGrade?: Grade;
  bare?: boolean;
}) {
  const resolved = resolveGradingRows(kpi, scales);
  if (!resolved) {
    return (
      <div className={cn(bare ? '' : 'pt-1', 'text-11h text-neutral-400')}>
        등급 부여 기준이 설정되지 않았어요. ({measureTypeLabel[kpi.measureType]})
      </div>
    );
  }
  return (
    <div className={bare ? '' : 'pt-1'}>
      {!bare && <GradingHeading source={resolved.sourceLabel} />}
      <div className="overflow-x-auto">
        <div className="grid min-w-190 grid-cols-5">
          {resolved.items.map((r) => (
            <GradeCell key={r.grade} grade={r.grade} on={highlightGrade === r.grade}>
              {r.text}
            </GradeCell>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 갭 #2 — 절대금액 모드(useAbsoluteAmount) 매출 KPI의 등급 부여 기준 표시.
 * 백엔드 산정과 동일한 revenueGradeScale(절대금액 원) 기준을 보여준다(달성률표 아님).
 * inputAmount 가 있으면 그 금액이 드는 등급을 실시간 강조(미리보기).
 */
export function RevenueGradeDisplay({
  scale,
  inputAmount,
  bare,
}: {
  scale?: { grade: Grade; minAmount: number }[];
  inputAmount?: number | null;
  bare?: boolean;
}) {
  if (!scale || scale.length === 0) {
    return (
      <div className={cn(bare ? '' : 'pt-1', 'text-11h text-neutral-400')}>
        매출 절대금액 등급 기준이 설정되지 않았어요. (규칙 설정에서 지정)
      </div>
    );
  }
  const byGrade = new Map(scale.map((e) => [e.grade, e]));
  const matched = matchRevenueGrade(inputAmount, scale);
  return (
    <div className={bare ? '' : 'pt-1'}>
      {!bare && <GradingHeading source="매출 절대금액 기준" />}
      <div className="overflow-x-auto">
        <div className="grid min-w-190 grid-cols-5">
          {GRADE_ORDER.filter((g) => byGrade.has(g)).map((g) => (
            <GradeCell key={g} grade={g} on={matched === g} tabular>
              {fmtAmount(byGrade.get(g)!.minAmount)} 이상
            </GradeCell>
          ))}
        </div>
      </div>
    </div>
  );
}
