# notifications feature

알림 화면의 수직 슬라이스 — **새 아키텍처 표준 패턴의 레퍼런스**(architecture.md §5).

- **책임:** 알림 목록 조회·필터·읽음 처리 화면.
- **소비 API:** `@growthx/contracts` 생성 클라이언트(`notificationsController*`) — 손으로 fetch/타입 안 씀.
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). 컴포넌트엔 도메인 값만.
  - `hooks.ts` — `useNotificationsData`(로드·reload·markRead·markAllRead).
  - `ui/NotificationsView.tsx` — 화면(공용 프리미티브 `@/components/*` + 토큰 `@growthx/ui` 소비).
  - 라우트 `app/(main)/notifications/page.tsx` 는 `<NotificationsView/>` 만 렌더(얇게).
- **전제:** `configureApi`(baseUrl·authHeader)가 부트에서 호출돼야 함 — `components/ApiClientInit.tsx`(메인 레이아웃에 마운트).
- **불변식:** 인증·baseUrl 은 contracts runtime 에 주입(앱이 단일 소스). 봉투 unwrap 은 api.ts 한 곳.

## 다음 페이지로 확대할 때
이 폴더 구조(api/hooks/ui + 얇은 라우트)를 그대로 복제. 응답 타입이 필요하면 백엔드 컨트롤러에
`@ApiTags` + `@ApiOkEnvelope(Dto)` 를 달고 `pnpm -C apps/api run openapi && pnpm -C packages/contracts run generate` 재생성.
