/**
 * Keycloak 환경변수 — jwt.config.ts 와 같은 fail-fast 규약.
 * 기본값을 코드에 두지 않는다. 미설정이면 부팅 시 즉시 throw.
 */

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`환경변수 ${name} 가 설정되지 않았어요. SSO 를 시작할 수 없어요.`);
  }
  return value;
}

/** 토큰의 iss 클레임과 정확히 일치해야 하는 문자열(브라우저가 보는 주소). */
export function keycloakIssuer(): string {
  return requiredEnv('KEYCLOAK_ISSUER');
}

/** API 컨테이너가 실제로 접속할 JWKS 주소(Docker DNS). issuer 와 호스트가 다를 수 있다. */
export function keycloakJwksUri(): string {
  return requiredEnv('KEYCLOAK_JWKS_URI');
}

export function keycloakAudience(): string {
  return requiredEnv('KEYCLOAK_AUDIENCE');
}

export function keycloakAuthorizedParty(): string {
  return requiredEnv('KEYCLOAK_AZP');
}

/** 'sso' | 'password'. 롤백 스위치. 미설정 시 sso. */
export function authMode(): 'sso' | 'password' {
  return process.env.AUTH_MODE === 'password' ? 'password' : 'sso';
}

/** 부팅 시 SSO 설정 존재를 강제 검증(main.ts). password 모드면 건너뛴다. */
export function assertKeycloakConfig(): void {
  if (authMode() === 'password') return;
  keycloakIssuer();
  keycloakJwksUri();
  keycloakAudience();
  keycloakAuthorizedParty();
}
