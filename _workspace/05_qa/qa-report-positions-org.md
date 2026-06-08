# QA 정합성 리포트 — 무소속 사용자 + 직급 레지스트리 (positions-org)

> 검증: integration-qa (경계면 양쪽 동시 읽기) · 2026-06-05
> 기준 계약: `_workspace/02_contract/contract-positions-org.md`
> 판정: **통과 (PASS)** — Blocker/Major 0건. Minor 2건(권고).

---

## 빌드 게이트
- `apps/api` `npm run build` (nest build) → **에러 0 (PASS)**
- `apps/web` `npx tsc --noEmit` → **에러 0 (PASS)**

---

## 검증 항목별 결과

### 1. 응답 봉투·필드명 (API ↔ usePositions) — PASS
- 생산자 `positions.service.ts:22 toPositionDto` → `{id,code,label,sortOrder,isManagement,defaultRole,defaultScope,defaultJobLevel,isSystem,isActive}` 전부 camelCase.
- `list()` → `{ data: [...], meta:{ total } }` 봉투. `create/update` → `{ data }`.
- 소비자 `usePositions.ts:20` `apiGetList<PositionDef>` 가 `{data,meta}` unwrap, `lib/types.ts:933 PositionDef` 인터페이스와 1:1 일치.
- 프론트 `types.ts` ↔ 백엔드 직렬화 필드명 완전 일치. snake_case 누출 없음(Prisma `@map` 은 컬럼만, 직렬화는 camelCase).

### 2. 무소속 사용자 (조직 선택 옵션화) — PASS
- DTO `user.dto.ts:39-43`(Create), `:77-80`(Update): `@ValidateIf((o)=>o.departmentId!==null) @IsString() @IsNotEmpty()` — null 통과·빈문자열 거부.
- 서비스 update `users.service.ts:147`: `departmentId === undefined ? undefined : dto.departmentId` — null=해제, undefined=유지. managerId 동일(:148). **해제 경로 동작 확인.**
- create `users.service.ts:97`: `departmentId` 있을 때만 HR 판정, 없으면 `def.defaultRole/Scope` 적용. `:113` `departmentId: dto.departmentId ?? null`.
- 프론트 handleAdd `page.tsx:1000`: `...(deptId ? {departmentId:deptId} : {})` — 무소속 시 키 생략.
- 프론트 handleEdit `page.tsx:1030`: `departmentId: deptId ?? null` — 비우면 null 전송(해제).
- 폼 valid `page.tsx:169`: `!!(form.name && form.email && form.position)` — 그룹 제거됨. 그룹 Field(`:243`) `required` 없음.

### 3. 직급 삭제 가드 (DELETE 409 ↔ 프론트) — PASS
- 백엔드 `positions.service.ts:181` isSystem→409 `FORBIDDEN`, `:188` 참조유저(`user.count({position:code})>0`)→409 `IN_USE`. 통과 시 PositionDef + 동일 code KpiCategoryPolicy 트랜잭션 삭제(`:196`).
- 프론트 `page.tsx:940` ApiError.message 토스트 노출(IN_USE/FORBIDDEN 한국어 메시지 그대로). 시스템 직급 삭제버튼 `:1418-1423` `disabled={p.isSystem}` + 회색·not-allowed.

### 4. 직급 기본값 해석 (레지스트리 우선) — PASS
- create `users.service.ts:83` `positionDef.findUnique({code})` 없으면 400(`:84`). role/scope/jobLevel 을 `def.default*` 에서 읽음(`:98-100`), HR 부서면 hr_admin/company 오버라이드.
- update `users.service.ts:129` 직급 변경 시 동일 검증.
- excel `excel.service.ts:349-355` 레지스트리 기본값 + 폴백(`deriveJobLevel`), label→code 레지스트리 우선(`:324`).
- seed 10행 `seed.ts:30-39` 값이 **계약 B-5 표와 완전 일치**(code/label/sortOrder/isManagement/defaultRole/defaultScope/defaultJobLevel 전부 대조 OK).

### 5. enum 잔재 — PASS
- 백엔드: `schema.prisma` 에 `enum Position` 없음(주석만). `User.position String`(:166), `KpiCategoryPolicy.position String @unique`(:734). 마이그레이션 `DROP TYPE "Position"`(무손실 text 캐스트).
- `@IsEnum(Position)`·`@prisma/client` 의 `Position` enum 임포트 잔존 0건. `positions.service.ts:19 Object.values(Position)` 는 `position.util` 의 코드상수(SYSTEM_CODES) 출처 — 의도된 사용.
- 프론트: `@prisma/client` import 0건, `@IsEnum(Position)`/하드코딩 `POSITION_OPTIONS` 0건. `types.ts:19 Position=string`, `SystemPosition` 폴백 보존.

### 6. 권한 가드 — PASS
- 전역 `JwtAuthGuard`+`RolesGuard`(app.module.ts:79-80). `positions.controller.ts`: GET=가드 없음→인증 전체, POST/PATCH/DELETE=`@Roles(Role.hr_admin)`. 프론트만 숨긴 무방비 엔드포인트 없음.

### 7. 라우팅 — PASS
- "직급 관리"는 `admin/users` 페이지 **내부 탭**(`page.tsx:1252 {key:'positions',label:'직급 관리'}`), 별도 라우트 아님 — 계약 C-5 위치 일치. router.push 신규 없음.

### 8. KpiCategoryPolicy (레지스트리 기반) — PASS
- `kpi-category-policy.service.ts:40` `positionDef.findMany` 로 매트릭스 구성, `:47 label ?? POSITION_LABEL[code] ?? code` 폴백. `allowedFor`(:54)·`labelFor`(:63) 레지스트리 우선 → 정적맵 → code 3단 폴백. 직급 삭제 시 동일 code 정책 함께 삭제(B-9).

---

## Minor (권고 — 차단 아님)

### [M-1] DELETE 응답 shape 미세 불일치 (무해)
- 생산자 `positions.service.ts:208` → `{ data: { id, deleted: true } }`
- 소비자 `usePositions.ts:35` `apiDelete<{ id: string }>` — `deleted` 필드를 타입에서 누락.
- 영향: 런타임 무해(프론트는 반환값을 쓰지 않고 reload). 타입 정확성만 미세 결손.
- 권고: 훅 제네릭을 `<{ id: string; deleted: boolean }>` 로 맞추거나 서비스에서 `deleted` 제거.

### [M-2] create label 중복 검사 비활성 직급 미포함 고려
- `positions.service.ts:67` labelDup `findFirst({where:{label}})` 는 비활성 직급도 포함해 정상. 단 삭제(하드딜리트)된 직급은 재사용 가능 — 계약과 부합. 별도 조치 불필요(정보성).

---

## 미검증 (런타임 영역 — 정적 범위 밖)
- 실제 DB 마이그레이션 적용 후 enum→text 데이터 보존(보고상 시드/마이그레이션 통과). 정적 SQL 검수는 PASS.
- 브라우저에서 직급 추가/삭제 E2E 흐름(빌드·타입·계약 정합성으로 갈음).

---

## 결론
경계면 8개 항목 전부 통과. Blocker/Major 0. 빌드 게이트 양측 통과. **릴리스 게이트 통과 판정.** Minor 2건은 후속 정리 권고(차단 아님).
