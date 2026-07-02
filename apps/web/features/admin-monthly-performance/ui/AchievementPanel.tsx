'use client';

// 우측 "목표 대비 달성 현황" 패널 — image 11: 매출 달성률/이익률/매출총이익 + 상태 배지(위험/주의/양호).
import { formatComma } from './FinancialGridHelpers';
import { achievementTone, achievementToneLabel, achievementToneClass, fmtPct1 } from './perfFormat';

export interface AchievementRow {
  label: string;
  rate: number | null;
  targetDisplay: string;
}

export function AchievementPanel({ month, rows }: { month: number; rows: AchievementRow[] }) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-4 shadow-elev-1">
      <div className="mb-2.5 text-[13px] font-bold text-foreground">목표 대비 달성 현황 ({month}월)</div>
      {/* 타일 flex-1 — 옆 입력표가 정한 행 높이를 균등하게 채워 카드 높이가 항상 일치. */}
      <div className="flex flex-1 flex-col gap-2">
        {rows.map((row) => {
          const tone = achievementTone(row.rate);
          return (
            <div key={row.label} className="flex flex-1 flex-col justify-center rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted-foreground">{row.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${achievementToneClass[tone]}`}>
                  {achievementToneLabel[tone]}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[16px] font-bold tabular-nums text-foreground">{fmtPct1(row.rate)}</span>
                <span className="text-[11px] text-muted-foreground">목표 {row.targetDisplay}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 표시용 헬퍼(금액 콤마) — 부모에서 targetDisplay 조립 시 재사용.
export function formatTargetAmount(value: number | null): string {
  return value === null ? '-' : `${formatComma(String(value))}원`;
}
