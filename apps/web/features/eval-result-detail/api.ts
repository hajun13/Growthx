/**
 * eval-result-detail feature — 데이터 계층(평가 상세결과 /eval/result/[userId]).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 *
 * 런타임 shape 은 기존 lib/types EvaluationResultDetail 과 동일(같은 백엔드 응답)이므로,
 * 페이지의 기존 헬퍼(toRows·toFlow·toImportRows·isImportByType)를 변경 없이 쓰기 위해
 * 도메인 별칭 타입으로 좁혀서 반환한다.
 */
import {
  resultsControllerGetDetail,
  type EvaluationResultDto,
} from '@growthx/contracts';
import type { EvaluationResultDetail } from '@/lib/types';

export type { EvaluationResultDetail } from '@/lib/types';

/** GET /results/:userId?cycleId= — 다단계(self/d1/d2/d3 또는 import 라운드) 비교 상세. */
export async function fetchResultDetail(
  userId: string,
  cycleId: string,
): Promise<EvaluationResultDetail> {
  const res = await resultsControllerGetDetail(userId, { cycleId });
  // 봉투 unwrap: res.data = HTTP 본문({data}), 실제 값은 res.data.data.
  const dto: EvaluationResultDto = res.data.data;
  // 런타임 동일 shape — 기존 도메인 타입으로 좁혀 헬퍼 호환 유지.
  return dto as unknown as EvaluationResultDetail;
}
