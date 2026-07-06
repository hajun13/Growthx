/**
 * JWT 시크릿 — 환경변수에서만 읽는다(코드에 기본값을 두지 않는다).
 *
 * ⚠ 이전엔 `process.env.JWT_SECRET ?? 'change-me-in-production'` 처럼 소스에 공개된
 *    기본값이 있었다. 이 문자열은 코드로 공개돼 있으므로, 환경변수가 비면 누구나
 *    `{ role: 'hr_admin' }` 페이로드로 토큰을 위조해 관리자 권한을 탈취할 수 있었다.
 *    이제 미설정 시 즉시 throw 해 그런 조용한 구동을 차단한다(fail-fast).
 */

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `환경변수 ${name} 가 설정되지 않았어요. JWT 시크릿은 필수라서 서버를 시작할 수 없어요.`,
    );
  }
  return value;
}

export function jwtAccessSecret(): string {
  return requiredEnv('JWT_SECRET');
}

export function jwtRefreshSecret(): string {
  return requiredEnv('JWT_REFRESH_SECRET');
}

export function jwtAccessExpiresIn(): string {
  // 만료는 보안 파라미터가 아니라 폴백 허용(기본 1h).
  return process.env.JWT_ACCESS_EXPIRES_IN ?? '3600s';
}

export function jwtRefreshExpiresIn(): string {
  return process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
}

/** 부팅 시 시크릿 존재를 강제 검증(main.ts 에서 호출). 미설정이면 여기서 즉시 실패. */
export function assertJwtSecrets(): void {
  jwtAccessSecret();
  jwtRefreshSecret();
}
