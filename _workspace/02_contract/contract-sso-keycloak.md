# 계약: Keycloak SSO 인증 통합 (Phase 2-A)

> **이 계약의 SSOT는 이 파일이 아니다.**
>
> 설계 원본: `EX-DB-API/docs/superpowers/specs/2026-07-08-growthx-keycloak-sso-design.md`
>
> 플랫폼(EX-DB-API)이 인증 계약의 소유자이며, GrowthX는 소비자다.
> (`read.md` — *"앱 → 플랫폼 단방향 의존"*)
>
> 계약 변경은 원본에서 하고, 이 파일은 GrowthX 측 영향 범위만 요약한다.

---

## 한 줄 요약

GrowthX 로그인을 자체 JWT + bcrypt에서 **Keycloak SSO(Azure AD)** 로 전환한다.
자체 JWT 발급은 **유지**한다 — Keycloak은 신원 증명기로만 쓴다.

- 인증(누구인가): Keycloak → `sub`, `email`
- 인가(무엇을 할 수 있나): GrowthX → `role`, `visibilityScope`, `departmentId`, `PermissionConfig`

**GrowthX는 EX-DB-API(FastAPI)를 호출하지 않는다.** 이 단계에서 필요한 것은 Keycloak뿐이다.
`org.users`는 여전히 GrowthX의 SSOT다.

---

## GrowthX 측 변경 범위

### 추가

| 대상 | 내용 |
|---|---|
| `prisma/schema.prisma` | `User.azureAdSubject` (unique, nullable), `User.allowPasswordLogin` (default false), `UserEmailAlias` 모델 |
| `modules/auth/auth.service.ts` | `ssoLogin(kcAccessToken)` |
| `modules/auth/auth.controller.ts` | `POST /auth/sso` (@Public) |
| `prisma/preflight-sso-match.ts` | 배포 전 게이트 스크립트 |
| `prisma/set-break-glass-password.ts` | 비상구 계정 비밀번호 설정 |
| `apps/web/app/(auth)/login/callback/page.tsx` | PKCE code 교환 |
| 의존성 | `oidc-client-ts` |

### 수정

- `auth.service.login()` — `allowPasswordLogin` 게이트 추가 (break-glass 전용화)
- `app/(auth)/login/page.tsx` — `AUTH_MODE`에 따라 SSO 버튼 / 기존 폼
- `hooks/useAuth.tsx` — 로그아웃 시 Keycloak end-session 호출

### 무변경 (중요)

`lib/api.ts`, `lib/auth.ts`, `common/guards/jwt-auth.guard.ts`, `common/guards/roles.guard.ts`,
`common/guards/feature.guard.ts`, `common/access/access.util.ts`, orval mutator, `ApiClientInit.tsx`

자체 JWT를 유지하기 때문에 refresh single-flight·행수준 인가·권한 매트릭스가 전부 그대로다.

### 3단계에서 삭제 (안정화 후)

`mustChangePassword`(소스 17개 파일 + 컬럼), `force-password-change.guard.ts`,
`allow-password-change.ts`, `PasswordChangeGate.tsx`, `app/onboarding/password/`,
`POST /auth/change-password`, `AuthService.changePassword()`

`bcryptjs` / `passwordHash` / `login()`은 **유지** — break-glass와 E2E(`e2e/.auth/state.json`)가 쓴다.

---

## 배포 게이트

```
pnpm tsx apps/api/prisma/preflight-sso-match.ts azure-users.csv
```

`missing`이 0이 아니면 **배포하지 않는다.**

현재 알려진 `alias-needed` 1건:

| org.users.email | Azure AD 추정 UPN | 비고 |
|---|---|---|
| `spark@energyx.ai` | `spark@energyx.co.kr` | 박성현 대표이사, `hr_admin`. 시드 117명 중 유일한 `.ai` 도메인 |

해소: `user_email_aliases`에 `('spark@energyx.co.kr', <user.id>)` 삽입.

---

## 롤백

`AUTH_MODE=password` + 이전 이미지 재배포. 스키마 변경은 전부 가산적이라 DB 되돌리기 없음.
단 3단계(컬럼 drop) 이후에는 이 롤백이 불가능하다.

---

## 전제조건 (EX-DB-API 0단계)

GrowthX 배포 전에 플랫폼 쪽에서 끝나야 한다:

1. Keycloak `start-dev`(H2) → `start --db postgres` — **`sub` 영속성**
2. `growthx-web` 공개 클라이언트 신설 (PKCE S256, audience mapper → `growthx-api`)
3. Azure AD client secret 실제 값 주입 (현재 `AZURE_CLIENT_ID_HERE` 플레이스홀더)
4. TLS
5. `KC_HOSTNAME` 고정

**1번이 특히 중요하다.** H2가 날아가면 Keycloak `sub`가 전부 재발급되고,
GrowthX에 저장된 `azureAdSubject`가 고아가 되어 전원 로그인 실패(`409 SSO_SUBJECT_CONFLICT`)한다.
