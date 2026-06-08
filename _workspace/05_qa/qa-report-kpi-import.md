# QA 리포트 — 개인별 KPI 엑셀 일괄 임포트 (통합 정합성)

- 검증일: 2026-06-05
- 기준: `_workspace/02_contract/kpi-import-contract.md`, `api-contract-convention.md`(봉투 `{data}`, camelCase, prefix `/api/v1`)
- 방식: 백엔드(생산자) ↔ 프론트(소비자) 양쪽 동시 읽기 교차 대조
- 판정: **조건부 통과 (CONDITIONAL)** — blocker 없음, major 1건(가중치 null 타입 거짓), minor 3건.

---

## 1. 응답 shape ↔ 프론트 타입 1:1

### preview 응답 (`previewKpi` → `KpiImportPreview`/`KpiImportRow`)

| 필드 | 백엔드(excel.service:927-936, 902-913) | 프론트(types.ts:1065-1086) | 판정 |
|------|------|------|------|
| `fileName` | `fileName ?? null` (string\|null) | `fileName: string` | ⚠ minor (아래 MINOR-1) |
| `rows[]` | 객체 배열 | `KpiImportRow[]` | PASS |
| `rows[].category/group/csf/title/targetText/measureMethod` | 일치 | 일치 | PASS |
| `rows[].weight` | `number \| null` (parseKpiSheet 타입 865, extractKpiWeight 824-831 null 반환) | `weight: number` | ❌ **MAJOR (MAJOR-1)** |
| `rows[].gradingCriteria` | `Record<string,string> \| null` (extractGradingCriteria 834-842) | `KpiGradingCriteria`(S~D 키 고정, null 불가) | ⚠ minor (MINOR-2) |
| `rows[].valid/message` | 일치 | 일치 | PASS |
| `validCount/errorCount/weightSum/errors` | 일치 | 일치 | PASS |

### import 응답 (`importKpi` → `KpiImportResult`)

| 필드 | 백엔드(excel.service:1020-1031) | 프론트(types.ts:1089-1099) | 판정 |
|------|------|------|------|
| `ok/userId/cycleId/imported/deletedDrafts/weightSum/errors/warnings` | 전부 반환 | 전부 선언 | PASS |
| `fileName` | **백엔드 미반환** | `fileName: string` 선언(필수) | ⚠ minor (MINOR-3) |

> 화면(page.tsx ResultCard)은 `r.fileName` 을 쓰지 않아 런타임 영향 없음. 타입 거짓 선언만.

---

## 2. 경로·쿼리·봉투 unwrap

- preview 호출: 프론트 `uploadExcel('/excel/import/kpi/preview', file)` (page.tsx:341-344) ↔ 컨트롤러 `@Post('import/kpi/preview')`(controller:84). **PASS.**
- import 호출: 프론트 `uploadExcel('/excel/import/kpi', file, { userId, cycleId })` (page.tsx:365-369) ↔ 컨트롤러 `@Post('import/kpi')` + `@Query('userId'/'cycleId')`(controller:95-102). **PASS.**
- prefix: `excel.ts:24 PREFIX='/api/v1'` + buildUrl 합성 → `/api/v1/excel/...`. **PASS** (글로벌 prefix 가정 일치).
- 봉투 unwrap: `uploadExcel` 가 `json.data` 반환(excel.ts:104-112), 백엔드 모든 응답 `{ data: {...} }`. **PASS.**
- cycleId 생략 처리: 프론트 `cycleId: cycleId ?? undefined` → `withQuery` 가 undefined 생략(excel.ts:16-17) → 백엔드 활성 사이클 폴백(service:961-963). **PASS.**

---

## 3. camelCase / snake 혼선

- DB `target_text`/`grading_criteria`(schema.prisma:346,350, migration 확인) → Prisma `targetText`/`gradingCriteria`(@map) → API/프론트 모두 camelCase. **PASS, snake 누출 없음.**

---

## 4. 라우팅·권한 가드

- nav href `/admin/kpi-import`(nav.ts:143) ↔ 실제 page `app/(main)/admin/kpi-import/page.tsx`. **PASS.**
- activeKey: `activeKeyForPath` 에 `/admin/kpi-import → 'kpi-import'`(nav.ts:216), nav item key 동일(nav.ts:141). **PASS.**
- 프론트 가드: `isHrAdmin(user.role)` → 아니면 `<Forbidden>`(page.tsx:286,409). **PASS.**
- 백엔드 가드: `@Controller('excel') @Roles(Role.hr_admin)`(controller:32-33) — 클래스 레벨이라 import/kpi·preview 모두 적용. **PASS (보안 가드 존재, 프론트만 숨긴 결함 아님).**

---

## 5. 상태/엣지 케이스

| 케이스 | 계약 | 백엔드 구현 | 판정 |
|------|------|------|------|
| userId 없음 → 400 | §4-2 | controller:104 `BadRequestException` | PASS |
| user 없음 → 404 | §6 | service:955-958 `NotFoundException` | PASS |
| cycleId 생략 → 활성 사이클 | §4-2 | service:961-963 `status: active` 폴백 | PASS |
| 활성 사이클 없음 → 400 | §4-2 | service:964-969 | PASS |
| 멱등(draft 삭제 후 생성) | §4-2 | service:977-1004 트랜잭션 `deleteMany status=draft` 후 create | PASS |
| 제출/승인 KPI 보존 | §4-2 | `status: KpiStatus.draft` 한정 삭제 → submitted/approved 보존 | PASS |
| 가중치합 경고만(차단X) | §4-2 | service:1006-1010 weightSum≠100 시 warnings push, 적재는 진행 | PASS |
| validateWeights 우회 | §4-2 | importKpi 가 validateWeights 호출 안 함 | PASS |
| KPI 작성 잠금 미적용 | §6 | assertKpiWritable 호출 없음 | PASS |

> 참고(설계 일치): 가중치 누락 행은 `weight:0` 으로 적재(service:996, parseKpiSheet:896-900 경고). valid=true 라 적재 대상에 포함됨 — 계약 "가중치 누락은 경고" 와 일치. title 누락 행만 valid=false 로 제외(service:892-895, importKpi validRows 필터 974). **PASS.**

---

## 6. 감사 라벨 동기화

- 백엔드 `AUDIT_ACTION_LABEL['kpi.import'] = 'KPI 일괄 등록'`(excel.service:44).
- 프론트 `lib/ui.ts:348 'kpi.import': 'KPI 일괄 등록'`.
- 백엔드 record action `'kpi.import'`(service:1015). **PASS, 3곳 일치.**

---

## 7. 스키마·DTO 신규필드 통과

- schema.prisma:346,350 `targetText`/`gradingCriteria` nullable + migration `20260605073627` `ADD COLUMN ... JSONB / TEXT`. **PASS.**
- kpi.dto.ts:55,73(create), 89,93(update) 신규필드 선언. kpis.service.ts:126,130(create) 163,167(update) 통과. **PASS.**

---

## 결함 상세

### MAJOR-1 — preview `rows[].weight` 타입 불일치 (null 누락)
- 생산자: `apps/api/src/modules/excel/excel.service.ts:863-865`(parseKpiSheet 반환 타입 `weight: number | null`), `824-831`(extractKpiWeight 가중치 없으면 `null` 반환), `909`(rows 에 null 그대로 push).
- 소비자: `apps/web/lib/types.ts:1072` `weight: number;` (null 불가로 선언).
- 사용처: `apps/web/app/(main)/admin/kpi-import/page.tsx:206` `{row.weight}%` → 가중치 미기입 행은 `null%` 로 렌더(가중치 비어있는 경고행에서 발생). weightSum 은 백엔드가 `?? 0` 처리(service:926)라 합계는 정상이나, 표 셀만 깨짐.
- 수정방법(프론트 담당): types.ts:1072 를 `weight: number | null;` 로 변경하고, page.tsx:206 을 `{row.weight ?? 0}%` 또는 `{row.weight == null ? '–' : `${row.weight}%`}` 로 가드.

### MINOR-1 — preview `fileName` nullable 차이
- 생산자: excel.service.ts:929 `fileName: fileName ?? null` (string\|null). 컨트롤러는 `file.originalname` 항상 전달(controller:88)이라 실제로는 항상 string.
- 소비자: types.ts:1080 `fileName: string`.
- 영향: 화면 미사용(preview.fileName 참조 없음). 타입만 낙관적. 수정 선택: types 를 `string | null` 로 맞추거나 백엔드가 `fileName ?? ''`. 우선순위 낮음.

### MINOR-2 — preview `rows[].gradingCriteria` 타입 구조 차이
- 생산자: excel.service.ts:834-842 `Record<string,string> | null` — 빈 경우 `null`, 값 있는 키만 포함(부분 객체, 예 `{S:'...',A:'...'}`).
- 소비자: types.ts:1073 `gradingCriteria: KpiGradingCriteria`(S~D 5키 전부 `string|null` 필수, 객체 null 불가).
- 사용처: page.tsx:209 `row.gradingCriteria?.[g] ?? '–'` — optional chaining + `?? '–'` 로 null·누락키 모두 안전 처리됨. **런타임 영향 없음**, 타입 선언만 부정확.
- 수정방법(프론트 담당): types.ts:1073 을 `gradingCriteria: KpiGradingCriteria | null;` 로 변경(키 부분성도 감안하려면 `Partial<Record<Grade,string>> | null`). page.tsx 코드는 그대로 안전.

### MINOR-3 — import 응답 `fileName` 미반환
- 생산자: excel.service.ts:1020-1031 importKpi 응답에 `fileName` 키 없음.
- 소비자: types.ts:1093 `fileName: string`(필수 선언). 계약 §4-2 예시 응답에는 `"fileName":"..."` 포함됨.
- 사용처: page.tsx ResultCard 는 `r.fileName` 미사용 → 런타임 무해. 계약·타입과 구현 불일치만.
- 수정방법: (택1) 백엔드 importKpi 응답에 `fileName` 추가(컨트롤러에서 originalname 전달 필요) — 계약 §4-2 준수; (택2) types.ts:1093 에서 `fileName` 제거 또는 optional. 계약이 fileName 을 명시하므로 **백엔드 추가**가 계약 정합. 우선순위 낮음(미사용).

---

## 회귀(regression)

- 기존 임포트 경로(import/org·roster·legacy-results·achievements·templates) 와 응답 shape 충돌 없음. `uploadExcel<T>` 제네릭으로 분리 호출. **회귀 없음.**

## 종합 판정

릴리스 게이트: **조건부 통과**. blocker 0. MAJOR-1(가중치 null 셀 렌더 깨짐) 1건만 프론트에서 수정하면 정합. 나머지 minor 3건은 타입 선언 정확화(런타임 무해)로 후속 정리 가능.
