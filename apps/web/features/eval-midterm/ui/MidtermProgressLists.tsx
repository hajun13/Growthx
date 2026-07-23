'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { MidtermWaitingGroup, MidtermWaitingRow } from '../api-progress';

/**
 * 진행 현황의 "미착수자" 목록 — MidtermProgressPanel 이 쓰는 표시 전용 컴포넌트.
 * 세 덩어리로 나눈다: ①평가자를 기다리는 건(그 평가자 기준으로 묶음 — HR 의 질문은
 * "누구에게 몇 명 분을 재촉하나") ②대상자 본인을 기다리는 건 ③평가자 미배정(재배정 필요).
 */

/** 경과일 표기 — 0일은 "오늘"로 적어야 "0일째"보다 읽기 쉽다. */
function elapsed(days: number): string {
  return days <= 0 ? '오늘' : `${days}일째`;
}

const PARTY_LABEL: Record<MidtermWaitingGroup['party'], string> = {
  first_reviewer: '1차 코멘트',
  final_reviewer: '2차 검토',
};

/** 대상자 한 줄(이름 · 부서 · 경과일). 묶음 안·본인 대기 목록에서 공용. */
function SubjectLine({ row }: { row: MidtermWaitingRow }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1">
      <span className="text-[12.5px] text-foreground">
        {row.subjectName}
        {row.departmentName && (
          <span className="ml-1.5 text-[11.5px] text-muted-foreground">{row.departmentName}</span>
        )}
      </span>
      <span className="text-[11.5px] tabular-nums text-muted-foreground">
        {elapsed(row.waitingDays)}
      </span>
    </li>
  );
}

export function MidtermWaitingLists({
  waitingOnReviewer,
  waitingOnMember,
  unassigned,
  unfinished,
}: {
  waitingOnReviewer: MidtermWaitingGroup[];
  waitingOnMember: MidtermWaitingRow[];
  unassigned: MidtermWaitingRow[];
  unfinished: number;
}) {
  if (unfinished === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success-100 bg-success-50 p-3">
        <CheckCircle2 size={15} className="text-success-700" aria-hidden />
        <p className="text-[12.5px] text-success-700">
          진행 중인 건이 없어요. 이번 주기의 중간점검은 모두 마감됐어요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {unassigned.length > 0 && (
        <div className="rounded-md border border-warning-300 bg-warning-50 p-3">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-warning-700">
            <AlertTriangle size={13} aria-hidden />
            평가자가 배정되지 않은 건 {unassigned.length}건
          </p>
          <p className="mt-1 text-[11.5px] text-warning-700">
            재촉으로는 풀리지 않아요. [평가자 재배정]을 실행하거나 조직의 부서장 지정을 확인해
            주세요.
          </p>
          <ul className="mt-1.5">
            {unassigned.map((row) => (
              <li key={row.reviewId} className="text-[12px] text-warning-700">
                {row.subjectName}
                {row.departmentName ? ` · ${row.departmentName}` : ''} — {elapsed(row.waitingDays)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h4 className="text-[12.5px] font-semibold text-foreground">평가자 처리 대기</h4>
        {waitingOnReviewer.length === 0 ? (
          <p className="mt-1 text-[12px] text-muted-foreground">
            평가자 차례로 멈춰 있는 건은 없어요.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {waitingOnReviewer.map((group) => (
              <li
                key={`${group.reviewerId}-${group.party}`}
                className="rounded-md border border-border bg-card p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-[12.5px] font-semibold text-foreground">
                    {group.reviewerName ?? '이름 확인 필요'}
                    <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">
                      {PARTY_LABEL[group.party]} 대기
                    </span>
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">
                      {group.count}
                    </span>
                    명 · 최장 {elapsed(group.maxWaitingDays)}
                  </p>
                </div>
                <ul className="mt-1.5 divide-y divide-border">
                  {group.rows.map((row) => (
                    <SubjectLine key={row.reviewId} row={row} />
                  ))}
                </ul>
                {group.rows.some((r) => r.compressedChain) && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    1차 평가자가 없어 그룹대표가 두 단계를 모두 맡은 건이 포함돼 있어요.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-[12.5px] font-semibold text-foreground">
          대상자 회신 대기{' '}
          <span className="font-normal text-muted-foreground">
            (코멘트를 받았거나 반려된 뒤 아직 제출하지 않음)
          </span>
        </h4>
        {waitingOnMember.length === 0 ? (
          <p className="mt-1 text-[12px] text-muted-foreground">
            대상자 차례로 멈춰 있는 건은 없어요.
          </p>
        ) : (
          <ul className="mt-1.5 divide-y divide-border rounded-md border border-border bg-card px-3 py-1">
            {waitingOnMember.map((row) => (
              <SubjectLine key={row.reviewId} row={row} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
