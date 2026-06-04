'use client';

import { useMemo } from 'react';
import { Card } from './Card';
import { Tabs } from './Tabs';
import { TextField } from './TextField';
import { InfoBanner } from './InfoBanner';
import { cn } from '@/lib/utils';
import type { Grade } from '@/lib/types';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];
const TIERS = ['excellent', 'standard', 'poor'] as const;
type Tier = (typeof TIERS)[number];
const tierLabel: Record<Tier, string> = {
  excellent: '우수',
  standard: '보통',
  poor: '미흡',
};

// amount/rate 밴드(하한/상한). count 는 KPI별 grading 이라 안내만.
export interface RuleSetDraft {
  gradeScale: { grade: Grade; min: number; max: number }[];
  gradingScales: {
    amount: { grade: Grade; minRate: number; maxRate: number | null }[];
    rate: { grade: Grade; minRate: number; maxRate: number | null }[];
  };
  poolRatios: Record<Tier, Record<Grade, number>>;
  raiseRates: Record<Grade, number>;
  weightPolicy: { totalMustEqual: number; qualitativeMaxPercent: number };
}

export interface RuleSetEditorProps {
  value: RuleSetDraft;
  onChange: (v: RuleSetDraft) => void;
  measureTab: 'amount' | 'rate';
  onMeasureTabChange: (t: 'amount' | 'rate') => void;
}

// ── 검증(프론트 즉시 피드백, 최종은 백엔드) ──
export function validateRuleSet(v: RuleSetDraft): {
  ok: boolean;
  gradeScale?: string;
  gradingScales?: string;
  poolRatios?: string;
  raiseRates?: string;
  weightPolicy?: string;
} {
  const errors: ReturnType<typeof validateRuleSet> = { ok: true };

  // 등급 척도: min<=max, 구간 겹침 없음.
  for (const e of v.gradeScale) {
    if (e.min > e.max) {
      errors.gradeScale = '등급 구간의 최소점이 최대점보다 클 수 없어요.';
    }
  }
  // 인접 등급 겹침/역전(S>A>B>C>D 순으로 min 내림차순).
  const sorted = GRADES.map((g) => v.gradeScale.find((e) => e.grade === g)!);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i] && sorted[i + 1] && sorted[i].min <= sorted[i + 1].max) {
      // 위 등급 최소점이 아래 등급 최대점 이하면 겹침.
      if (sorted[i].min <= sorted[i + 1].min) {
        errors.gradeScale = '등급 구간이 겹치거나 순서가 어긋났어요.';
      }
    }
  }

  // 달성률 밴드: 각 측정방식 하한이 비어 있지 않게.
  for (const key of ['amount', 'rate'] as const) {
    const bands = v.gradingScales[key];
    if (!bands || bands.length === 0) {
      errors.gradingScales = '측정방식별 달성률표를 입력해 주세요.';
    }
  }

  // 풀 비율: 각 tier 합 = 100(±0.01).
  for (const t of TIERS) {
    const sum = GRADES.reduce((acc, g) => acc + (v.poolRatios[t][g] || 0), 0);
    if (Math.abs(sum - 100) > 0.01) {
      errors.poolRatios = `${tierLabel[t]} 그룹의 풀 비율 합이 100%가 아니에요.`;
    }
  }

  // 인상률: 음수 불가.
  for (const g of GRADES) {
    if (v.raiseRates[g] < 0) errors.raiseRates = '인상률은 음수가 될 수 없어요.';
  }

  // 정성 상한: 0~100.
  const q = v.weightPolicy.qualitativeMaxPercent;
  if (q < 0 || q > 100) {
    errors.weightPolicy = '정성 상한은 0~100% 사이여야 해요.';
  }

  errors.ok =
    !errors.gradeScale &&
    !errors.gradingScales &&
    !errors.poolRatios &&
    !errors.raiseRates &&
    !errors.weightPolicy;
  return errors;
}

export function RuleSetEditor({
  value,
  onChange,
  measureTab,
  onMeasureTabChange,
}: RuleSetEditorProps) {
  const errors = useMemo(() => validateRuleSet(value), [value]);

  const setGradeScale = (grade: Grade, field: 'min' | 'max', n: number) =>
    onChange({
      ...value,
      gradeScale: value.gradeScale.map((e) =>
        e.grade === grade ? { ...e, [field]: n } : e,
      ),
    });

  const setBand = (
    key: 'amount' | 'rate',
    grade: Grade,
    field: 'minRate' | 'maxRate',
    raw: string,
  ) => {
    const n = raw === '' ? null : Number(raw);
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
  };

  const setPool = (t: Tier, grade: Grade, n: number) =>
    onChange({
      ...value,
      poolRatios: {
        ...value.poolRatios,
        [t]: { ...value.poolRatios[t], [grade]: n },
      },
    });

  return (
    <div className="flex flex-col gap-6">
      {/* 등급 척도 */}
      <Card title="등급 척도 (점수 → 등급)">
        <div className="flex flex-col gap-3">
          {GRADES.map((g) => {
            const e = value.gradeScale.find((x) => x.grade === g)!;
            return (
              <div key={g} className="flex items-center gap-3">
                <span className="w-6 font-semibold text-foreground">{g}</span>
                <div className="w-28">
                  <TextField
                    label="최소점"
                    hideLabel
                    type="number"
                    value={String(e?.min ?? 0)}
                    onChange={(v2) => setGradeScale(g, 'min', Number(v2))}
                  />
                </div>
                <span className="text-muted-foreground">~</span>
                <div className="w-28">
                  <TextField
                    label="최대점"
                    hideLabel
                    type="number"
                    value={String(e?.max ?? 0)}
                    onChange={(v2) => setGradeScale(g, 'max', Number(v2))}
                  />
                </div>
              </div>
            );
          })}
          {errors.gradeScale && (
            <p className="text-sm text-destructive">{errors.gradeScale}</p>
          )}
        </div>
      </Card>

      {/* 측정방식별 달성률표 */}
      <Card title="측정방식별 달성률표 (달성률 % → 등급)">
        <Tabs
          items={[
            { key: 'amount', label: '달성금액(amount)' },
            { key: 'rate', label: '증감률(rate)' },
          ]}
          activeKey={measureTab}
          onChange={(k) => onMeasureTabChange(k as 'amount' | 'rate')}
        />
        <div className="mt-4 flex flex-col gap-3">
          {GRADES.map((g) => {
            const e = value.gradingScales[measureTab].find(
              (x) => x.grade === g,
            );
            return (
              <div key={g} className="flex items-center gap-3">
                <span className="w-6 font-semibold text-foreground">{g}</span>
                <div className="w-28">
                  <TextField
                    label="하한"
                    hideLabel
                    type="number"
                    value={String(e?.minRate ?? 0)}
                    onChange={(v2) => setBand(measureTab, g, 'minRate', v2)}
                    suffix="%"
                  />
                </div>
                <span className="text-muted-foreground">~</span>
                <div className="w-28">
                  <TextField
                    label="상한"
                    hideLabel
                    type="number"
                    value={e?.maxRate === null || e?.maxRate === undefined ? '' : String(e.maxRate)}
                    onChange={(v2) => setBand(measureTab, g, 'maxRate', v2)}
                    placeholder="상한 없음"
                    suffix="%"
                  />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            상한을 비워 두면 상한 없음(∞)이에요. 건수(count)는 KPI별 임계
            건수에서 관리해요.
          </p>
          {errors.gradingScales && (
            <p className="text-sm text-destructive">{errors.gradingScales}</p>
          )}
        </div>
      </Card>

      {/* 그룹 풀 비율 매트릭스 */}
      <Card title="그룹 풀 비율 (tier × 등급, 행 합 100%)">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">tier</th>
                {GRADES.map((g) => (
                  <th key={g} className="px-2 py-2 text-center font-medium">
                    {g}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-medium">합계</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((t) => {
                const sum = GRADES.reduce(
                  (acc, g) => acc + (value.poolRatios[t][g] || 0),
                  0,
                );
                const bad = Math.abs(sum - 100) > 0.01;
                return (
                  <tr key={t} className="border-t border-border/60">
                    <td className="py-2 pr-3 font-medium text-foreground">
                      {tierLabel[t]}
                    </td>
                    {GRADES.map((g) => (
                      <td key={g} className="px-1 py-2">
                        <input
                          type="number"
                          aria-label={`${tierLabel[t]} ${g} 비율`}
                          value={value.poolRatios[t][g]}
                          onChange={(ev) =>
                            setPool(t, g, Number(ev.target.value))
                          }
                          className="h-9 w-16 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </td>
                    ))}
                    <td
                      className={cn(
                        'px-2 py-2 text-right font-semibold tabular-nums',
                        bad ? 'text-destructive' : 'text-success-700',
                      )}
                    >
                      {sum}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {errors.poolRatios && (
          <p className="mt-2 text-sm text-destructive">{errors.poolRatios}</p>
        )}
      </Card>

      {/* 인상률 + 가중치 정책 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="등급별 인상률">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {GRADES.map((g) => (
              <TextField
                key={g}
                label={`${g} 등급`}
                type="number"
                value={String(value.raiseRates[g])}
                onChange={(v2) =>
                  onChange({
                    ...value,
                    raiseRates: { ...value.raiseRates, [g]: Number(v2) },
                  })
                }
                suffix="%"
              />
            ))}
          </div>
          {errors.raiseRates && (
            <p className="mt-2 text-sm text-destructive">{errors.raiseRates}</p>
          )}
        </Card>

        <Card title="가중치 정책">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="가중치 합계(고정)"
              type="number"
              value={String(value.weightPolicy.totalMustEqual)}
              onChange={() => {}}
              readOnly
              suffix="%"
            />
            <TextField
              label="정성 KPI 상한"
              type="number"
              value={String(value.weightPolicy.qualitativeMaxPercent)}
              onChange={(v2) =>
                onChange({
                  ...value,
                  weightPolicy: {
                    ...value.weightPolicy,
                    qualitativeMaxPercent: Number(v2),
                  },
                })
              }
              suffix="%"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            성과중심 70/80% · 협업·성장 20/30% 비율은 그룹별로 적용돼요.
          </p>
          {errors.weightPolicy && (
            <p className="mt-2 text-sm text-destructive">
              {errors.weightPolicy}
            </p>
          )}
        </Card>
      </div>

      <InfoBanner tone="warning" title="재산정 영향 안내">
        활성 주기의 규칙을 바꾸면 점수·등급·풀·인상률이 다시 산정돼요. 저장 전
        변경 내용을 확인해 주세요.
      </InfoBanner>
    </div>
  );
}
