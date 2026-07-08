'use client';

// 상단 요약 카드 4종 — 시안: 현재 주기 / 전체 완료율(도넛+바) / 남은 기간(D-n) / 마감 후 예상 등급.
import { CalendarDays, Clock3, Flag } from 'lucide-react';
import { GradeChip } from '@/components/GradeChip';
import { T } from '@/lib/palette';
import type { Grade } from '@/lib/types';

const CARD = 'flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-4 shadow-elev-1';
const ICON_TILE = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg';

function MiniDonut({ pct }: { pct: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden className="shrink-0 -rotate-90">
      <circle cx="24" cy="24" r={r} fill="none" stroke={T.grey200} strokeWidth="5" />
      <circle
        cx="24" cy="24" r={r} fill="none" stroke={T.teal} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(Math.min(100, Math.max(0, pct)) / 100) * c} ${c}`}
      />
    </svg>
  );
}

export interface StatCardsProps {
  cycleName: string;
  phaseLabel: string;
  completionRate: number;
  /** 예: 'D-8' */
  dDay: string;
  /** 예: '07.01 (수) 마감' */
  dueLabel: string;
  /** 확정 등급(공개 시) — 미공개면 null */
  resultGrade: Grade | null;
  /** 결과 공개(최종평가) 일정 라벨 */
  resultOpenLabel: string;
}

export function StatCards({ cycleName, phaseLabel, completionRate, dDay, dueLabel, resultGrade, resultOpenLabel }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* 현재 주기 */}
      <div className={CARD}>
        <span className={`${ICON_TILE} bg-info-50 text-primary`}>
          <CalendarDays size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">현재 주기</p>
          <p className="truncate text-[17px] font-bold text-foreground">{cycleName}</p>
          <span className="mt-1 inline-flex rounded-full bg-info-50 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {phaseLabel}
          </span>
        </div>
      </div>

      {/* 전체 완료율 */}
      <div className={CARD}>
        <MiniDonut pct={completionRate} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-muted-foreground">전체 완료율</p>
          <p className="text-[20px] font-bold tabular-nums text-foreground">{completionRate}%</p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200" role="progressbar" aria-valuenow={completionRate} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand-teal" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
      </div>

      {/* 남은 기간 */}
      <div className={CARD}>
        <span className={`${ICON_TILE} bg-brand-teal-subtle text-brand-teal-strong`}>
          <Clock3 size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">남은 기간</p>
          <p className="text-[20px] font-bold tabular-nums text-foreground">{dDay}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{dueLabel}</p>
        </div>
      </div>

      {/* 마감 후 예상 등급 */}
      <div className={CARD}>
        <span className={`${ICON_TILE} bg-status-revision-bg text-status-revision-fg`}>
          <Flag size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">마감 후 예상 등급</p>
          {resultGrade ? (
            <div className="mt-0.5"><GradeChip grade={resultGrade} /></div>
          ) : (
            <p className="text-[17px] font-bold text-foreground">공개 전</p>
          )}
          <p className="mt-0.5 text-[12px] text-muted-foreground">{resultOpenLabel}</p>
        </div>
      </div>
    </div>
  );
}
