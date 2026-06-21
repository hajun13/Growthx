# admin-permissions feature

권한 관리(`/admin/permissions`, hr_admin 전용) 화면의 수직 슬라이스 — architecture.md §5 표준 패턴.

- **책임:** 사용자별 권한 레벨 부여 / 권한 매트릭스 / 사이드바 메뉴 가시성 / 가시성 정책(시안) 4탭.
- **소비 API:** `@growthx/contracts` 생성 클라이언트(`permissionsControllerGetConfig` / `permissionsControllerUpdateConfig`) — 손으로 fetch/타입 안 씀.
- **구조:**
  - `api.ts` — 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`) + `@/lib/permConfig` 의 SSOT 타입으로 머지(`mergeMatrix`/`mergeNav`). 컴포넌트엔 강타입(`MatrixConfig`/`NavConfig`)만.
  - `hooks.ts` — `usePermissionsCommands`(저장 커맨드). 권한 설정 읽기/전역 캐시 동기화는 공용 컨텍스트 `@/hooks/usePermissions` 를 그대로 사용.
  - `ui/PermissionsView.tsx` — 화면(공용 프리미티브 `@/components/*` + 권한 SSOT `@/lib/permConfig` 소비). Notion Low Color 토큰 준수.
  - 라우트 `app/(main)/admin/permissions/page.tsx` 는 `<PermissionsView/>` 만 렌더(얇게).
- **전제:** `configureApi`(baseUrl·authHeader)가 부트에서 호출돼야 함 — `(main)/layout` 에 마운트.
- **불변식:**
  - 봉투 unwrap 은 api.ts 한 곳. 권한 레벨(PermLevel = Role + visibilityScope) SSOT 는 `@/lib/permConfig`.
  - 사용자별 권한 변경은 `useUsers`/`userCommands`(역할+가시범위 동시 PATCH) — 의미 불변.
  - 가시성 설정 탭은 정적 정책 시안(백엔드 미연동) — 기존 동작 보존.
- **사이드 노트:** 이 화면은 등급(S~D) 배지를 쓰지 않으므로 `lib/grade` 미사용. 색은 권한 레벨 색(`LEVEL_DEFS`)·범위 색.
