/**
 * admin-compensation feature — 데이터 계층(보상 현황).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data 가 HTTP 본문(봉투).
 * 팀 시뮬레이션은 본문이 { data: [...], meta } 이므로 실제 행은 res.data.data.
 */
import {
  compensationsControllerSimulationTeam,
  type CompensationSimulationDto,
} from '@growthx/contracts';

export type CompensationSimulation = CompensationSimulationDto;

/** 팀 전체 보상 시뮬레이션(관리자) 행 목록. */
export async function fetchTeamCompensationSimulation(
  cycleId: string,
  departmentId?: string,
): Promise<CompensationSimulation[]> {
  const res = await compensationsControllerSimulationTeam({
    cycleId,
    departmentId,
  });
  return res.data.data ?? [];
}
