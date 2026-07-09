// Keycloak OIDC (Authorization Code + PKCE S256).
// 브라우저는 Keycloak 에서 access_token 을 받아 POST /auth/sso 로 넘길 뿐,
// 그 토큰을 저장하지 않는다. 세션 토큰은 GrowthX 가 발급한 것만 쓴다.

import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

const authority = process.env.NEXT_PUBLIC_KEYCLOAK_AUTHORITY ?? '';
const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? '';
// Keycloak IdP 별칭. 지정 시 로그인 버튼이 Keycloak 자체 폼을 건너뛰고 곧장 해당
// IdP(=Microsoft/Azure AD)로 이동한다. 빈 값이면 Keycloak 기본 로그인 화면 노출.
const idpHint = process.env.NEXT_PUBLIC_KEYCLOAK_IDP_HINT ?? 'microsoft';

export function isSsoMode(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE !== 'password';
}

let manager: UserManager | null = null;

function getManager(): UserManager {
  if (!manager) {
    if (!authority || !clientId) {
      throw new Error('NEXT_PUBLIC_KEYCLOAK_AUTHORITY / _CLIENT_ID 가 설정되지 않았어요.');
    }
    manager = new UserManager({
      authority,
      client_id: clientId,
      redirect_uri: `${window.location.origin}/login/callback`,
      post_logout_redirect_uri: `${window.location.origin}/login`,
      response_type: 'code',
      scope: 'openid profile email',
      // 인가 코드 교환 상태는 sessionStorage 에 둔다(탭 종료 시 소멸).
      stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
      // GrowthX 가 자체 세션을 갖는다. Keycloak 토큰은 1회용이므로 갱신하지 않는다.
      automaticSilentRenew: false,
      monitorSession: false,
    });
  }
  return manager;
}

/** Keycloak 로그인 페이지로 이동(idpHint 있으면 곧장 Microsoft 로). */
export async function startSsoLogin(): Promise<void> {
  await getManager().signinRedirect(
    idpHint ? { extraQueryParams: { kc_idp_hint: idpHint } } : undefined,
  );
}

/** 콜백에서 code 를 교환해 Keycloak access_token 을 얻는다. */
export async function completeSsoLogin(): Promise<string> {
  const user = await getManager().signinRedirectCallback();
  if (!user.access_token) throw new Error('Keycloak 이 access_token 을 주지 않았어요.');
  // 로컬 OIDC 상태는 즉시 폐기 — GrowthX JWT 만 남긴다.
  await getManager().removeUser();
  return user.access_token;
}

/** Keycloak 세션까지 종료. GrowthX 로컬 세션 정리는 호출측에서 먼저 한다. */
export async function ssoLogout(): Promise<void> {
  if (!isSsoMode()) return;
  await getManager().signoutRedirect();
}
