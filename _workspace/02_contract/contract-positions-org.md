# 계약: 무소속 사용자 허용 + 직급(Position) 관리형 레지스트리

> 작성: 리더(오케스트레이터) · 2026-06-05 · FE+BE 공유 단일 기준
> 사용자 요구: ① 사용자 추가 시 그룹/본부/팀이 **모두 없어도** 등록 가능(CTO·외부 임원 등). ② 직급을 **추가/삭제** 가능하게.
> 결정: 직급은 **관리형 테이블로 전환**(enum 폐기). 새 직급은 **추가 시 역할/가시범위/경영진여부를 직접 지정**.

---

## Part A — 무소속 사용자 (조직 선택 옵션화)

### A-0. 현황
- `User.departmentId` 는 이미 **nullable**, `User.managerId` 도 nullable. `CreateUserDto.departmentId` 도 이미 optional.
- 막고 있던 곳은 **프론트 폼**(그룹 required)과, **edit 시 부서 해제 불가**(서비스가 `?? undefined` 로 null 무시) 두 가지뿐.

### A-1. 백엔드 변경
1. `CreateUserDto.departmentId` / `managerId`: optional 유지. **빈 문자열 거부**, null 허용.
2. `UpdateUserDto.departmentId` / `managerId`: **명시적 null 로 소속/관리자 해제 가능**해야 함.
   - DTO: `@IsOptional() @ValidateIf((o) => o.departmentId !== null) @IsString() departmentId?: string | null;` (managerId 동일).
   - 서비스 `update`: `departmentId: dto.departmentId === undefined ? undefined : dto.departmentId` (undefined=변경없음, null=해제). managerId 동일.
3. `create`: `departmentId` 가 없으면 HR 판정 불가 → 자동 role/scope 는 직급 기본값만 적용(아래 Part B 의 레지스트리 기본값).

### A-2. 프론트 변경 (`apps/web/app/(main)/admin/users/page.tsx`)
1. 폼 유효성: `valid = !!(form.name && form.email && form.position)` — **그룹 제거**.
2. 그룹 `<Field label="그룹">` 에서 `required` 제거. 본부/팀은 기존처럼 상위 선택 시 활성(cascade 유지). 즉 아무 것도 안 고르면 무소속, 그룹만 고르면 그룹소속 … 자유.
3. `resolveDeptId(f)` → 선택된 최하위 id 또는 **없으면 `undefined`** (빈 문자열 금지).
4. 추가(`handleAdd`): `departmentId` 가 없으면 키 자체를 보내지 않거나 생략.
5. 수정(`handleEdit`): 조직을 비웠다면 `departmentId: null` 을 보내 **해제**. 선택돼 있으면 해당 id.
6. 안내문: 그룹 라벨 옆 "임원·외부 인사는 비워둘 수 있어요" 정도의 보조 문구(선택).

---

## Part B — 직급 관리형 레지스트리 (Position enum → PositionDef 테이블)

### B-1. 설계 원칙
- **코드(string) 유지**: `User.position` 은 계속 `'ceo' | 'team_lead' | …` 같은 **코드 문자열**을 저장. enum 타입만 폐기하고 컬럼은 `String` 으로. → 기존 `position === 'team_lead'` 비교 로직 전부 그대로 동작.
- **레지스트리 테이블 `PositionDef`** 가 코드↔라벨↔기본값의 단일 출처. 드롭다운·라벨·기본값은 모두 여기서.
- 기본 10개는 **시스템 직급**(`isSystem=true`) — 시드로 생성, **삭제·코드변경 불가**(라벨/정렬/기본값 편집은 허용).
- 커스텀 직급은 hr_admin 이 추가/수정/삭제. 단 **사용 중(참조 유저 존재)이면 삭제 차단**.

### B-2. Prisma 스키마 (`apps/api/prisma/schema.prisma`)
1. `enum Position { … }` **삭제**.
2. `model User`: `position Position` → `position String`.
3. `model KpiCategoryPolicy`: `position Position @unique` → `position String @unique`.
4. 신규 모델:
```prisma
// 직급 레지스트리 — enum 폐기 후 관리형. 코드(string)가 User.position 에 저장됨.
model PositionDef {
  id              String          @id @default(uuid())
  code            String          @unique          // 'ceo' … 'pro', 'custom_xxx'
  label           String                            // '대표이사', 'CTO'
  sortOrder       Int             @map("sort_order") // 낮을수록 상위 직급
  isManagement    Boolean         @default(false) @map("is_management") // 직책자(경영진/본부장/팀장) — KPI 카테고리·통계 기준
  defaultRole     Role            @default(employee) @map("default_role")
  defaultScope    VisibilityScope @default(self)     @map("default_scope")
  defaultJobLevel JobLevel?       @map("default_job_level")
  isSystem        Boolean         @default(false) @map("is_system") // 기본 10개=true(삭제/코드변경 차단)
  isActive        Boolean         @default(true)  @map("is_active")
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")

  @@map("position_defs")
}
```
> 모델명을 `Position` 이 아니라 **`PositionDef`** 로 한 이유: `@prisma/client` 의 `Position` 타입 충돌 방지.

### B-3. 마이그레이션 (수동 SQL 주의)
Postgres enum→text 전환은 Prisma 자동생성이 깨질 수 있으니 마이그레이션 SQL 을 직접 검수:
1. `CREATE TABLE position_defs (…)`.
2. `ALTER TABLE users ALTER COLUMN position TYPE text USING position::text;`
3. `ALTER TABLE kpi_category_policies ALTER COLUMN position TYPE text USING position::text;`
4. `DROP TYPE "Position";`
5. 시스템 직급 10행 시드는 seed.ts 에서(아래). 마이그레이션엔 데이터 시드 넣지 말 것(idempotent 위해 seed 로 upsert).

### B-4. `Position` 타입 대체 (`apps/api/src/common/access/position.util.ts`)
enum 삭제로 `@prisma/client` 의 `Position` 임포트가 전부 깨짐. 다음을 추가하고, 백엔드 전 파일의 `import { Position } from '@prisma/client'` 를 이 파일에서 가져오도록 교체:
```ts
// enum 폐기 대체 — 시스템 코드 상수 + 코드 타입(커스텀 허용 위해 string).
export const Position = {
  ceo: 'ceo', vice_president: 'vice_president', executive: 'executive',
  director: 'director', principal: 'principal', division_head: 'division_head',
  team_lead: 'team_lead', chief: 'chief', senior: 'senior', pro: 'pro',
} as const;
export type Position = string; // 커스텀 코드 허용(값+타입 선언 병합)
```
- `Position.team_lead` 등 값 참조: 그대로 동작.
- `position: Position` 타입: `string` 으로 넓어짐.
- `import { JobLevel, Position, Role } from '@prisma/client'` 형태는 **분리**: `Position` 만 position.util 에서.
- `POSITION_LABEL`, `KOREAN_POSITION_MAP`, `defaultRoleScope`, `deriveJobLevel`, `isTitleHolder`, `defaultAllowedCategories` 는 **시스템 직급용 폴백**으로 보존(레지스트리 시드의 출처로도 사용). `Record<Position,…>` 는 `Record<string,…>` 로 완화.

### B-5. 기본값 해석(레지스트리 우선)
사용자 생성/임포트 시 직급 기본값은 **레지스트리 행**에서 읽는다(시스템 직급은 아래 값으로 시드 → 기존 동작과 동일).

| code | label | sortOrder | isManagement | defaultRole | defaultScope | defaultJobLevel |
|------|-------|-----------|--------------|-------------|--------------|-----------------|
| ceo | 대표이사 | 10 | true | division_head | group | division_head |
| vice_president | 부대표 | 20 | true | division_head | group | division_head |
| executive | 상무 | 30 | true | division_head | group | division_head |
| director | 이사 | 40 | true | division_head | group | division_head |
| division_head | 본부장 | 50 | true | division_head | division | division_head |
| team_lead | 팀장 | 60 | true | team_lead | team | team_lead |
| principal | 수석 | 70 | false | employee | self | senior_plus |
| chief | 책임 | 80 | false | employee | self | senior_plus |
| senior | 선임 | 90 | false | employee | self | senior_minus |
| pro | 프로 | 100 | false | employee | self | senior_minus |

> HR 부서(인사/총무) 소속이면 role/scope 는 `hr_admin/company` 로 **오버라이드**(기존 규칙 유지). HR 판정은 departmentId 있을 때만.

`users.service.create` 로직:
```
def = positionDef.findUnique({ code: dto.position }); // 없으면 400 '알 수 없는 직급'
isHr = departmentId ? isHrDeptName(deptName) : false;
role  = dto.role  ?? (isHr ? hr_admin  : def.defaultRole);
scope = dto.visibilityScope ?? (isHr ? company : def.defaultScope);
jobLevel = dto.jobLevel ?? def.defaultJobLevel ?? null;
```
excel 임포트도 동일하게 레지스트리 기본값 사용. 라벨→코드 변환은 **레지스트리 label 우선**, 없으면 `KOREAN_POSITION_MAP` 폴백.

### B-6. DTO 검증 변경
- `CreateUserDto.position`: `@IsEnum(Position)` → `@IsString() @IsNotEmpty()`. 존재성은 서비스에서 레지스트리 조회로 검증(없으면 400).
- `UpdateUserDto.position`: `@IsEnum(Position)` → `@IsOptional() @IsString()`. (수정 시에도 레지스트리 검증)
- `kpi-category-policy.dto` 의 `position` 도 `@IsString()` 로.

### B-7. KpiCategoryPolicy 리팩터 (`kpi-category-policy.service.ts`)
- `ALL_POSITIONS = Object.values(Position)` → `const defs = await prisma.positionDef.findMany({ orderBy: { sortOrder: 'asc' } })`.
- 매트릭스: `defs.map(d => ({ position: d.code, label: d.label, allowed: byPos.get(d.code) ?? (d.isManagement ? ALL_CATS : NON_MGMT_CATS) }))`.
- `POSITION_LABEL[position]` 사용처는 레지스트리 label 폴백(`def?.label ?? POSITION_LABEL[code] ?? code`).
- 직급 삭제 시 해당 code 의 KpiCategoryPolicy 행도 함께 삭제(B-9).

### B-8. 신규 모듈 `positions` (`apps/api/src/modules/positions/`)
응답 봉투·camelCase·경로 규약(api-contract-convention) 준수.

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/positions` | 인증 사용자 전체 | 직급 목록. 기본 `isActive=true`만, `?includeInactive=true` 면 전체. `sortOrder asc`. |
| POST | `/positions` | hr_admin | 커스텀 직급 추가 |
| PATCH | `/positions/:id` | hr_admin | 라벨/정렬/경영진여부/기본값 수정(코드·isSystem 불변) |
| DELETE | `/positions/:id` | hr_admin | 커스텀·미사용 직급 삭제 |

**응답 아이템(camelCase):**
```json
{ "id","code","label","sortOrder","isManagement",
  "defaultRole","defaultScope","defaultJobLevel","isSystem","isActive" }
```
`GET /positions` → `{ "data": PositionDef[], "meta": { "total": n } }`

**POST 바디:**
```json
{ "label": "CTO", "isManagement": true,
  "defaultRole": "division_head", "defaultScope": "group",
  "defaultJobLevel": "division_head", "sortOrder": 35, "code": "cto" }
```
- `code` 생략 시 서버가 생성: label 슬러그화 + 충돌 시 `custom_<n>`. 시스템 코드(위 10개)와 충돌 금지, unique.
- `code` 제공 시: `^[a-z][a-z0-9_]*$`, 시스템 코드/기존 코드와 충돌 시 409.
- `label` 필수·중복 불가(409 권장). `defaultRole`/`defaultScope` 는 Role/VisibilityScope enum 검증, `defaultJobLevel` optional(JobLevel|null).
- `isSystem=false` 고정.

**PATCH 바디(부분):** `{ label?, sortOrder?, isManagement?, defaultRole?, defaultScope?, defaultJobLevel?, isActive? }`. `code`·`isSystem` 변경 시도는 무시/400.

**DELETE 규칙:**
- `isSystem=true` → 409 `{ code:'FORBIDDEN', message:'기본 직급은 삭제할 수 없어요.' }`.
- 참조 유저 존재(`user.count({ where:{ position: code } }) > 0`, 활성·비활성 모두) → 409 `{ code:'IN_USE', message:'이 직급을 쓰는 사용자가 있어 삭제할 수 없어요. 먼저 직급을 변경하세요.' }`.
- 통과 시 PositionDef + 동일 code 의 KpiCategoryPolicy 삭제. 감사로그 기록.

DTO 검증 에러 응답 봉투/코드는 기존 컨벤션(`{ error:{ code, message } }`) 준수.

### B-9. seed.ts
- ROSTER 임포트 **전에** `PositionDef` 10행을 **upsert**(B-5 표값, isSystem=true).
- `POS_MAP`(한글→코드)·`JL_MAP` 은 시드 전용으로 유지.
- KpiCategoryPolicy 시드는 기존 로직 유지(코드 string 기준).

---

## Part C — 프론트엔드 직급 동적화

### C-1. 타입 (`apps/web/lib/types.ts`)
- `export type Position = string;` 로 완화(기존 union 은 `export type SystemPosition = 'ceo' | … | 'pro';` 로 보존, 색/정렬 폴백용).
- `PositionDef` 인터페이스 추가:
```ts
export interface PositionDef {
  id: string; code: string; label: string; sortOrder: number;
  isManagement: boolean;
  defaultRole: Role; defaultScope: VisibilityScope;
  defaultJobLevel: JobLevel | null;
  isSystem: boolean; isActive: boolean;
}
export interface CreatePositionRequest {
  label: string; isManagement: boolean;
  defaultRole: Role; defaultScope: VisibilityScope;
  defaultJobLevel?: JobLevel | null; sortOrder?: number; code?: string;
}
export type UpdatePositionRequest = Partial<Omit<CreatePositionRequest,'code'>> & { isActive?: boolean };
```

### C-2. 훅 (`apps/web/hooks/usePositions.ts`)
- `usePositions(opts?)` → `GET /positions`, `{ data, meta }` unwrap. `positionCommands.create/update/remove`.
- 라벨·정렬·색의 단일 출처. SWR/기존 패턴 따름.

### C-3. 라벨/색 헬퍼 완화
- `lib/ui.ts` `positionLabel: Record<Position,string>` → `Record<string,string>`(시스템 폴백) + `getPositionLabel(code, registry?)` 헬퍼(레지스트리 우선 → 정적맵 → code).
- `Record<Position, …>` 형태(`positionColor`, compensation/page.tsx 등) → `Record<string,…>` + 미정의 코드는 회색 폴백.
- `org.ts` `defaultRoleForPosition`/`defaultScopeForPosition` 는 시스템 폴백으로 유지(레지스트리 있으면 레지스트리 기본값 우선).

### C-4. 사용자 폼 직급 드롭다운
- 하드코딩 `POSITION_OPTIONS` 제거 → `usePositions()` 로 로드. `option` 라벨은 `label`, 정렬 `sortOrder`. (`PersonEditModal.tsx` 의 `POSITIONS`, `compensation/page.tsx`, `org/page.tsx` 의 직급 사용처도 동일하게 레지스트리 기반으로.)

### C-5. 직급 관리 UI
- 위치: **`admin/users` 페이지에 "직급 관리" 탭 추가**(기존 "조직 구조" 탭과 나란히). 조직 CRUD 패턴 재사용.
- 목록: code·label·정렬·경영진여부·기본 역할/가시범위 표시, 시스템 직급엔 "기본" 뱃지(삭제 버튼 비활성).
- 추가 모달: 라벨, 경영진 여부(토글), 기본 역할(select), 기본 가시범위(select), 기본 직급레벨(select/optional), 정렬값(number). 코드는 자동(고급에서 수동 입력 옵션).
- 수정: 라벨/정렬/경영진/기본값 인라인 또는 모달.
- 삭제: 커스텀·미사용만. 409 `IN_USE`/`FORBIDDEN` 시 토스트로 안내.

---

## 공통 규약
- 응답 봉투 `{data}`/`{data,meta}`/`{error:{code,message}}`, camelCase, 한국어 메시지. (api-contract-convention)
- 권한: 직급 mutation·사용자 mutation = `hr_admin`. `GET /positions` 는 인증 사용자 전체(드롭다운/라벨 필요).
- 빌드 게이트: `apps/api` `npm run build`(tsc + prisma generate), `apps/web` `npm run build`/typecheck 통과. 마이그레이션은 `prisma migrate` 로 생성하고 SQL 검수.
