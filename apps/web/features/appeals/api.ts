/**
 * appeals feature — 데이터 계층.
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 * 컴포넌트엔 깔끔한 도메인 값만 넘긴다.
 */
import {
  appealsControllerList,
  appealsControllerCreate,
  appealsControllerRespond,
  appealsControllerDecide,
  type AppealDto,
  type AppealStatus,
} from '@growthx/contracts';

export type Appeal = AppealDto;
export type { AppealStatus };

/** 이의제기 목록. userId 미지정 시 권한 범위 전체. */
export async function fetchAppeals(userId?: string): Promise<Appeal[]> {
  const res = await appealsControllerList(userId ? { userId } : undefined);
  return res.data.data ?? [];
}

/** 결과 통보 후 7일 이내만 접수. */
export async function createAppeal(body: {
  resultId: string;
  reason: string;
}): Promise<void> {
  await appealsControllerCreate(body);
}

/** 부서장 1차 답변. */
export async function respondAppeal(
  id: string,
  response: string,
): Promise<void> {
  await appealsControllerRespond(id, { response });
}

/** HR 최종 결정. */
export async function decideAppeal(
  id: string,
  decision: string,
): Promise<void> {
  await appealsControllerDecide(id, { decision });
}
