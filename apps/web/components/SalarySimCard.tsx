'use client';

import { ArrowRight } from 'lucide-react';
import { Card } from './Card';
import { GradeChip } from './GradeChip';
import { fmtSalary } from '@/lib/ui';
import type { CompensationSimulation, CompensationGradeRow } from '@/lib/types';

const GRADES = ['S', 'A', 'B', 'C', 'D'] as const;

export interface SalarySimCardProps {
  sim: CompensationSimulation;
  // 등급별 인상률(RuleSet.raiseRates) — 등급 비교 테이블용.
  raiseRates?: Record<string, number>;
}

// M3 Item 8: 개인 연봉 시뮬레이션 — 현재 연봉 → 등급 → 최종 인상률/연봉.
// 모든 값은 백엔드 산정(프론트 재계산 금지). 등급 비교 행만 RuleSet 인상률로 표시.
export function SalarySimCard({ sim, raiseRates }: SalarySimCardProps) {
  const finalRaiseRate = sim.finalRaiseRate ?? sim.raiseRate;
  const finalSalary = sim.finalProjectedSalary ?? sim.projectedSalary;

  // 백엔드가 byGrade[] 를 주면 그것을 우선(권위) — 없으면 RuleSet 인상률로 폴백 계산.
  const gradeRows: CompensationGradeRow[] | null =
    sim.byGrade && sim.byGrade.length > 0
      ? sim.byGrade
      : raiseRates
        ? GRADES.map((g) => {
            const rate = raiseRates[g] ?? 0;
            const projected =
              sim.currentSalary !== null
                ? Math.round(sim.currentSalary * (1 + rate / 100))
                : null;
            return { grade: g, raiseRate: rate, projectedSalary: projected };
          })
        : null;

  return (
    <Card title="내 연봉 시뮬레이션">
      <div className="flex flex-wrap items-center gap-4">
        <SimStep label="현재 연봉" value={fmtSalary(sim.currentSalary)} />
        <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">현재 등급</span>
          <GradeChip grade={sim.currentGrade} variant="solid" />
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        <SimStep
          label="최종 인상률"
          value={finalRaiseRate != null ? `${finalRaiseRate > 0 ? '+' : ''}${finalRaiseRate}%` : '—'}
        />
        <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        <SimStep
          label="최종 연봉"
          value={fmtSalary(finalSalary ?? null)}
          highlight
        />
      </div>

      {sim.currentSalary === null && (
        <p className="mt-3 text-xs text-muted-foreground">
          현재 연봉이 입력되지 않아 예상 연봉을 계산할 수 없어요. HR이 연봉을
          입력하면 표시돼요.
        </p>
      )}

      {gradeRows && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-foreground">
            등급별 예상 연봉 비교
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">등급</th>
                  <th className="py-2 pr-3 font-medium text-right">인상률</th>
                  <th className="py-2 font-medium text-right">예상 연봉</th>
                </tr>
              </thead>
              <tbody>
                {gradeRows.map((r) => {
                  const isCurrent = r.grade === sim.currentGrade;
                  return (
                    <tr
                      key={r.grade}
                      className={
                        'border-t border-border/60 ' +
                        (isCurrent ? 'bg-primary/5 font-semibold' : '')
                      }
                    >
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center gap-2">
                          <GradeChip grade={r.grade} size="sm" />
                          {isCurrent && (
                            <span className="text-xs text-primary">현재</span>
                          )}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        +{r.raiseRate}%
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {fmtSalary(r.projectedSalary)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            등급별 예상 연봉은 조정분을 제외하고 RuleSet 인상률만 적용한 참고값이에요.
          </p>
        </div>
      )}
    </Card>
  );
}

function SimStep({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={
          'tabular-nums ' +
          (highlight
            ? 'text-lg font-extrabold text-primary'
            : 'text-base font-semibold text-foreground')
        }
      >
        {value}
      </span>
    </div>
  );
}
