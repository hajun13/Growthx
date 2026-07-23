import { MidtermReviewStatus } from '@prisma/client';

/**
 * 중간점검 진행 현황(설계 §7.5)의 판정 로직 — Prisma 없이 테스트할 수 있는 순수 함수만 모은다.
 * 서비스(midterm-summary.service.ts)는 조회·조립만 하고, "누구를 기다리는가"는 전부 여기서 정한다.
 *
 * 흐름: pending →(1차 코멘트) commented →(본인 수정) revised →(2차 판정) closed | returned →(재수정) revised.
 * 그래서 기다림의 주체는 상태로 결정된다 — pending=1차 평가자, commented·returned=본인,
 * revised=2차 검토자, closed=없음(마감).
 *
 * 단, pending 은 상태만으로 판정하면 안 된다 — 공존 중인 레거시 서비스(MidtermReviewsService)가
 * 총평-단독 저장 때 평가자 없이 pending 행을 만들기 때문이다. 판정 기준은 평가자 스냅샷의
 * 유무다(isNotOpenedRow 주석 참고).
 */

/** 지금 이 건이 누구의 처리를 기다리고 있는지. */
export type MidtermWaitingParty = 'first_reviewer' | 'member' | 'final_reviewer';

/** 순수 함수 입력 — Prisma select 결과를 평평하게 옮긴 형태. */
export interface MidtermSummaryRow {
  id: string;
  status: MidtermReviewStatus;
  createdAt: Date;
  updatedAt: Date;
  firstCommentedAt: Date | null;
  memberSubmittedAt: Date | null;
  decidedAt: Date | null;
  evaluateeId: string;
  evaluateeName: string;
  departmentName: string | null;
  firstReviewerId: string | null;
  firstReviewerName: string | null;
  finalReviewerId: string | null;
  finalReviewerName: string | null;
}

/** 미완료 1건 — HR 이 바로 행동할 수 있게 대상·대기 상대·경과일까지 담는다. */
export interface MidtermWaitingRow {
  reviewId: string;
  status: MidtermReviewStatus;
  party: MidtermWaitingParty;
  /** 기다리는 상대(평가자 미배정이면 null — 재배정이 필요한 이상 상황). */
  waitingUserId: string | null;
  waitingUserName: string | null;
  subjectId: string;
  subjectName: string;
  departmentName: string | null;
  /** 이 상태로 들어온 시각(ISO) — "언제부터 멈춰 있는지"의 기준. */
  since: string;
  waitingDays: number;
  /** 1차·2차가 같은 사람인 압축 체인(그룹대표 단독) — 재촉 대상이 겹친다는 표시. */
  compressedChain: boolean;
}

/** 상태별 대기 주체. 여기 없는 상태(closed·레거시 자가점검)는 대기 대상이 아니다. */
const WAITING_PARTY: Partial<Record<MidtermReviewStatus, MidtermWaitingParty>> = {
  [MidtermReviewStatus.pending]: 'first_reviewer',
  [MidtermReviewStatus.commented]: 'member',
  [MidtermReviewStatus.returned]: 'member',
  [MidtermReviewStatus.revised]: 'final_reviewer',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "아직 개시되지 않은 행" 판정 — 레거시(총평-단독 저장)이거나 이번 개시 대상에서 빠진 행.
 *
 * 상태(pending)만 보면 안 되는 이유: 공존 중인 레거시 MidtermReviewsService 는 구성원이
 * 총평만 저장할 때 **평가자 없이** pending 행을 만든다. 반대로 신규 흐름의 open() 은 1차·2차
 * 평가자를 언제나 함께 기록하므로(둘 중 하나만 비는 경우가 없다), pending 인데 둘 다 비어
 * 있으면 신규 흐름으로 개시된 적이 없는 행이다.
 *
 * 이 구분이 중요한 이유: 이런 행을 "1차 코멘트 대기"나 "평가자 미배정(재배정 필요)"으로
 * 세면 HR 이 실제로는 아무도 기다리지 않는 건을 재촉하거나, 재배정을 돌려도 사라지지 않는
 * 경고를 계속 보게 된다(재배정은 개시된 행의 평가자만 바꾼다).
 */
export function isNotOpenedRow(row: MidtermSummaryRow): boolean {
  return (
    row.status === MidtermReviewStatus.pending &&
    row.firstReviewerId === null &&
    row.finalReviewerId === null
  );
}

/**
 * 이 상태로 들어온 시각. 전이 시각 컬럼을 우선 쓰고, 없으면 updatedAt 으로 떨어진다
 * (되돌림·재개시로 전이 컬럼이 비워진 행은 여기로 떨어져 "되돌린 시점"부터 세게 된다).
 */
function statusSince(row: MidtermSummaryRow): Date {
  switch (row.status) {
    case MidtermReviewStatus.pending:
      // createdAt 이 아니라 updatedAt 기준이다. 재개시(open 의 upsert update 브랜치)가 행을
      // 다시 pending 으로 되돌리면 createdAt 은 예전 개시(또는 레거시 초안 생성) 시각이라
      // 경과일이 몇 주씩 부풀려진다. 갓 만들어진 행은 updatedAt === createdAt 이라 동일하다.
      return row.updatedAt;
    case MidtermReviewStatus.commented:
      return row.firstCommentedAt ?? row.updatedAt;
    case MidtermReviewStatus.revised:
      return row.memberSubmittedAt ?? row.updatedAt;
    case MidtermReviewStatus.returned:
      return row.decidedAt ?? row.updatedAt;
    default:
      return row.updatedAt;
  }
}

/**
 * 한 건이 누구를 기다리는지 판정. 마감(closed)·레거시 자가점검 상태는 null.
 * 1차·2차가 같은 사람(그룹대표 단독 폴백)이어도 상태가 대기 주체를 정하므로 판정은 동일하다 —
 * 다만 compressedChain 으로 "같은 사람이 양쪽 자리를 겸한다"는 사실을 함께 알린다.
 */
export function resolveWaitingOn(
  row: MidtermSummaryRow,
  now: Date = new Date(),
): MidtermWaitingRow | null {
  // 개시된 적 없는 행은 아무의 차례도 아니다 — resolveNotOpened 가 따로 담는다.
  if (isNotOpenedRow(row)) return null;
  const party = WAITING_PARTY[row.status];
  if (!party) return null;

  const waiting =
    party === 'first_reviewer'
      ? { id: row.firstReviewerId, name: row.firstReviewerName }
      : party === 'final_reviewer'
        ? { id: row.finalReviewerId, name: row.finalReviewerName }
        : { id: row.evaluateeId, name: row.evaluateeName };

  const since = statusSince(row);
  return {
    reviewId: row.id,
    status: row.status,
    party,
    waitingUserId: waiting.id,
    waitingUserName: waiting.id ? waiting.name : null,
    subjectId: row.evaluateeId,
    subjectName: row.evaluateeName,
    departmentName: row.departmentName,
    since: since.toISOString(),
    // 음수(미래 타임스탬프)는 표시상 의미가 없으므로 0으로 눌러 둔다.
    waitingDays: Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS)),
    compressedChain:
      !!row.firstReviewerId && row.firstReviewerId === row.finalReviewerId,
  };
}

/**
 * 개시되지 않은 채 남아 있는 1건 — 재촉·재배정 대상이 아니라 "개시" 대상이라 형태를 나눈다
 * (대기 상대가 없으므로 waitingUserId 같은 필드가 의미를 갖지 못한다).
 */
export interface MidtermNotOpenedRow {
  reviewId: string;
  subjectId: string;
  subjectName: string;
  departmentName: string | null;
  /** 이 행이 만들어진 시각(ISO) — 레거시 총평 저장 시점이거나 이전 주기 개시 시점. */
  since: string;
  waitingDays: number;
}

/** 개시되지 않은 행만 골라 표시용 형태로. 그 외에는 null. */
export function resolveNotOpened(
  row: MidtermSummaryRow,
  now: Date = new Date(),
): MidtermNotOpenedRow | null {
  if (!isNotOpenedRow(row)) return null;
  // 여기서는 createdAt 을 쓴다 — 개시되지 않은 행에는 "이 상태로 들어온 전이"가 없고,
  // 궁금한 것은 "이 잔재가 언제부터 남아 있는가"이기 때문이다.
  const since = row.createdAt;
  return {
    reviewId: row.id,
    subjectId: row.evaluateeId,
    subjectName: row.evaluateeName,
    departmentName: row.departmentName,
    since: since.toISOString(),
    waitingDays: Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS)),
  };
}

/** 평가자 1명 단위 묶음 — HR 의 실제 질문은 "누구에게, 몇 명 분을 재촉하나". */
export interface MidtermWaitingGroup {
  reviewerId: string;
  reviewerName: string | null;
  party: Exclude<MidtermWaitingParty, 'member'>;
  count: number;
  maxWaitingDays: number;
  rows: MidtermWaitingRow[];
}

/**
 * 평가자를 기다리는 건들만 그 평가자 기준으로 묶는다(본인 대기 건은 묶을 필요가 없다 —
 * 재촉 대상이 곧 대상자 본인이라 1인 1건이다). 평가자 미배정 건은 묶을 키가 없으므로 제외 —
 * 서비스가 별도 목록으로 드러낸다.
 * 정렬: 인원 많은 순 → 오래 묵은 순, 그룹 안은 오래 묵은 순.
 */
export function groupWaitingByReviewer(rows: MidtermWaitingRow[]): MidtermWaitingGroup[] {
  const groups = new Map<string, MidtermWaitingGroup>();
  for (const row of rows) {
    if (row.party === 'member' || !row.waitingUserId) continue;
    // 같은 사람이 1차·2차를 겸해도 재촉 문구가 달라지므로 자리(party)까지 키에 넣는다.
    const key = `${row.waitingUserId}:${row.party}`;
    const found = groups.get(key);
    if (found) {
      found.count += 1;
      found.maxWaitingDays = Math.max(found.maxWaitingDays, row.waitingDays);
      found.rows.push(row);
      continue;
    }
    groups.set(key, {
      reviewerId: row.waitingUserId,
      reviewerName: row.waitingUserName,
      party: row.party,
      count: 1,
      maxWaitingDays: row.waitingDays,
      rows: [row],
    });
  }
  const list = Array.from(groups.values());
  for (const g of list) g.rows.sort((a, b) => b.waitingDays - a.waitingDays);
  return list.sort((a, b) => b.count - a.count || b.maxWaitingDays - a.maxWaitingDays);
}
