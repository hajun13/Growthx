/**
 * eval-midterm feature — HR 진행 현황 집계(설계 §7.5) 전용 데이터 계층.
 * 같은 feature 의 api.ts 와 규약(생성 클라이언트 호출 → 봉투 1회 unwrap → ApiError 변환)은
 * 동일하지만, 진행 현황은 HR 운영 화면 하나만 쓰는 읽기 전용 집계라 파일을 분리해 둔다.
 *
 * 백엔드가 느슨한 봉투(object)로 발행하므로(개시·재배정 응답과 동일) 형태는 여기서 좁힌다 —
 * 아래 인터페이스가 apps/api/src/modules/midterm/midterm-summary.service.ts 반환과 1:1 이다.
 */
import {
  midtermControllerGetSummary,
  ApiError as ContractsApiError,
} from '@growthx/contracts';
import { ApiError } from '@/lib/api';

/** 지금 이 건이 누구의 처리를 기다리는지(백엔드 MidtermWaitingParty 와 동일). */
export type MidtermWaitingParty = 'first_reviewer' | 'member' | 'final_reviewer';

export interface MidtermWaitingRow {
  reviewId: string;
  status: string;
  party: MidtermWaitingParty;
  /** 평가자 미배정이면 null — 재촉이 아니라 재배정이 필요한 건. */
  waitingUserId: string | null;
  waitingUserName: string | null;
  subjectId: string;
  subjectName: string;
  departmentName: string | null;
  since: string;
  waitingDays: number;
  /** 1차·2차가 같은 사람(그룹대표 단독 폴백). */
  compressedChain: boolean;
}

export interface MidtermWaitingGroup {
  reviewerId: string;
  reviewerName: string | null;
  party: Exclude<MidtermWaitingParty, 'member'>;
  count: number;
  maxWaitingDays: number;
  rows: MidtermWaitingRow[];
}

export interface MidtermStageCounts {
  pending: number;
  commented: number;
  revised: number;
  returned: number;
  closed: number;
  /** 이전 방식(자가점검) 행 — 신규 흐름 수치와 섞지 않는다. */
  legacy: number;
  unfinished: number;
  total: number;
}

export interface MidtermSummary {
  cycleId: string;
  cycleName: string;
  cycleStatus: string;
  counts: MidtermStageCounts;
  waitingOnReviewer: MidtermWaitingGroup[];
  waitingOnMember: MidtermWaitingRow[];
  unassigned: MidtermWaitingRow[];
}

/**
 * 생성 클라이언트는 contracts runtime 의 ApiError 를 던진다. 화면은 `@/lib/api` 의 ApiError 로
 * instanceof·code 분기를 하므로(별개 클래스라 instanceof 가 어긋난다) 경계에서 변환한다 —
 * api.ts 의 translateErrors 와 같은 규약.
 */
async function translateErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ContractsApiError) {
      throw new ApiError(e.status, {
        code: e.code,
        message: e.message,
        details: e.details,
      });
    }
    throw e;
  }
}

/** 주기 1개의 중간점검 진행 현황(HR 전용). */
export async function fetchMidtermSummary(cycleId: string): Promise<MidtermSummary> {
  return translateErrors(async () => {
    const res = await midtermControllerGetSummary({ cycleId } as never);
    return res.data.data as unknown as MidtermSummary;
  });
}
