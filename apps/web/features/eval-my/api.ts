/**
 * eval-my feature — 데이터 계층(내 평가표 / 결과 상세).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 *
 * 결과 상세는 캘리브레이션 완료 후에만 공개되므로 미공개 시 404(ApiError)가 throw 된다.
 * 에러는 그대로 위로 올려 View 가 404=미공개 / 403=권한없음을 구분하도록 둔다.
 */
import {
  resultsControllerGetDetail,
  type EvaluationResultDto,
} from '@growthx/contracts';
import type { EvaluationResultDetail } from '@/lib/types';

/**
 * GET /results/:userId?cycleId= — self/d1/d2/d3 유형별 비교 상세.
 * 런타임 shape 은 로컬 EvaluationResultDetail 과 동일(같은 엔드포인트) — byType 판별 유니온·ByTypeEntry 등
 * 기존 화면 로직이 의존하는 풍부한 타입을 유지하기 위해 생성 DTO 를 로컬 상세 타입으로 좁혀 반환한다.
 */
export async function fetchResultDetail(
  userId: string,
  cycleId: string,
): Promise<EvaluationResultDetail> {
  const res = await resultsControllerGetDetail(userId, { cycleId });
  return (res.data.data as EvaluationResultDto) as unknown as EvaluationResultDetail;
}
