'use client';

import { GradeChip } from '@/components/GradeChip';
import { RuleSetChip } from './RuleSetChip';
import { fmtScore } from '@/lib/ui';
import { cn } from '@/lib/utils';
import type { Grade, OrgSnapshot } from '@/lib/types';

export interface YearDetailCardProps {
  year: number;
  finalGrade: Grade | null;
  finalScore: number | null;
  perfScore: number | null; // 실적(원형)
  compScore: number | null; // 역량 — null이면 "—", 값 있으면 "(참고)" 캡션
  org: OrgSnapshot;
  // 전년 대비 조직 변경 여부(셀별).
  orgChanged?: { group: boolean; division: boolean; team: boolean };
  ruleSummary: { competencyIncluded: boolean; perfWeight?: number };
}

function OrgRow({
  label,
  value,
  changed,
}: {
  label: string;
  value: string | null;
  changed?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[12px]">
      {changed && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
        />
      )}
      <span className="w-7 shrink-0 text-toss-grey500">{label}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-toss-grey800">
        {value ?? '—'}
      </span>
      {changed && (
        <span className="shrink-0 text-[10px] font-semibold text-primary">
          변경
        </span>
      )}
    </div>
  );
}

// 연도별 상세 카드(개인 탭). 사각 카드. 백엔드 값 표시만.
export function YearDetailCard({
  year,
  finalGrade,
  finalScore,
  perfScore,
  compScore,
  org,
  orgChanged,
  ruleSummary,
}: YearDetailCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-none border border-border bg-card p-4">
      {/* 헤더: 연도 + 등급 + 점수 */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold tabular-nums text-toss-grey900">
          {year}
        </span>
        <div className="flex items-center gap-2">
          <GradeChip grade={finalGrade} variant="soft" />
          <span className="text-[13px] font-bold tabular-nums text-toss-grey900">
            {fmtScore(finalScore)}
          </span>
        </div>
      </div>

      {/* 실적 / 역량 */}
      <div className="flex flex-col gap-1 border-y border-border py-2.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-toss-grey500">실적</span>
          <span className="font-medium tabular-nums text-toss-grey800">
            {fmtScore(perfScore)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-toss-grey500">역량</span>
          <span className="tabular-nums text-toss-grey800">
            {compScore == null ? (
              <span aria-hidden>—</span>
            ) : (
              <>
                <span className="font-medium">{fmtScore(compScore)}</span>
                <span className="ml-1 text-[11px] text-toss-grey500">
                  (참고)
                </span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* 조직 3줄 */}
      <div className="flex flex-col gap-1">
        <OrgRow label="그룹" value={org.group} changed={orgChanged?.group} />
        <OrgRow
          label="본부"
          value={org.division}
          changed={orgChanged?.division}
        />
        <OrgRow label="팀" value={org.team} changed={orgChanged?.team} />
      </div>

      {/* RuleSet 칩 */}
      <div className={cn('flex')}>
        <RuleSetChip
          competencyIncluded={ruleSummary.competencyIncluded}
          perfWeight={ruleSummary.perfWeight}
        />
      </div>
    </div>
  );
}
