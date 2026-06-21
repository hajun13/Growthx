# admin-users feature

`/admin/users`(사용자 관리, hr_admin) 화면의 데이터·로직·UI 슬라이스.

## 구성
- `api.ts` — 데이터 계층. `@growthx/contracts` 생성 클라이언트(`usersController*`) 호출 + 봉투 unwrap(`res.data.data`). `userCommands`(create·update·resign·reactivate·remove·purge)와 `fetchUsers`/`fetchUser` 노출. 생성 클라이언트가 throw 하는 `ApiError`(contracts runtime)도 재노출 — 사용자 커맨드 에러 분기는 이 클래스로 잡는다.
- `hooks.ts` — `useUsers(params, options)`. 기존 `@/hooks/useUsers` 와 동일한 표면(`{ data, loading, error, reload }`)을 `useAsync` + `fetchUsers` 로 재구현. 반환 `data` 는 `{ data: User[] }`(뷰의 `usersData.data` 사용).
- `ui/AdminUsersView.tsx` — 기존 `app/(main)/admin/users/page.tsx` 로직 전체 이동. 데이터 소스만 위 슬라이스로 교체, 시각/동작·RBAC·라우트·데이터 의미 불변(Notion Low Color 토큰).
- 라우트 `app/(main)/admin/users/page.tsx` 는 `<AdminUsersView/>` 만 렌더하는 얇은 래퍼.

## 봉투 unwrap
orval fetch 클라이언트 함수는 `{ data, status, headers }`(data=HTTP 본문 봉투 `{data,meta}`)를 반환 → 실제 값은 `res.data.data`. `api.ts` 가 이 unwrap 을 한 번 처리.

## ApiError 두 종류(주의)
- **사용자 커맨드**(create/update/resign/reactivate/remove/purge·목록): 생성 클라이언트 → **contracts `ApiError`** throw. 뷰에서 `UserApiError`(= `../api` 재노출)로 `instanceof` 분기(이메일 중복 `ALREADY_EXISTS`, 삭제 차단 `CONFLICT`, 메시지 노출).
- **조직·직급·평가 커맨드**(departmentCommands·positionCommands·evaluationCommands): 아직 `@/lib/api` → **`@/lib/api` `ApiError`** throw. 뷰에서 기존 `ApiError` 로 분기. 두 클래스는 형태(`.code`/`.message`)가 같으나 별개라 `instanceof` 대상을 각각 맞춰야 한다.

## 비고
- 등급(S~D) 배지를 쓰지 않는 화면이라 `lib/grade` 적용 없음(직급 칩·재직 상태 뱃지는 자체 색 유지).
- 인증·baseUrl 부트(`configureApi`/`ApiClientInit`)는 `(main)/layout` 에 마운트 — 본 슬라이스는 손대지 않음.
- 조직(`useOrgChart`)·직급(`usePositions`)·주기(`useCurrentCycle`)·평가(`evaluationCommands`)는 본 작업 범위 밖이라 기존 `@/hooks/*` 그대로 사용.
