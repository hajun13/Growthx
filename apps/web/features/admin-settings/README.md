# admin-settings feature

개인 설정 화면(`/admin/settings`)의 수직 슬라이스 — notifications 표준 패턴(architecture.md §5) 복제.

- **책임:** 알림 발송 안내 표시(읽기 전용 — 개인별 수신 설정은 서버 미지원, 준비 중).
  (평가 기간·대상자 등 운영 설정은 `/admin/cycle` 로 분리됨.
  비밀번호 변경은 최초 로그인 온보딩 강제 흐름 `app/onboarding/password` 에서만 처리 — 자발적 변경 화면은 제거됨.)
- **소비 API:** `@growthx/contracts` 생성 클라이언트(`authControllerMe`) — 손으로 fetch/타입 안 씀.
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). `fetchMe()` 만 노출.
  - `hooks.ts` — `useSettingsData`(표시용 user 조회).
  - `ui/SettingsView.tsx` — 화면(공용 프리미티브 `@/components/*` + Notion Low Color 토큰).
  - 라우트 `app/(main)/admin/settings/page.tsx` 는 `<SettingsView/>` 만 렌더(얇게).
- **전제:** `configureApi`(baseUrl·authHeader)가 부트에서 호출돼야 함 — 메인 레이아웃에 마운트됨.
