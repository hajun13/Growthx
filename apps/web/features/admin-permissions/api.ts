/**
 * admin-permissions feature — 데이터 계층.
 * @growthx/contracts 생성 클라이언트(permissionsController*)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 *
 * 생성된 PermissionConfigDto.matrix/navVisibility 는 느슨한 Record<string, unknown> 이므로,
 * 앱의 SSOT 타입(@/lib/permConfig 의 MatrixConfig/NavConfig)으로 머지·정규화해 컴포넌트엔 강타입만 넘긴다.
 * 서버가 부분/구버전 row 를 줄 수 있어 DEFAULT_* 위에 머지(mergeMatrix/mergeNav)한다 — 무회귀.
 */
import {
  permissionsControllerGetConfig,
  permissionsControllerUpdateConfig,
} from '@growthx/contracts';
import {
  mergeMatrix,
  mergeNav,
  type MatrixConfig,
  type NavConfig,
  type PermissionsConfig,
} from '@/lib/permConfig';

// GET /permissions/config — 봉투 unwrap 후 DEFAULT_* 위에 머지해 반환.
export async function fetchPermissionsConfig(): Promise<PermissionsConfig> {
  const res = await permissionsControllerGetConfig();
  const cfg = res.data.data;
  return {
    matrix: mergeMatrix(cfg?.matrix),
    navVisibility: mergeNav(cfg?.navVisibility),
  };
}

// PUT /permissions/config — 전체 매트릭스+nav 저장(hr_admin + 권한 부여·수정). 결과(서버 정규화값)를 머지해 반환.
export async function savePermissionsConfig(
  config: PermissionsConfig,
): Promise<PermissionsConfig> {
  const res = await permissionsControllerUpdateConfig({
    matrix: config.matrix as unknown as Record<string, unknown>,
    navVisibility: config.navVisibility as unknown as Record<string, unknown>,
  });
  const saved = res.data.data;
  return {
    matrix: mergeMatrix(saved?.matrix ?? config.matrix),
    navVisibility: mergeNav(saved?.navVisibility ?? config.navVisibility),
  };
}

export type { MatrixConfig, NavConfig, PermissionsConfig };
