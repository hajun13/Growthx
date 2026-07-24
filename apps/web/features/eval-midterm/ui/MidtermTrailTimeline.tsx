'use client';

import { Card } from '@/components/Card';
import { cn } from '@/lib/utils';
import type { MidtermTrailEntry } from '@/lib/types';

const ACTION_LABEL: Record<MidtermTrailEntry['action'], string> = {
  commented: '1차 코멘트',
  revised: '수정 제출',
  returned: '반려',
  approved: '최종 승인',
  reopened: '확정 되돌림',
  reassigned: '평가자 재배정',
};

/** KPI 변경 필드 라벨 — 2차 검토 화면(FinalReviewPanel)도 같은 표기를 써야 해서 export. */
export const MIDTERM_FIELD_LABEL: Record<string, string> = {
  targetValue: '목표값',
  targetText: '목표',
  weight: '가중치',
};

/** 변경 전/후 값 표기(빈 값 → "(없음)", 가중치 → % 부기). 라벨과 같은 이유로 export. */
export function formatMidtermValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '(없음)';
  if (field === 'weight') return `${String(value)}%`;
  return String(value);
}

/** 중간점검 진행 이력 — 누가·언제·무엇을 어떻게 바꿨는지. */
export function MidtermTrailTimeline({ entries }: { entries: MidtermTrailEntry[] }) {
  if (!entries.length) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">아직 진행 이력이 없어요.</p>
      </Card>
    );
  }
  return (
    <Card>
      <h3 className="mb-4 text-base font-semibold text-foreground">진행 이력</h3>
      <ol className="space-y-4">
        {entries.map((e) => (
          <li key={e.id} className="border-l-2 border-border pl-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-semibold text-foreground">
                {e.actorPosition ? `${e.actorPosition} ` : ''}
                {e.actorName}
              </span>
              <span className="text-sm text-foreground">{ACTION_LABEL[e.action]}</span>
              {e.onBehalfOf && (
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
                  인사 대리
                </span>
              )}
              <span className="text-[12px] text-muted-foreground tabular-nums">
                {new Date(e.createdAt).toLocaleString('ko-KR')}
              </span>
            </div>
            {e.comment && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{e.comment}</p>
            )}
            {/* KPI별 판정·코멘트 — 'commented'(1차 코멘트) 엔트리는 부서장 판정(수락/조정필요)
                배지 + 코멘트, 'revised'(수정 제출) 엔트리는 decision=null 인 구성원 조정
                코멘트라 배지 없이 KPI 제목+코멘트만(누가·어느 KPI에·무슨 코멘트인지 한 줄에).
                배지 색은 1차 검토 화면과 통일(수락 녹색·조정필요 주황). */}
            {e.kpiReviews && e.kpiReviews.length > 0 && (
              <>
                <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                  {e.action === 'revised' ? '구성원 조정 코멘트' : 'KPI별 판정'}
                </p>
                <ul className="mt-1 space-y-1.5">
                {e.kpiReviews.map((r) => (
                  <li key={r.kpiId} className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{r.kpiTitle}</span>
                    {r.decision && (
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10.5px] font-semibold',
                          r.decision === 'accepted'
                            ? 'bg-success-50 text-success-600'
                            : 'bg-status-revision-bg text-status-revision-fg',
                        )}
                      >
                        {r.decision === 'accepted' ? '수락' : '조정 필요'}
                      </span>
                    )}
                    {r.note && <span className="text-foreground/80">{r.note}</span>}
                  </li>
                ))}
                </ul>
              </>
            )}
            {e.kpiChanges.length > 0 && (
              <ul className="mt-2 space-y-1">
                {e.kpiChanges.map((c, i) => (
                  <li key={`${c.kpiId}-${c.field}-${i}`} className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{c.kpiTitle}</span> ·{' '}
                    {MIDTERM_FIELD_LABEL[c.field] ?? c.field}{' '}
                    <span className="tabular-nums">{formatMidtermValue(c.field, c.before)}</span>
                    {' → '}
                    <span className="font-medium text-foreground tabular-nums">
                      {formatMidtermValue(c.field, c.after)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
