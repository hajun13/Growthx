/**
 * dashboard feature — 데이터 계층.
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 * 컴포넌트엔 깔끔한 도메인 값만 넘긴다.
 */
import {
  dashboardControllerSummary,
  dashboardControllerCompanyAchievement,
  type DashboardSummaryDto,
  type CompanyAchievementDto,
} from '@growthx/contracts';

export type DashboardSummary = DashboardSummaryDto;
export type CompanyAchievement = CompanyAchievementDto;

// cycleId 미지정 시 백엔드가 최신 active 주기를 사용 → 빈 값은 쿼리에서 제외한다.
// (생성 params 타입은 cycleId: string 요구. 빈 문자열을 보내지 않도록 캐스팅.)
function cycleParams(cycleId: string | null | undefined) {
  return (cycleId ? { cycleId } : {}) as { cycleId: string };
}

export async function fetchDashboardSummary(
  cycleId: string | null | undefined,
): Promise<DashboardSummary> {
  const res = await dashboardControllerSummary(cycleParams(cycleId));
  return res.data.data;
}

export async function fetchCompanyAchievement(
  cycleId: string | null | undefined,
): Promise<CompanyAchievement> {
  const res = await dashboardControllerCompanyAchievement(cycleParams(cycleId));
  return res.data.data;
}
