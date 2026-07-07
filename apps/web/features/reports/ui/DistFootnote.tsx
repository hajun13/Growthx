'use client';

// 하단 안내문 — image 14: 점수 산정·등급 기준·반영 방식·참고사항.
// 점수 규칙 = 실적(KPI) 100% · 역량 미반영(참고용). 등급 밴드는 주기 RuleSet(gradeScale)에서 로드.
import { Info } from 'lucide-react';
import { useRuleSet } from '@/hooks/useRuleSets';

export function DistFootnote({
  ruleSetId,
  provisional = false,
}: {
  ruleSetId?: string | null;
  // 주기 closed 전(잠정 집계) 여부 — 확정 뉘앙스 문구를 완화.
  provisional?: boolean;
}) {
  const { data: ruleSet } = useRuleSet(ruleSetId ?? null);

  // RuleSet gradeScale(min 내림차순) → "S(95점 이상), A(85점 이상 95점 미만), … D(60점 미만)".
  const bands = [...(ruleSet?.gradeScale ?? [])].sort((a, b) => b.min - a.min);
  const bandText = bands
    .map((b, i) => {
      if (i === 0) return `${b.grade}(${b.min}점 이상)`;
      if (i === bands.length - 1) return `${b.grade}(${bands[i - 1].min}점 미만)`;
      return `${b.grade}(${b.min}점 이상 ${bands[i - 1].min}점 미만)`;
    })
    .join(', ');

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-foreground">
        <Info size={14} className="text-primary" aria-hidden />
        안내
      </div>
      <ul className="space-y-1 text-[12px] leading-relaxed text-muted-foreground">
        <li>
          최종점수는 실적(KPI) 100% 기준 점수입니다. 역량평가는 참고용으로 연봉·등급에 반영되지
          않습니다.
        </li>
        <li>
          {bandText
            ? `등급 기준(현재 주기 규칙): ${bandText}`
            : '등급 기준은 주기별 규칙(RuleSet) 설정을 따릅니다'}
          {' — 실제 등급 풀 기준은 그룹 단위로 산정돼요.'}
        </li>
        {provisional && (
          <li>표시되는 점수·등급은 주기 마감(closed) 전 잠정 집계값으로, 확정 결과와 다를 수 있습니다.</li>
        )}
        <li>전사 평균은 반올림되어 표시되며, 실제 계산과 차이가 있을 수 있습니다.</li>
      </ul>
    </div>
  );
}
