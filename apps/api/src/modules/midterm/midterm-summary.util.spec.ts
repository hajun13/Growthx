import { describe, it, expect } from 'vitest';
import { MidtermReviewStatus } from '@prisma/client';
import {
  groupWaitingByReviewer,
  isNotOpenedRow,
  resolveNotOpened,
  resolveWaitingOn,
  type MidtermSummaryRow,
  type MidtermWaitingRow,
} from './midterm-summary.util';

const NOW = new Date('2026-07-23T09:00:00.000Z');
const days = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

/**
 * 기본 행 — 대상자 1명, 1차(본부장)·2차(그룹대표)가 서로 다른 정상 체인.
 * updatedAt 은 기본적으로 createdAt 을 따라간다(갓 만들어진 행의 실제 모습).
 * 재개시·되돌림처럼 나중에 갱신된 행을 재현할 때만 updatedAt 을 따로 넘긴다.
 */
function row(over: Partial<MidtermSummaryRow> = {}): MidtermSummaryRow {
  const createdAt = over.createdAt ?? days(3);
  return {
    id: 'review-1',
    status: MidtermReviewStatus.pending,
    createdAt,
    updatedAt: createdAt,
    firstCommentedAt: null,
    memberSubmittedAt: null,
    decidedAt: null,
    evaluateeId: 'member-1',
    evaluateeName: '김구성',
    departmentName: 'CS1팀',
    firstReviewerId: 'div-1',
    firstReviewerName: '이본부',
    finalReviewerId: 'grp-1',
    finalReviewerName: '박대표',
    ...over,
  };
}

describe('resolveWaitingOn', () => {
  it('pending 은 1차 평가자를 기다린다 — 경과일은 개시(마지막 갱신) 시점 기준', () => {
    // 갓 개시된 행은 createdAt === updatedAt 이라 어느 쪽을 봐도 같다.
    const w = resolveWaitingOn(row({ createdAt: days(5), updatedAt: days(5) }), NOW);
    expect(w).toMatchObject({
      party: 'first_reviewer',
      waitingUserId: 'div-1',
      waitingUserName: '이본부',
      subjectId: 'member-1',
      subjectName: '김구성',
      departmentName: 'CS1팀',
      waitingDays: 5,
      compressedChain: false,
    });
  });

  it('재개시된 pending 은 원래 생성일이 아니라 재개시 시점부터 센다(경과일 부풀림 방지)', () => {
    // open() 의 update 브랜치가 몇 주 전에 만들어진 행을 오늘 다시 pending 으로 되돌린 경우.
    const w = resolveWaitingOn(row({ createdAt: days(30), updatedAt: days(1) }), NOW);
    expect(w?.waitingDays).toBe(1);
  });

  it('commented 는 본인(피평가자)을 기다린다 — 1차 코멘트 시점 기준', () => {
    const w = resolveWaitingOn(
      row({
        status: MidtermReviewStatus.commented,
        firstCommentedAt: days(2),
        updatedAt: days(0),
      }),
      NOW,
    );
    expect(w).toMatchObject({ party: 'member', waitingUserId: 'member-1', waitingDays: 2 });
    expect(w?.waitingUserName).toBe('김구성');
  });

  it('returned 도 본인을 기다린다 — 2차 판정 시점 기준', () => {
    const w = resolveWaitingOn(
      row({ status: MidtermReviewStatus.returned, decidedAt: days(4) }),
      NOW,
    );
    expect(w).toMatchObject({ party: 'member', waitingUserId: 'member-1', waitingDays: 4 });
  });

  it('revised 는 2차 검토자를 기다린다 — 본인 제출 시점 기준', () => {
    const w = resolveWaitingOn(
      row({ status: MidtermReviewStatus.revised, memberSubmittedAt: days(7) }),
      NOW,
    );
    expect(w).toMatchObject({
      party: 'final_reviewer',
      waitingUserId: 'grp-1',
      waitingUserName: '박대표',
      waitingDays: 7,
    });
  });

  it('closed 와 레거시 자가점검 상태는 대기 대상이 아니다', () => {
    expect(resolveWaitingOn(row({ status: MidtermReviewStatus.closed }), NOW)).toBeNull();
    expect(resolveWaitingOn(row({ status: MidtermReviewStatus.self_done }), NOW)).toBeNull();
    expect(resolveWaitingOn(row({ status: MidtermReviewStatus.confirmed }), NOW)).toBeNull();
    expect(
      resolveWaitingOn(row({ status: MidtermReviewStatus.revision_requested }), NOW),
    ).toBeNull();
    expect(resolveWaitingOn(row({ status: MidtermReviewStatus.rejected }), NOW)).toBeNull();
  });

  it('1/1 압축 체인(그룹대표 단독)은 두 단계 모두 같은 사람을 가리키고 compressedChain 이 켜진다', () => {
    const solo = { firstReviewerId: 'grp-1', firstReviewerName: '박대표' };
    const atPending = resolveWaitingOn(row(solo), NOW);
    const atRevised = resolveWaitingOn(
      row({ ...solo, status: MidtermReviewStatus.revised, memberSubmittedAt: days(1) }),
      NOW,
    );
    expect(atPending).toMatchObject({
      party: 'first_reviewer',
      waitingUserId: 'grp-1',
      compressedChain: true,
    });
    expect(atRevised).toMatchObject({
      party: 'final_reviewer',
      waitingUserId: 'grp-1',
      compressedChain: true,
    });
  });

  it('1차만 비어 있으면(2차는 있음) 개시된 건의 미배정 — 대기 상대만 비워 둔다', () => {
    const w = resolveWaitingOn(row({ firstReviewerId: null, firstReviewerName: null }), NOW);
    expect(w).toMatchObject({ party: 'first_reviewer', waitingUserId: null, waitingUserName: null });
    expect(w?.compressedChain).toBe(false);
  });

  it('되돌림(reopen) 직후의 revised 는 원래 제출 시각이 아니라 되돌린 시점부터 센다', () => {
    // reopen() 이 memberSubmittedAt 을 비우므로 updatedAt(= 되돌린 시각)으로 떨어진다.
    const w = resolveWaitingOn(
      row({
        status: MidtermReviewStatus.revised,
        memberSubmittedAt: null,
        createdAt: days(40),
        updatedAt: days(1),
      }),
      NOW,
    );
    expect(w).toMatchObject({ party: 'final_reviewer', waitingDays: 1 });
  });

  it('전이 시각이 비어 있으면 updatedAt 으로 떨어진다', () => {
    const w = resolveWaitingOn(
      row({ status: MidtermReviewStatus.commented, firstCommentedAt: null, updatedAt: days(6) }),
      NOW,
    );
    expect(w?.waitingDays).toBe(6);
  });

  it('미래 타임스탬프여도 경과일이 음수가 되지 않는다', () => {
    const w = resolveWaitingOn(row({ createdAt: new Date(NOW.getTime() + 60_000) }), NOW);
    expect(w?.waitingDays).toBe(0);
  });
});

/**
 * 레거시(총평-단독 저장)·미개시 행 — 상태는 pending 이지만 평가자 스냅샷이 없다.
 * open() 은 1차·2차를 언제나 함께 기록하므로 둘 다 null 인 pending 은 개시된 적이 없는 행이다.
 * 이런 행을 "1차 코멘트 대기"나 "평가자 미배정(재배정 필요)"으로 세면 HR 이 잘못된 조치를 한다.
 */
describe('미개시 행 판정(레거시 총평-단독 저장)', () => {
  const legacy = { firstReviewerId: null, firstReviewerName: null, finalReviewerId: null, finalReviewerName: null };

  it('평가자가 둘 다 없는 pending 은 미개시로 판정한다', () => {
    expect(isNotOpenedRow(row(legacy))).toBe(true);
  });

  it('평가자가 배정된 pending 은 미개시가 아니다', () => {
    expect(isNotOpenedRow(row())).toBe(false);
  });

  it('한쪽 평가자만 비어 있으면 미개시가 아니다(개시된 건의 재배정 대상)', () => {
    expect(isNotOpenedRow(row({ firstReviewerId: null, firstReviewerName: null }))).toBe(false);
    expect(isNotOpenedRow(row({ finalReviewerId: null, finalReviewerName: null }))).toBe(false);
  });

  it('pending 이 아닌 상태는 평가자가 없어도 미개시로 보지 않는다(레거시 자가점검 집계 몫)', () => {
    expect(isNotOpenedRow(row({ ...legacy, status: MidtermReviewStatus.self_done }))).toBe(false);
  });

  it('미개시 행은 대기 목록에 들어가지 않는다 — 1차 평가자를 기다리는 것이 아니다', () => {
    expect(resolveWaitingOn(row(legacy), NOW)).toBeNull();
  });

  it('미개시 행은 재배정 대상 목록이 아니라 별도 목록으로 나온다(경과일은 생성 시점 기준)', () => {
    const r = resolveNotOpened(row({ ...legacy, createdAt: days(12) }), NOW);
    expect(r).toMatchObject({
      reviewId: 'review-1',
      subjectId: 'member-1',
      subjectName: '김구성',
      departmentName: 'CS1팀',
      waitingDays: 12,
    });
    // 대기 상대(재촉 대상) 개념 자체가 없다 — 필요한 조치는 재배정이 아니라 개시다.
    expect(r).not.toHaveProperty('waitingUserId');
  });

  it('개시된 행은 미개시 목록에 들어가지 않는다', () => {
    expect(resolveNotOpened(row(), NOW)).toBeNull();
    expect(resolveNotOpened(row({ firstReviewerId: null, firstReviewerName: null }), NOW)).toBeNull();
  });
});

describe('groupWaitingByReviewer', () => {
  const waiting = (over: Partial<MidtermSummaryRow>) =>
    resolveWaitingOn(row(over), NOW) as MidtermWaitingRow;

  it('평가자별로 묶고 인원 많은 순 → 오래 묵은 순으로 정렬한다', () => {
    const groups = groupWaitingByReviewer([
      waiting({ id: 'r1', createdAt: days(1) }),
      waiting({ id: 'r2', createdAt: days(9) }),
      waiting({
        id: 'r3',
        firstReviewerId: 'div-2',
        firstReviewerName: '최본부',
        createdAt: days(2),
      }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ reviewerId: 'div-1', count: 2, maxWaitingDays: 9 });
    // 그룹 안은 오래 묵은 건이 먼저.
    expect(groups[0].rows.map((r) => r.reviewId)).toEqual(['r2', 'r1']);
    expect(groups[1]).toMatchObject({ reviewerId: 'div-2', count: 1 });
  });

  it('같은 사람이 1차·2차를 겸하면 자리(party)별로 나눠 묶는다 — 재촉 문구가 다르다', () => {
    const solo = { firstReviewerId: 'grp-1', firstReviewerName: '박대표' };
    const groups = groupWaitingByReviewer([
      waiting({ id: 'r1', ...solo }),
      waiting({
        id: 'r2',
        ...solo,
        status: MidtermReviewStatus.revised,
        memberSubmittedAt: days(2),
      }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.party).sort()).toEqual(['final_reviewer', 'first_reviewer']);
    expect(groups.every((g) => g.reviewerId === 'grp-1')).toBe(true);
  });

  it('본인 대기 건과 평가자 미배정 건은 묶지 않는다', () => {
    const groups = groupWaitingByReviewer([
      waiting({ id: 'r1', status: MidtermReviewStatus.commented, firstCommentedAt: days(1) }),
      waiting({ id: 'r2', firstReviewerId: null, firstReviewerName: null }),
    ]);
    expect(groups).toEqual([]);
  });
});
