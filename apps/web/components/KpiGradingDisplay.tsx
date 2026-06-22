'use client';

import { T, gradeChipColor } from '@/lib/palette';
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

function GradeChip({ grade }: { grade: Grade }) {
  const c = gradeChipColor[grade] ?? gradeChipColor.B;
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ width: 20, height: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, flexShrink: 0 }}
    >
      {grade}
    </span>
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

// KPI 1건의 등급 부여 기준을 결정 — 측정방식별로 출처가 다르다.
//  ① 정성 서술(gradingCriteria, KPI별) → ② 건수 임계값(grading, KPI별) → ③ amount/rate 공통 달성률표(RuleSet)
function resolveGradingRows(
  kpi: Kpi,
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
 * bare: 상단 구분선/제목 없이 행만 렌더(카드 내부 임베드용).
 */
export function KpiGradingDisplay({
  kpi,
  scales,
  highlightGrade,
  bare,
}: {
  kpi: Kpi;
  scales?: RuleSet['gradingScales'];
  highlightGrade?: Grade;
  bare?: boolean;
}) {
  const resolved = resolveGradingRows(kpi, scales);
  if (!resolved) {
    return (
      <div
        className={bare ? '' : 'mt-2.5 pt-2.5'}
        style={{
          borderTop: bare ? undefined : `1px dashed ${T.grey200}`,
          fontSize: 11.5,
          color: T.grey400,
        }}
      >
        등급 부여 기준이 설정되지 않았어요. ({measureTypeLabel[kpi.measureType]})
      </div>
    );
  }
  return (
    <div
      className={bare ? '' : 'mt-2.5 pt-2.5'}
      style={{ borderTop: bare ? undefined : `1px dashed ${T.grey200}` }}
    >
      {!bare && (
        <div className="flex items-center gap-1.5" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>등급 부여 기준</span>
          <span style={{ fontSize: 10.5, color: T.grey400 }}>· {resolved.sourceLabel}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
        {resolved.items.map((r) => {
          const on = highlightGrade === r.grade;
          const c = gradeChipColor[r.grade] ?? gradeChipColor.B;
          return (
            <div
              key={r.grade}
              className="flex min-w-0 items-start gap-2 rounded-none"
              style={
                on
                  ? { background: `${c.bg}14`, border: `1px solid ${c.bg}`, padding: '8px 8px' }
                  : { padding: '8px 8px', border: '1px solid transparent' }
              }
            >
              <GradeChip grade={r.grade} />
              <span
                style={{
                  fontSize: 12,
                  color: on ? T.grey900 : T.grey700,
                  fontWeight: on ? 600 : 400,
                  lineHeight: 1.55,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {r.text}
              </span>
            </div>
          );
        })}
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
      <div
        className={bare ? '' : 'mt-2.5 pt-2.5'}
        style={{
          borderTop: bare ? undefined : `1px dashed ${T.grey200}`,
          fontSize: 11.5,
          color: T.grey400,
        }}
      >
        매출 절대금액 등급 기준이 설정되지 않았어요. (규칙 설정에서 지정)
      </div>
    );
  }
  const byGrade = new Map(scale.map((e) => [e.grade, e]));
  const matched = matchRevenueGrade(inputAmount, scale);
  return (
    <div
      className={bare ? '' : 'mt-2.5 pt-2.5'}
      style={{ borderTop: bare ? undefined : `1px dashed ${T.grey200}` }}
    >
      {!bare && (
        <div className="flex items-center gap-1.5" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>등급 부여 기준</span>
          <span style={{ fontSize: 10.5, color: T.grey400 }}>· 매출 절대금액 기준</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
        {GRADE_ORDER.filter((g) => byGrade.has(g)).map((g) => {
          const e = byGrade.get(g)!;
          const on = matched === g;
          const c = gradeChipColor[g] ?? gradeChipColor.B;
          return (
            <div
              key={g}
              className="flex min-w-0 items-start gap-2 rounded-none"
              style={
                on
                  ? { background: `${c.bg}14`, border: `1px solid ${c.bg}`, padding: '8px 8px' }
                  : { padding: '8px 8px', border: '1px solid transparent' }
              }
            >
              <GradeChip grade={g} />
              <span
                className="tabular-nums"
                style={{
                  fontSize: 12,
                  color: on ? T.grey900 : T.grey700,
                  fontWeight: on ? 600 : 400,
                  lineHeight: 1.55,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {fmtAmount(e.minAmount)} 이상
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
