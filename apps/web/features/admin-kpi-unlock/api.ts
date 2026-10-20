/**
 * admin-kpi-unlock feature — 데이터 계층(KPI 확정 해제, hr_admin).
 * @growthx/contracts 생성 클라이언트를 호출하고 봉투(res.data.data)를 여기서 한 번 unwrap 한다.
 */
import {
  kpisControllerUnlock,
  kpisControllerUnlockCandidates,
  type KpiUnlockItemDto,
  type KpiUnlockOverviewDto,
  type KpiUnlockResultDto,
  type KpiUnlockUserDto,
} from '@growthx/contracts';

export type UnlockOverview = KpiUnlockOverviewDto;
export type UnlockUser = KpiUnlockUserDto;
export type UnlockKpi = KpiUnlockItemDto;

/** 주기의 확정 KPI(구성원별) + 주기 상태·KPI 작성 잠금 여부. */
export async function fetchUnlockOverview(cycleId: string): Promise<UnlockOverview> {
  const res = await kpisControllerUnlockCandidates({ cycleId });
  return res.data.data;
}

/** 선택한 확정 KPI 일괄 확정 해제 → 작성중(draft). */
export async function unlockKpis(kpiIds: string[], reason: string): Promise<KpiUnlockResultDto> {
  const res = await kpisControllerUnlock({ kpiIds, reason });
  // 봉투 unwrap — 성공 응답은 { data: KpiUnlockResultDto }(POST 201 분기는 생성 타입상 void).
  return (res.data as { data: KpiUnlockResultDto }).data;
}
