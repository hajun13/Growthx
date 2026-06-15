# admin-settings feature

개인 설정 화면(`/admin/settings`)의 수직 슬라이스 — notifications 표준 패턴(architecture.md §5) 복제.

- **책임:** 본인 알림 수신 설정(localStorage) + 계정 비밀번호 변경.
  (평가 기간·대상자 등 운영 설정은 `/admin/cycle` 로 분리됨.)
- **소비 API:** `@growthx/contracts` 생성 클라이언트(`authControllerMe`) — 손으로 fetch/타입 안 씀.
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). `fetchMe()` 만 노출.
  - `hooks.ts` — `useSettingsData`(표시용 user 조회 + changePassword 위임).
  - `ui/SettingsView.tsx` — 화면(공용 프리미티브 `@/components/*` + Kinetic 토큰). 시각/동작은 기존 page 그대로 보존.
  - 라우트 `app/(main)/admin/settings/page.tsx` 는 `<SettingsView/>` 만 렌더(얇게).
- **전제:** `configureApi`(baseUrl·authHeader)가 부트에서 호출돼야 함 — 메인 레이아웃에 마운트됨.
- **세션 경계(불변식):** 비밀번호 변경 성공 시 **토큰 회전·user 갱신은 `useAuth`(AuthProvider)가 소유**.
  이 슬라이스는 그 회전을 건드리지 않고 `useAuth().changePassword` 에 위임한다.
  데이터 소스(내 정보 조회)만 생성 클라이언트로 이관. 봉투 unwrap 은 api.ts 한 곳.
