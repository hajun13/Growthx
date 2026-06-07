# 개인별 KPI 엑셀 일괄 임포트 — 계약 스펙 (SSOT, 2026-06-05)

> 백엔드·프론트 공유 단일 기준. 응답 봉투·camelCase 규약은 `api-contract-convention.md` 준수.
> 이 문서를 backend-engineer 가 canonical `contract.md` 에 반영한다.

## 0. 배경

올해(2026) 전 직원이 회사 표준 KPI 엑셀 양식으로 작성·제출(1인 1파일). 이를 사이트의 개인별 `Kpi`
레코드로 일괄 적재한다. 내년부터는 같은 필드를 사이트에서 직접 작성. **적재 상태 = draft.**
샘플: `C:\Users\user\Downloads\26년도 KPI 경영그룹 제출\*.xlsx` (9명, 1인1파일).

## 1. 엑셀 양식 구조 (위치 기반 파싱 — rowsToObjects 불가)

- 시트명: `개인별  KPI작성` (공백 2개 주의). 못 찾으면 첫 시트 폴백. `Sheet1` 등 빈 시트 무시.
- 헤더: 5~7행 병합 2단 구조. **데이터는 8행부터.**
- 종료 조건: C열(핵심전략)이 비었거나 "KPI는 다음 두 영역" 같은 안내문 행을 만나면 중단.
  안전하게: C열 값이 유효 카테고리로 매핑되지 않으면 그 행은 데이터 끝으로 간주(또는 skip+무시).
- 컬럼(1-indexed):

| 열 | 인덱스 | 의미 | 매핑 |
|----|--------|------|------|
| C | 3 | 핵심전략 | `category` (한글→enum, 아래 §2) |
| D | 4 | 전략목표(CSF) | `csf` |
| E | 5 | 성과관리지표(KPI) | `title` (필수) |
| F | 6 | 2026년 목표(서술형) | `targetText` (신규 필드) |
| G | 7 | 측정방식(서술형) | `measureMethod` |
| H | 8 | 가중치-본부장 | 가중치 후보1 |
| I | 9 | 가중치-팀장 | 가중치 후보2 |
| J | 10 | 가중치-5년차이상 | 가중치 후보3 |
| K | 11 | 가중치-5년차미만 | 가중치 후보4 |
| L | 12 | 등급기준 S | `gradingCriteria.S` |
| M | 13 | 등급기준 A | `gradingCriteria.A` |
| N | 14 | 등급기준 B | `gradingCriteria.B` |
| O | 15 | 등급기준 C | `gradingCriteria.C` |
| P | 16 | 등급기준 D | `gradingCriteria.D` |

- **가중치**: H~K 4칸 중 **채워진 한 칸**의 값(소수 0.1~0.3)을 사용 → `Math.round(v*100)` → 정수 %.
  - 여러 칸이 채워졌으면: 0이 아닌 값 중 첫 칸 사용하되, 행마다 1칸만 채워지는 게 정상. 0/'-'/공백은 무시.
  - 합계행(예: J13=1, K15=1)은 카테고리 매핑 실패로 자연 제외됨.
- **measureType**: 양식의 측정방식이 전부 서술형 → 적재 시 **`qualitative` 고정, `isQualitative=true`**.
- **targetValue**: F열은 서술형 → `targetValue=null`, 텍스트는 `targetText` 에 저장.

## 2. 핵심전략(한글) → KpiCategory / KpiGroup 매핑

| 핵심전략 텍스트(정규화: 공백·개행·`&` 주변 제거) | category | group |
|----|----|----|
| 매출액 | `revenue` | `performance_core` |
| 공정액 | `construction` | `performance_core` |
| 수주&업무수행성과 / 수주 & 업무수행성과 / 업무수행성과 / 업무수행평가 / 업무수행 / 수주 | `orders` | `performance_core` |
| 협업성과 / 협업 | `collaboration` | `collaboration_growth` |
| 자기개발 / 자기계발 | `development` | `collaboration_growth` |

- 정규화: `replace(/\s/g,'').replace(/&/g,'')` 후 `includes` 매칭. 미매칭 행 → 데이터 끝/무시(에러 아님).

## 3. 스키마 보강 (Prisma `Kpi` 모델)

신규 필드 2개 추가(둘 다 nullable, 기존 데이터 안전):

```prisma
model Kpi {
  // ... 기존 필드 유지 ...
  targetText       String?  @map("target_text")        // 서술형 2026 목표(F열). targetValue(숫자)와 병존.
  gradingCriteria  Json?    @map("grading_criteria")   // 정성 등급기준 {S,A,B,C,D} 텍스트(L~P열). 기존 grading(건수 임계값)과 별개.
  // ...
}
```

- 마이그레이션 생성(`prisma migrate dev --name kpi_qualitative_grading` 또는 배포용 `migrate`).
- DTO(`evaluation.dto`/`kpi` dto)에도 `targetText?`, `gradingCriteria?` 반영 — KPI 단건 생성/수정·조회 직렬화에 노출.
- 기존 KPI 작성 화면(프론트)은 이번 범위 아님(추후). 단, KPI 조회/상세 응답에 신규 필드 포함되도록 직렬화만 확장.

## 4. API 엔드포인트 (hr_admin 전용, 기존 `/excel/import/*` 패턴)

multipart/form-data, 필드명 `file`. `@Roles(Role.hr_admin)`.

### 4-1. 미리보기 (적재 안 함)
```
POST /excel/import/kpi/preview
  Content-Type: multipart/form-data
  body: file=<xlsx>
응답 200:
{ "data": {
    "fileName": "26년 KPI(양식)_경영그룹_재무팀_어라윤선임 (2).xlsx",
    "rows": [
      { "category":"orders", "group":"performance_core", "csf":"세무신고 정확성 강화",
        "title":"세무신고 오류율/신고기한 준수율", "targetText":"수정신고 0건 유지",
        "measureMethod":"국세청 제출 기록 확인", "weight":10, "isQualitative": false,
        "gradingCriteria":{"S":"기한 준수100%...","A":"...","B":"...","C":"...","D":"..."},
        "valid": true, "message": null }
    ],
    "validCount": 6, "errorCount": 0, "weightSum": 100,
    "errors": [ { "row": 9, "message": "가중치가 비어 있어요." } ]
} }
```
- 파일 1개 파싱 결과만 반환. 대상자 매칭/저장 안 함. 프론트가 이 결과로 미리보기 표 + 가중치합 경고 표시.
- **`isQualitative`(2026-06-08 신규)**: 정성/정량 **제안값**(휴리스틱) — 등급기준(S~D) 텍스트에 수치 토큰
  (`%`·`숫자+건/일/억/회/개/점/명/원/만/천`·임의 숫자)이 전혀 없고 서술 문장만 있으면 `true`(정성),
  그 외(또는 등급기준 비었으면 보수적으로) `false`(정량). **어디까지나 제안** — 관리자가 화면에서 토글로
  override 한 값이 `§4-4 commit` 의 `row.isQualitative` 로 적재된다.

### 4-2. 적재 (draft 생성)
```
POST /excel/import/kpi?userId=<uuid>&cycleId=<uuid>
  body: file=<xlsx>
```
- `userId` 필수(대상자 — 프론트에서 파일마다 수동 선택). 없으면 400.
- `cycleId` 선택 — 생략 시 활성(현재) 사이클 자동 사용. 활성 사이클 없으면 400.
- **멱등(재업로드 안전)**: 트랜잭션에서 `(userId, cycleId)` 의 **status=draft 인 기존 KPI 삭제 후** 신규 생성.
  (제출/승인된 KPI는 보존). 이렇게 같은 파일 재업로드 시 중복 누적 방지.
- 각 행 → `Kpi.create`: userId, cycleId, category, group, title, csf, targetText, measureMethod,
  measureType=`qualitative`, isQualitative=true, weight, gradingCriteria(Json), status=`draft`.
- 가중치 합 검증: 그룹 합/정성 상한은 **경고만**(차단 안 함) — 올해 양식은 정성 100% 합이라
  기존 `validateWeights`(정성≤30) 와 충돌. **임포트 경로는 weight 합 검증 우회**, 합계만 응답에 표기.
- 감사 로그: `audit.record({ entity:'Kpi', action:'kpi.import', actorId, after:{userId,cycleId,imported} })`.
  (action 라벨 `kpi.import` = 'KPI 일괄 등록' 을 excel.service AUDIT_ACTION_LABEL · 프론트 lib/ui.ts 에 추가)
- 응답 200:
```
{ "data": {
    "ok": true, "userId":"...", "cycleId":"...", "fileName":"...",
    "imported": 6, "deletedDrafts": 0, "weightSum": 100,
    "errors": [], "warnings": ["가중치 합이 100%가 아니에요(현재 90%)."]
} }
```

### 4-4. 편집 적재 (화면에서 편집한 행 적재 — JSON body) [2026-06-08 신규]

미리보기(`§4-1`) 결과를 관리자가 화면에서 ①정성/정량 토글, ②엑셀 누락분 보완·수정한 뒤
**편집된 행 그대로** 적재한다. 파일을 재파싱하지 않으므로 화면 편집이 100% 반영된다.
기존 `§4-2`(파일 재파싱 경로)는 하위호환으로 **유지**.

```
POST /excel/import/kpi/commit        ← multipart 아님, application/json
  Content-Type: application/json
  @Roles(hr_admin)
```

요청 body:
```jsonc
{
  "userId": "uuid",          // 필수
  "cycleId": "uuid",         // 선택 — 생략 시 활성 사이클(없으면 400)
  "fileName": "26년 KPI(양식)_경영그룹_재무팀_어라윤선임.xlsx",  // 선택(표시용)
  "rows": [
    {
      "category": "orders",            // revenue|construction|orders|collaboration|development
      "group": "performance_core",     // performance_core|collaboration_growth
      "csf": "세무신고 정확성 강화",      // 선택
      "title": "세무신고 오류율/준수율",  // 필수 — 빈 행은 스킵 + warning
      "targetText": "수정신고 0건 유지",  // 선택
      "measureMethod": "국세청 제출 기록", // 선택
      "weight": 10,                     // 0~100 정수
      "isQualitative": true,            // 관리자 토글(정성/정량)
      "gradingCriteria": { "S": "...", "A": "...", "B": null, "C": null, "D": null } // 선택
    }
  ]
}
```

동작:
- `§4-2` importKpi 의 멱등 트랜잭션·audit·결과 shape 를 **그대로 재사용**(파싱만 생략).
- (userId, cycleId) status=`draft` 기존 KPI **삭제 후** rows 를 draft 로 생성.
- 각 KPI: `measureType=qualitative`(상수), `isQualitative=row.isQualitative`(토글값), `targetValue=null`,
  category/group/csf/title/targetText/measureMethod/weight/gradingCriteria 매핑. csf/targetText/measureMethod
  빈칸은 null 로, gradingCriteria 빈칸·'-'·null 은 제거(남은 게 없으면 null).
- `title` 빈 행은 **스킵 + warning**. `weightSum≠100` 이면 **warning**(차단 안 함). validateWeights 우회(§4-2 동일).
- 감사 로그: `action: 'kpi.import.commit'`(라벨 'KPI 일괄 등록(편집 적재)').

응답 200 (data shape = `§4-2` `KpiImportResult` 와 동일):
```jsonc
{ "data": {
    "ok": true, "userId": "...", "cycleId": "...", "fileName": "...",
    "imported": 6, "deletedDrafts": 0, "weightSum": 100,
    "errors": [], "warnings": ["가중치 합이 100%가 아니에요(현재 90%)."]
} }
```

에러: userId 미존재 404 `NOT_FOUND` · userId 누락(또는 활성 사이클 없음) 400 `VALIDATION_ERROR` ·
미인증 401 · 권한부족(비 hr_admin) 403.

### 4-3. 빈 양식 다운로드 (선택, 있으면 좋음)
- `GET /excel/template/kpi` — 실제 양식 구조와 동일한 빈 .xlsx. (TemplateKind 에 `kpi` 추가)
- 단, 양식이 병합 2단 헤더라 기존 `buildTemplate`(단일 헤더) 로직과 달라 별도 빌더 필요.
  우선순위 낮음 — 시간 부족 시 생략하고 "회사 표준 양식 사용" 안내로 대체 가능.

## 5. 프론트 업로드 화면

- 위치: 관리자 영역. 기존 평가주기/명부 임포트와 같은 맥락 — `apps/web/app/(main)/admin/` 하위.
  KPI 일괄 등록 전용 페이지(예: `/admin/kpi-import`) 또는 기존 cycle/users 페이지 내 패널.
  사이드바·권한(hr_admin) 가드 기존 패턴 따름.
- 흐름(다중 파일, 파일별 수동 대상자 선택):
  1. 여러 .xlsx 선택(드래그&드롭, 다중) → 파일 목록 행으로 표시.
  2. 각 파일 행: [파일명] [대상자 선택 드롭다운/검색] [미리보기 버튼] [상태].
     - 대상자 선택: 기존 사용자 목록 API(활성 사용자) 사용. 검색형 콤보박스 권장(9명~수십명).
     - 파일명에서 이름 추정해 **기본 후보를 제안**(선택, 편의) 하되 확정은 사용자가.
  3. 미리보기: `POST /excel/import/kpi/preview` → 파싱된 KPI 표(핵심전략·KPI·목표·가중치·등급기준) +
     가중치합·오류행 표시.
  4. 각 파일 [적재] 또는 일괄 [전체 적재]: 파일마다 `POST /excel/import/kpi?userId&cycleId` 순차/병렬 호출.
  5. 결과 요약: 파일별 imported/오류/경고. 적재 후 "검토(draft)" 안내 — 해당 사용자의 KPI 목록/승인 화면 링크.
- 타입: `apps/web/lib/types.ts` 에 `KpiImportPreview`, `KpiImportRow`, `KpiImportResult` 추가(응답 shape과 1:1).
- 데이터 훅: 기존 fetch 래퍼(`res.data` unwrap) 일관 사용. cycleId 는 활성 사이클에서.

## 6. 권한·검증

- 전 엔드포인트 `hr_admin` 전용(기존 ExcelController @Roles 동일).
- 파일: .xlsx, 5MB 제한(기존 FileDropzone 규약).
- 대상 userId 존재·활성 확인. 없으면 404.
- KPI 작성 잠금(`cycleLock.assertKpiWritable`)은 임포트(관리자 대리 일괄)에는 **적용하지 않음**
  (관리자 운영 행위). 단 cycle 존재는 확인.

## 7. 산출물

- 백엔드: schema.prisma + migration, excel.service(importKpi/previewKpi + 매핑 헬퍼), excel.columns(KPI 매핑/양식),
  excel.controller(2~3 엔드포인트), DTO/직렬화 신규필드, 감사라벨. progress 노트 `_workspace/03_backend/`.
- 프론트: 업로드 화면 + 컴포넌트 + 타입 + 훅. progress 노트 `_workspace/04_frontend/`.
- QA: 경계면 교차검증 리포트 `_workspace/05_qa/qa-report-kpi-import.md`.
```
