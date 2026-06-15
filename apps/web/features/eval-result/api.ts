/**
 * eval-result feature — 데이터 계층(평가결과 목록·상세·집계).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 */
import {
  resultsControllerList,
  resultsControllerGetDetail,
  resultsControllerAggregate,
  type EvaluationResultDto,
} from '@growthx/contracts';

export type EvaluationResult = EvaluationResultDto;

/** GET /results?cycleId=&userId= — 평가결과 목록(미집계 포함). */
export async function fetchResults(params: {
  cycleId?: string;
  userId?: string;
}): Promise<EvaluationResult[]> {
  const res = await resultsControllerList({
    cycleId: params.cycleId,
    userId: params.userId,
  });
  return res.data.data ?? [];
}

/** GET /results/:userId?cycleId= — self/d1/d2 유형별 비교 상세. */
export async function fetchResultDetail(userId: string, cycleId: string) {
  const res = await resultsControllerGetDetail(userId, { cycleId });
  return res.data.data;
}

/** POST /results/aggregate — 재집계 커맨드(201 본문 없음 가능). */
export async function aggregateResult(body: {
  cycleId: string;
  userId: string;
}) {
  const res = await resultsControllerAggregate(body);
  // 200 봉투는 {data}, 201은 본문 없음(void) → 둘 다 안전하게 처리.
  return res.status === 200 ? res.data.data : undefined;
}
