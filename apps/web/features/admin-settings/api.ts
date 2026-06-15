/**
 * admin-settings feature — 데이터 계층(개인 설정: 내 정보 + 비밀번호 변경).
 * @growthx/contracts 생성 클라이언트(타입 안전)를 호출하고 봉투를 여기서 한 번 unwrap 한다.
 * orval fetch 클라이언트는 { data: <봉투>, status, headers } 를 반환 → res.data.data 가 실제 값.
 *
 * ⚠ 세션 경계: 비밀번호 변경은 성공 시 토큰을 회전(setSession)해야 한다 — 이 회전은
 * useAuth(AuthProvider)가 소유하는 불가침 경계라 여기서 건드리지 않는다.
 * 따라서 데이터 소스(내 정보 조회)만 생성 클라이언트로 이관하고, 변경 커맨드는 hooks 에서
 * useAuth().changePassword 로 위임한다.
 */
import { authControllerMe, type UserDto } from '@growthx/contracts';

export type MeUser = UserDto;

/** 현재 로그인 사용자 조회(/auth/me). 봉투 unwrap(res.data.data). */
export async function fetchMe(): Promise<MeUser> {
  const res = await authControllerMe();
  return res.data.data;
}
