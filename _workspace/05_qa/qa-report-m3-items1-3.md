# QA 리포트 — M3 Items 1-3 + 조직도 (통합 정합성)

> 작성: qa-inspector · 2026-06-04 · 방법: 양쪽 동시 읽기(BE 컨트롤러/서비스 ↔ FE 훅/타입/페이지) 교차검증
> 기준(SSOT): `contract.md` "## M3 델타 (Items 1-3 + 조직도)" · 스코프: `requirements-m3-items1-3.md`
> 타 스트림(Items 4-10: monthly-performance·dashboard trend·compensation simulation·results export·competency) = **검증 제외**(불가침, 분량 보존 확인만).

## 게이트 판정: **통과 (PASS)** — Blocker 0 · Major 0

빌드 재확인: `apps/api` `tsc --noEmit` EXIT 0 · `apps/web` `tsc --noEmit` EXIT 0. 모든 경계면(봉투·camelCase·라우팅·RBAC·상태) 계약과 1:1 일치. 미해소 Minor 2 / Info 2 (게이트 비차단, 후속 개선).

---

## 결함표

| ID | 심각도 | 영역 | 위치 | 수정주체 | 요약 |
|----|--------|------|------|----------|------|
| F-1 | Minor | 입력검증 | `apps/api/.../kpi-category-policy/dto/kpi-category-policy.dto.ts:17-18` | BE | `entries` 배열에 `@ValidateNested({each:true})`+`@Type()` 누락 — 중첩 검증 우회 |
| F-2 | Minor | 표시정합 | `apps/web/app/(main)/org/page.tsx:67-68` + `lib/org.ts:91-121` | FE | HR직군 자동기본(hr_admin/company) 미반영 → "수동(override)" 배지 오탐 |
| I-1 | Info | 스키마 | `apps/api/.../org-chart.service.ts:86` | — | 회사 가상 루트 `type:'group'`(계약에 'company' 타입 없음) — FE OrgNode>type 수용, 동작 무해 |
| I-2 | Info | 표시한계 | `apps/web/lib/types.ts:751,759` | FE | OrgPerson.phone/avatarUrl=null 고정(계약 User에 필드 없음) — 안전 파생, 추측 0 |

---

## 영역별 검증 결과

### Item 1 — 온보딩 / 초기 비밀번호 강제변경 — PASS
- **change-password 토큰 교체**: BE `auth.service.changePassword`(:104-110) `mustChangePassword=false` 갱신 + `issueTokens` 새 토큰 발급 + `toUserDto` 동봉. FE `useAuth.changePassword`(:88-101) `res.{accessToken,refreshToken,user}` 로 `setSession` 교체. 응답 shape `{data:{accessToken,refreshToken,user}}` ↔ FE `ChangePasswordResponse extends AuthTokens {user}` 1:1.
- **비번 정책**: 최소 8자·`1234`/`password` 금지·기존과 동일 불가 — BE 강제(:84-102). 프론트는 표시만(정책 권위 BE).
- **403 FORCE_PASSWORD_CHANGE 게이트**: BE `ForcePasswordChangeGuard`(전역 APP_GUARD 3순위, app.module:78) — DB 최신 `mustChangePassword` 확인(토큰 stale 방지), `@AllowDuringPasswordChange`(me·change-password·logout)·`@Public` 외 403. FE `(main)/layout.tsx`(:104-127) 셸 진입 전 `/onboarding/password` 리다이렉트 + 셸 미렌더(보호 엔드포인트 호출 차단) + login/onboarding 페이지 동일 게이트. **이중 방어 일치.**
- **roster import**: BE `excel.controller importRoster`(:56-61) → `excel.service.importRoster`(:208-334) 6컬럼(그룹|본부|팀|직급|이름|이메일) 조직트리 upsert + 사용자 email upsert + 초기비번 1234 해시 + `mustChangePassword=true` + 직급 자동기본 role/scope/jobLevel + 멱등(기존=비번 보존 갱신). 응답 `{data:{validCount,errorCount,imported,errors:[{row,message}],ok}}`. FE `uploadExcel`(:95) `json.data` unwrap → `ImportResult{validCount,errorCount,imported,ok,errors}` 1:1. 호출처 `/excel/import/roster`(settings·org page) 일치.
- **roster 양식**: `GET /excel/template/roster` — `template/:kind` 라우트가 `roster`(excel.columns `TEMPLATE_COLUMN_MAP.roster`) 매칭, `sendXlsx`로 봉투 없는 바이너리. FE `RosterImportPanel templateHref="/excel/template/roster"` 일치.
- **login/me 비활성 차단**: BE `login`(:25) `!user.isActive` → 401. me·login user에 신규 3필드(`toUserDto`) 포함.

### Item 2 — RBAC visibilityScope — PASS
- **enum 5값 양쪽 일치**: BE `VisibilityScope`(schema:50-56 self/team/division/group/company) ↔ FE `type VisibilityScope`(types:20) 1:1.
- **가시범위 산정(BE 단일)**: `access.util` — `visibleDeptIds`(self=[]·team=본인부서·division=`divisionRootOf`하위(형제본부 제외)·group=`groupRootOf`하위·company/hr_admin=null), `canViewUser`·`applyUserScope` 일관. **division이 형제 본부 제외**(divisionRootOf가 본인 division만 root) 계약 §4 일치.
- **전 조회 일관 적용**: `GET /users`(users.service.list:46 `applyUserScope`) · `GET /users/:id`(get:62 `canViewUser`) · `GET /org-chart`(scopeDeptIds:97-106) 모두 visibilityScope 경유. 무방비 0.
- **PATCH/POST/DELETE /users 가드**: 컨트롤러 `@Roles(hr_admin)`(:38,44,52,59) 강제. role·scope·position·deptId·isActive 수정 BE 단일. DTO `@IsEnum` 검증.
- **자동기본**: `defaultRoleScope`(position.util:66-84) — HR팀→hr_admin/company, 경영진→division_head/group, 본부장→division, 팀장→team, 비직책→employee/self. 계약 §4 일치.

### Item 3 — KPI 카테고리 직급 제한 — PASS
- **정책 enum/매트릭스 양쪽 일치**: BE `defaultAllowedCategories`(position.util:115-126) 직책자=전 카테고리, 비직책자=construction/collaboration/development(revenue·orders 차단) ↔ FE `KpiCategoryAllowed.allowed`·kpi page 필터 일치.
- **422 CATEGORY_NOT_ALLOWED 강제**: `assertCategoryAllowedForUser`가 `create`(:90)·`update`(:122)·`submit`(:154) **3지점 모두** 강제. `KpisModule`이 `KpiCategoryPolicyModule` import(:9) — DI 정상.
- **FE 선택지 필터**: kpi page(:144-151) `useKpiCategoryAllowed({userId})` → `isCategoryAllowed`로 Select 옵션 `disabled`(:467,474). 미로딩 시 전부 허용(최종 강제 BE 422). Item10 role 제한(`roleRestricted`)과 OR 병합 — 공존 정합.
- **엔드포인트**: `GET /kpi-category-policy`(hr_admin 매트릭스)·`/allowed`(인증 작성용)·`PATCH`(부분 upsert+audit) ↔ FE `useKpiCategoryPolicy`·`useKpiCategoryAllowed`·`kpiCategoryPolicyCommands.update` 1:1. PATCH 응답=전체 매트릭스(목록봉투), FE `apiPatch`가 `data`(배열) 추출 — 정상.
- **F-1(Minor)**: `UpdateKpiCategoryPolicyDto.entries: UpdatePolicyEntryDto[]`에 `@ValidateNested({each:true})`+`@Type(()=>UpdatePolicyEntryDto)` 누락 → 중첩 `position`/`allowed` 검증 우회. hr_admin 전용 + DB enum 컬럼이 최종 방어라 위험 낮음.

### 조직도 — PASS
- **GET /org-chart shape 1:1**: BE `org-chart.service.getChart`(:27-94) → `{data: OrgChartNode(id:'company' 가상루트, children=가시 그룹), meta:{total}}`. `directCount`(직속 활성)·`totalCount`(후위순회 하위포함). 가시범위(scopeDeptIds) 반영. EnvelopeInterceptor가 이미 `{data}` 형태면 통과(이중래핑 없음). FE `useOrgChart`(:11) `apiGet`(단건) → `OrgChartNode{id,name,type,parentId,directCount,totalCount,children}` 1:1. **FE가 계약대로 단일 루트 소비**(types 주석·flattenOrg가 'company' 제외 평탄화).
- **GET /users?deptId= 필터**: BE list query `departmentId`(users.service:36) 적용 + scope 축소. FE `useUsers({departmentId})` 일치.
- **사람 CRUD**: POST/PATCH/DELETE /users 동작·`@Roles(hr_admin)`·soft delete(isActive=false). FE `userCommands.create/update/deactivate` 1:1.
- **F-2(Minor)**: FE `userToPerson`(:67-68) override 판정이 직급 자동기본만 비교 — HR직군(BE는 hr_admin/company 자동)을 모르므로 HR직 인물에 "수동" 배지 오탐. 표시 전용(권한 영향 0).
- **I-2(Info)**: phone/avatarUrl null 고정 — 계약 User에 없는 필드, 안전 파생(추측 0).

### 봉투 · camelCase · 라우팅 — PASS
- **봉투 unwrap**: 신규 전부 `api.ts` 단일 경유 — org-chart=`apiGet`(단건), users=`apiGetList`(목록), kpi-category-policy GET=목록·allowed=단건·PATCH=배열, roster import=`uploadExcel`(`json.data`), 양식=봉투 없는 blob. snake 누출 0(BE `toUserDto`·서비스가 camelCase 매핑, `@map`은 DB만).
- **라우팅**: `/org`(`(main)/org/page.tsx`)·`/onboarding/password`(`app/onboarding/password/page.tsx`, 그룹 밖=셸 미상속 의도) 실존. nav `org` 항목(전역) href `/org` ↔ page 일치. `activeKeyForPath` 정합. route group `(main)`/`(auth)` URL 제거 정상.

### Position enum 10값 — PASS
- BE `Position`(schema:35-46) ↔ FE `type Position`(types:7-17) 10값 완전 일치(ceo·vice_president·executive·director·principal·division_head·team_lead·chief·senior·pro). 한글 라벨: BE `POSITION_LABEL`(position.util:29-40) ↔ FE `positionLabel`/`POSITION_LABEL`(ui.ts). 한글 임포트 매핑 `KOREAN_POSITION_MAP` 정합.

### 마이그레이션 / 스키마 — PASS
- 신규 enum `VisibilityScope` + `Position` 4값 추가(vice_president·executive·director·principal), `User` 필드(`must_change_password`·`visibility_scope`·`is_active`) + `KpiCategoryPolicy` 모델 — 마이그레이션 `20260604120000_m3_items1_3/migration.sql` 정합.
- **타 스트림 분량 보존 확인**: 동일 마이그레이션이 monthly_performances·competency_questions·competency_responses·cycle_schedules.is_locked·users.current_salary 동시 포함. **DROP 문 0건**(전부 ADD/CREATE) — 삭제 없음, additive only. `init` 마이그레이션 보존.
- Postgres `ALTER TYPE ADD VALUE` 후 신규 Position 값이 같은 마이그레이션에서 컬럼 타입 참조로만 쓰임(리터럴 INSERT 없음) → 트랜잭션 enum 안전.

---

## 회귀(regression) 확인
이전 리포트 `qa-report-m2-features.md`(D-1/D-2/D-3) 영역(grade-pool caps·org/achievements 임포트·compensation 실명)은 본 스트림 변경(User DTO 필드 추가·excel roster 추가)과 충돌 없음. EnvelopeInterceptor·access.util 기존 행수준 권한은 visibilityScope로 통일되며 M1/M2 조회 경로도 동일 헬퍼 사용 — 일관 유지.

## BE 후속 권고 (비차단)
- **F-1**: `kpi-category-policy.dto.ts`에 `import { Type } from 'class-transformer'` + `@ValidateNested({each:true}) @Type(()=>UpdatePolicyEntryDto)`를 `entries`에 부착(중첩 검증 활성).

## FE 후속 권고 (비차단)
- **F-2**: `userToPerson` override 판정에 HR부서(`role==='hr_admin' && scope==='company'`)는 자동기본으로 간주해 오탐 제거(`lib/org.ts`에 HR 자동기본 케이스 추가 또는 role===hr_admin이면 override 비표시).
