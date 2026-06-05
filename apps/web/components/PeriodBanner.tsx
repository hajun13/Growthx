'use client';

import { CalendarClock, Lock } from 'lucide-react';
import { useCurrentCycle } from '@/hooks/useCurrentCycle';
import { useCurrentPhase } from '@/hooks/useCurrentPhase';
import { schedulePhaseText } from '@/lib/ui';
import { cn } from '@/lib/utils';

function fmtDate(iso: string | null): string {
  if (!iso) return '미정';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '미정';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

// M3 Item 5: 임직원 화면 상단 현재 기간 배너.
// 백엔드 current-phase 미배포 시 데이터 없음 → 렌더 안 함(조용한 폴백).
export function PeriodBanner() {
  const { current } = useCurrentCycle();
  const { data: phase } = useCurrentPhase(current?.id, {
    enabled: !!current?.id,
  });

  // 활성 단계 없으면(백엔드 phase=null) 배너 미표시.
  if (!phase || !phase.phase) return null;

  const locked = phase.isLocked;
  const Icon = locked ? Lock : CalendarClock;

  // 백엔드는 daysRemaining 을 주지 않음 — dueDate 로 프론트가 산출.
  const daysRemaining: number | null = phase.dueDate
    ? Math.ceil(
        (new Date(phase.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : null;

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 border px-4 py-2.5 text-sm',
        locked
          ? 'border-warning-200 bg-warning-50 text-warning-700'
          : 'border-[#BBD6FB] bg-[#EBF3FE] text-[#1B4DCB]',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="font-semibold">
        현재 기간: {schedulePhaseText(phase.phase)}
      </span>
      <span className="opacity-80">마감 {fmtDate(phase.dueDate)}</span>
      {daysRemaining !== null && daysRemaining >= 0 && !locked && (
        <span className="opacity-80">· D-{daysRemaining}</span>
      )}
      {locked && <span className="font-medium">· 작성 잠금 중</span>}
    </div>
  );
}
