'use client';

/**
 * SelfProgressCard — 본인평가 진행 요약 (컴팩트 헤더 칩).
 * 큰 요약 카드를 폐기하고 헤더 우측 슬롯에 들어가는 한 줄 진행 칩으로 축소.
 * 상세 완료/미완료 수치는 하단 고정 바가 담당.
 */
interface Props {
  totalCount: number;
  doneCount: number;
  progressPct: number;
  missingCount: number;
}

export function SelfProgressCard({
  totalCount,
  doneCount,
  progressPct,
  missingCount,
}: Props) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-1.5">
      <span className="tabular-nums text-[13px] font-bold text-foreground">
        {doneCount}
        <span className="font-medium text-muted-foreground">/{totalCount}</span>
      </span>
      <div className="h-1.5 w-24 overflow-hidden rounded-md bg-muted">
        <div
          className={`h-full rounded-md transition-all duration-500 ${progressPct === 100 ? 'bg-success-500' : 'bg-primary'}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <span className="tabular-nums text-[12px] font-semibold text-primary">{progressPct}%</span>
      {missingCount > 0 && (
        <span className="text-[11.5px] font-medium text-danger-600">미입력 {missingCount}</span>
      )}
    </div>
  );
}
