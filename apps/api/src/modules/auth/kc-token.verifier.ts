import { UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import {
  keycloakAudience,
  keycloakAuthorizedParty,
  keycloakIssuer,
  keycloakJwksUri,
} from '../../common/config/keycloak.config';

/**
 * JWKS 는 createRemoteJWKSet 이 TTL 캐시 + 키 로테이션을 처리한다.
 * ⚠ 영구 캐시(lru_cache(maxsize=1) 류)를 직접 만들지 않는다 —
 *    Keycloak 이 서명 키를 로테이션하면 전 사용자 인증이 한번에 죽는다.
 * lazy singleton: 모듈 import 시점에 env 를 읽으면 password 모드에서 부팅이 깨진다.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(keycloakJwksUri()), {
      cacheMaxAge: 10 * 60 * 1000, // 10분
      cooldownDuration: 30 * 1000,
    });
  }
  return jwks;
}

/** 테스트/재설정용. */
export function resetJwksCache(): void {
  jwks = null;
}

export interface KcIdentity {
  sub: string;
  email: string;
  /** email_verified 클레임. true 가 아니면(누락 포함) 전부 false 로 강제한다. */
  emailVerified: boolean;
}

function reject(message: string): never {
  throw new UnauthorizedException({ code: 'UNAUTHORIZED', message });
}

/**
 * Keycloak access token 을 검증하고 신원만 뽑는다.
 * realm role 은 읽지 않는다 — 인가는 전적으로 GrowthX 가 결정한다.
 */
export async function verifyKeycloakToken(token: string): Promise<KcIdentity> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, getJwks(), {
      issuer: keycloakIssuer(),
      audience: keycloakAudience(),
      algorithms: ['RS256'],
    }));
  } catch {
    reject('SSO 토큰이 유효하지 않아요.');
  }

  // azp: 이 토큰이 growthx-web 클라이언트에게 발급된 것인지.
  // 없으면 다른 클라이언트(예: hr-system)의 토큰을 재사용하는 경로가 열린다.
  if (payload.azp !== keycloakAuthorizedParty()) {
    reject('허용되지 않은 클라이언트의 토큰이에요.');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    reject('토큰에 sub 클레임이 없어요.');
  }
  if (typeof payload.email !== 'string' || payload.email.length === 0) {
    reject('토큰에 email 클레임이 없어요. Keycloak 클라이언트 스코프를 확인하세요.');
  }

  // email_verified: TOFU 이메일 바인딩(sso-binding.ts)의 신뢰 근거로 쓰인다.
  // Keycloak 기본 `email` 클라이언트 스코프가 email_verified 를 access token 에 매핑한다
  // (기본 제공 매퍼 — 커스텀 스코프 구성에서 빠뜨리면 신규 바인딩이 전부 거부되니 유지할 것).
  // true 이외의 값(누락·문자열 "true" 포함)은 전부 false 로 강제한다.
  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
  };
}
