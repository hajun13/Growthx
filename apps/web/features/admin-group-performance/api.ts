/**
 * admin-group-performance feature — 데이터 계층(그룹 실적 부분만).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 *
 * 비고: 등급풀(useGradePools)·등급분포(useGradeDistribution)·그룹목록(useDepartments) 등
 * 보조 데이터는 기존 훅 유지(주 데이터=그룹 실적만 생성 클라이언트로 이관, reports-summary 패턴).
 */
import {
  groupPerformanceControllerList,
  groupPerformanceControllerUpsert,
  type GroupPerformanceDto,
  type UpsertGroupPerformanceDto,
} from '@growthx/contracts';

export type GroupPerformance = GroupPerformanceDto;

/** 그룹 실적 목록 조회. cycleId·groupId 로 단일 그룹 실적을 거른다. */
export async function fetchGroupPerformance(params: {
  cycleId?: string;
  groupId?: string;
}): Promise<GroupPerformance[]> {
  const res = await groupPerformanceControllerList({
    cycleId: params.cycleId,
    groupId: params.groupId,
  });
  return res.data.data ?? [];
}

/** 그룹 실적 upsert(tier 는 백엔드가 달성률로 자동 분류). */
export async function upsertGroupPerformance(
  body: UpsertGroupPerformanceDto,
): Promise<void> {
  await groupPerformanceControllerUpsert(body);
}
