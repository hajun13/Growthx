# API 계약 델타 — 연도 누적(YoY) 평가 비교 시스템

> 기준 계약: [contract.md](contract.md). 본 문서는 그 위의 **델타**다. 충돌 시 본 문서 우선(이 기능 한정).
> 응답 봉투(`{data}`/`{data,meta}`/`{error}`)·camelCase·RBAC(visibilityScope) 규약은 기존과 동일.
> 작성: backend-engineer · 합의 대상: frontend-engineer ∥ qa-inspector
> 출처 요구사항: [_workspace/00_input/requirements-yoy.md](../00_input/requirements-yoy.md)

---

## 0. 한눈에 보기 (엔드포인트)

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| POST | `/api/v1/excel/import/legacy-results?cycleId=` | hr_admin | `평가자정리` 시트 임포트(과거결과 적재). cycleId 생략 시 2025 사이클 자동탐색 |
| GET | `/api/v1/results/compare?userId=&cycleIds=` | 인증(행수준) | 개인 연도별 결과 타임라인(N 사이클) |
| GET | `/api/v1/results/distribution?scope=&deptId=&cycleIds=&legalEntity=` | 인증(행수준) | 사이클별 등급분포(S~D 카운트·비율) |
| GET | `/api/v1/cycles?year=&status=` | 인증 | (기존 확장) `year`·`status` 필터 — 비교 가능한 사이클 선택용 |

> 신규 임포트는 기존 `excel` 컨트롤러(`@Roles(hr_admin)`)에 라우트 1개 추가. 비교 2종은 기존 `results` 컨트롤러에 추가.

---

## 1. 신규/변경 enum (Prisma + 응답)

```jsonc
// 응답에는 enum 문자열 그대로(camelCase 불필요 — enum 값은 snake_case 소문자 유지, 기존 role/position과 동일 관례)
LegalEntity      = "energyx" | "mirae_plan"          // 4대보험 소속(법인). 기본 energyx
EmploymentStatus = "active" | "on_leave" | "resigned" // 재직/휴직/퇴사. 기본 active
```

- `User`에 `legalEntity`(기본 `energyx`), `employmentStatus`(기본 `active`), `resignedAt`(`string|null` ISO8601) 추가.
- 응답에서 법인 한글 라벨은 프론트가 매핑: `energyx`→"에너지엑스㈜", `mirae_plan`→"미래환경플랜".

---

## 2. 조직 스냅샷 + 라운드별 원형 점수 (EvaluationResult 확장)

`EvaluationResult`에 **당시 조직 스냅샷** 3필드와, 라운드별 실적·역량 원형은 기존 `byType` Json을 확장해 보존한다.

```jsonc
// EvaluationResult 응답(확장 필드 굵게):
{
  "id": "...", "userId": "...", "cycleId": "...",
  "finalGrade": "A", "finalScore": 92.38, "percentile": 34.1,
  "userName": "오재용", "departmentName": "환경평가팀",
  "groupSnapshot": "친환경기술그룹",      // ← 추가(당시 그룹)
  "divisionSnapshot": "환경평가본부",      // ← 추가(당시 본부, 없으면 null)
  "teamSnapshot": "환경평가팀",            // ← 추가(당시 팀, 없으면 null)
  "byType": {
    // 기존 라이브 집계 구조(self/downward1/downward2)와 호환. 임포트 결과는 라운드별 원형을 담는다:
    "round1": { "perf": 96,   "comp": 84.25 },   // 1차평가 실적·역량(없으면 null)
    "round2": { "perf": 96,   "comp": 84.75 },   // 2차평가(미실시 시 null)
    "final":  { "perf": 96,   "comp": 82 },       // 최종평가 실적·역량
    "source": "import"                             // "import" | "aggregate" (출처 구분)
  },
  "byGroup": { ... },         // 기존 라이브 집계용(임포트는 null 가능)
  "companyAvg": 88.3,
  "createdAt": "...", "updatedAt": "..."
}
```

> **역량(comp)은 참고용**(연봉·최종등급 미반영). `finalScore`/`finalGrade`는 **실적 기준**(원본 우선). 라이브(2026) 집계가 만드는 `byType.self/downward1/downward2`와 임포트가 만드는 `byType.round1/round2/final`은 **공존**한다. 소비 측은 `byType.source`로 분기하거나 키 존재 여부로 판별한다.

---

## 3. 과거결과 임포트

### POST `/api/v1/excel/import/legacy-results?cycleId=<id>`
- 권한: `hr_admin`
- 업로드: `multipart/form-data`, field `file` (xlsx). `평가자정리` 시트 파서.
- 쿼리 `cycleId`(선택): 미지정 시 `year=2025` 사이클을 자동 탐색(없으면 400).
- 헤더 2단(4·5행) 처리 + 데이터 6행~. 날짜 정규화(Excel serial number + 텍스트 혼재).
- 멱등: 같은 `(userId, cycleId)` 결과는 **upsert(덮어쓰기)**. 재임포트 안전.
- **이름 매칭 3분기:**
  - **재직(matched):** 현재 User(이름) 단일 매칭 → 결과만 연결. 매칭 User의 `legalEntity`도 엑셀 기준 갱신.
  - **퇴사(resigned):** 매칭 실패 → `isActive=false` + `employmentStatus="resigned"` User 생성(placeholder 이메일 `{slug}+resigned@import.local`), `legalEntity`·`position`·당시 조직 스냅샷 채움.
  - **검토큐(review):** 이름 다중 매칭 → 그룹/본부 보조매칭. 그래도 모호하면 미해결 행으로 분리(결과 미적재).
- 응답 200:
```jsonc
{ "data": {
  "ok": true,
  "cycleId": "...",
  "total": 88,                 // 데이터 행 수
  "imported": 86,              // EvaluationResult 적재 수
  "matched": 86,               // 재직 매칭
  "createdResigned": 2,        // 퇴사 User 신규 생성
  "reviewQueue": 0,            // 검토 필요(미적재) 행 수
  "review":  [ { "row": 12, "name": "홍길동", "reason": "동명이인(2명) — 그룹/본부로도 모호" } ],
  "errors":  [ { "row": 50, "message": "성명이 비어 있어요." } ],
  "legalEntityUpdated": 73     // 재직자 legalEntity 갱신 수
} }
```
- 검증 오류행(`errors`)은 적재 제외하되 나머지는 진행(부분 성공). `ok`는 `errors.length===0 && reviewQueue===0`.

> **양식 다운로드 불필요**(원본 고정 레이아웃). `excel/template/:kind`에는 추가하지 않는다.

---

## 4. 연도 비교 API

### GET `/api/v1/results/compare?userId=<id>&cycleIds=<id,id,...>`
- 권한: 인증. 행수준 — `hr_admin` 전체 · 본인 · 상위 평가자(가시 범위: 팀장→팀, 본부장→본부). 권한 밖 `userId` → 403. `userId` 생략 시 본인.
- `cycleIds`(선택, 콤마구분): 생략 시 해당 user가 결과를 가진 **전 사이클**(연도 오름차순).
- 응답 200:
```jsonc
{ "data": {
  "userId": "...",
  "userName": "오재용",
  "employmentStatus": "active",            // 퇴사 뱃지용
  "legalEntity": "energyx",
  "timeline": [
    {
      "cycleId": "...", "cycleName": "2025년 정기평가", "year": 2025,
      "finalGrade": "A", "finalScore": 92.38, "percentile": 34.1,
      "perf": 96, "comp": 82,                // 실적·역량 원형(역량 참고용, null 가능)
      "org": { "group": "친환경기술그룹", "division": "환경평가본부", "team": "환경평가팀" },
      "ruleSummary": {                        // 규칙 차이 표면화(절대점수 직접비교 강요 X)
        "competencyIncluded": true,           // 역량 점수가 산정에 반영됐는지(2025=false: 참고만)
        "gradeScaleLabel": "S96·A91·B85·C80·D<80",
        "source": "import"
      }
    }
    // year 오름차순. 한 해 결과가 없으면 그 사이클은 timeline에서 생략.
  ]
} }
```
- **규칙 정규화:** `finalGrade`(S~D)·`finalScore`(0~100)를 공통축으로 노출. 규칙 차이는 `ruleSummary`로만 메타 제공.

### GET `/api/v1/results/distribution?scope=group|division|team&deptId=<id>&cycleIds=<...>&legalEntity=<energyx|mirae_plan>`
- 권한: 인증. 행수준 — hr_admin 전체. 그 외는 `visibilityScope` 부서로 제한(권한 밖 `deptId` → 403).
- `scope`(선택, 기본 `group`): 집계 분모 조직 단위.
- `deptId`(선택): 특정 조직만. 생략 시 가시 범위 내 전 조직(스냅샷 기준).
- `legalEntity`(선택): 법인 필터(에너지엑스/미래환경플랜).
- `cycleIds`(선택): 생략 시 결과가 있는 전 사이클.
- 집계는 **조직 스냅샷**(당시 조직명) 기준 — 조직개편 무관.
- **빈 결과 의미(QA WARN #6 확정):** `deptId`는 서버에서 **부서명으로 변환 후 스냅샷명과 문자열 매칭**한다. 스냅샷명이 현재 부서명과 다르거나(조직개편·임포트 표기 차이), 해당 scope의 스냅샷 정보가 없는 결과는 **버킷에서 제외**된다 — 이 경우 `cycles[].buckets`가 `[]`(또는 cycle 자체가 누락)일 수 있다. **이름 매칭이 계약(스냅샷 기준 집계의 의도)이며 백엔드는 변경하지 않는다.** 소비 측은 `buckets.length === 0`(또는 `cycles.length === 0`)을 "해당 조직·사이클에 매칭되는 스냅샷 결과 없음" 빈상태로 처리한다(매칭 힌트 필드는 과설계로 미추가).
- 응답 200:
```jsonc
{ "data": {
  "scope": "group",
  "cycles": [
    {
      "cycleId": "...", "cycleName": "2025년 정기평가", "year": 2025,
      "buckets": [
        {
          "deptName": "친환경기술그룹",         // 스냅샷 조직명(당시)
          "total": 40,
          "counts": { "S": 1, "A": 24, "B": 10, "C": 3, "D": 2 },
          "ratios": { "S": 2.5, "A": 60, "B": 25, "C": 7.5, "D": 5 }   // % (소수1)
        }
      ],
      "overall": {                              // 해당 사이클 전체(필터 적용 후)
        "total": 88,
        "counts": { "S": 3, "A": 48, "B": 25, "C": 8, "D": 4 },
        "ratios": { "S": 3.4, "A": 54.5, "B": 28.4, "C": 9.1, "D": 4.5 }
      }
    }
  ]
} }
```

---

## 4-1. 임포트 결과 표시 정책 (`byType` 두 shape · source 분기) — 리더 확정

평가결과 상세/단건 응답(`GET /results/:userId?cycleId=`, `GET /results` 목록)의 `byType`은 **두 가지 공존 shape**를 가지며, 소비 측은 **반드시 `byType.source`로 분기**한다. 서버는 어느 shape든 `source`를 보장해 내려준다.

### byType 두 shape

```jsonc
// (A) 라이브 집계(2026~) — aggregate 가 생성. source:"live".
"byType": {
  "self":      { "score": 88.0, "grade": "B", "comment": "..." },  // 참고
  "downward1": { "score": 91.5, "grade": "A", "comment": "..." },  // 1차 팀장
  "downward2": { "score": 92.0, "grade": "A", "comment": "..." },  // 2차 본부장
  "downward3": { "score": null, "grade": null, "comment": null },  // (있으면) 대표
  "source": "live"                                                 // ← 판별자
}

// (B) 임포트(legacy 2025) — excel import 가 생성. source:"import".
"byType": {
  "round1": { "perf": 96, "comp": 84.25 },   // 1차평가 실적·역량(없으면 null)
  "round2": { "perf": 96, "comp": 84.75 },   // 2차평가(미실시 null)
  "final":  { "perf": 96, "comp": 82 },       // 최종평가 실적·역량
  "source": "import"                          // ← 판별자
}
```

### 계약 규칙 (확정)

1. **임포트 결과는 라이브 평가자 키(`self`/`downward1`/`downward2`/`downward3`)를 가지지 않는다.** 이것이 정상이며, 서버는 임포트 결과에 라이브 키를 **가짜로 채우지 않는다.**
2. **`source`는 항상 존재한다.** 상세/단건/목록 응답을 직렬화하는 `ResultsService.toDto`가 `source`를 손실 없이 전달한다. 영속 데이터에 `source`가 누락된 경우(과거 라이브 집계 등) 응답 시 **`source:"live"`를 기본 주입**한다(임포트는 항상 `source:"import"`를 기록하므로 누락 ⇒ 라이브로 안전 판정).
3. **소비 측(프론트) 분기:**
   - `byType.source === "import"` → 라운드별 실적·역량 요약(`round1/round2/final`의 `perf`/`comp`)을 렌더. **역량(comp)은 참고용**(최종등급·연봉 미반영). 평가자 코멘트 분해 UI는 표시하지 않는다.
   - `byType.source === "live"`(또는 그 외/누락) → 기존 라이브 상세 화면(`self`/`downward1`/`downward2` 코멘트 분해)을 렌더.
4. **비회귀 보장:** 라이브 결과의 응답 동작·키는 불변. `source` 키 추가만 더해진다(기존 프론트가 무시해도 안전).

> 본 절은 QA [HIGH] #5(임포트 결과를 라이브 상세 화면이 `self/downward*` 단정으로 로드해 크래시) 해소를 위한 명문화다. 프론트는 `source`로 렌더 분기한다(프론트 별도 수정).

---

## 5. 2025 사이클 + 전용 RuleSet (seed, 멱등)

- `EvaluationCycle(name:"2025년 정기평가", year:2025, cycleType:FINAL, status:closed)` — 멱등 upsert(`year=2025` 탐색).
- 전용 `RuleSet`: `gradeScale`은 보수적(원본 등급 우선), `weightPolicy.competencyIncluded=false`(역량 참고용·연봉 미반영 플래그). gradeScale/raiseRates 등은 2026 기본과 동일 구조.
- seed.ts 멱등 블록(재실행 안전). 기존 2026 사이클·데이터 불변.

---

## 6. 프론트 타입 (lib/types.ts 반영 권장)

```ts
export type LegalEntity = "energyx" | "mirae_plan";
export type EmploymentStatus = "active" | "on_leave" | "resigned";

export interface CompareTimelineEntry {
  cycleId: string; cycleName: string; year: number;
  finalGrade: string | null; finalScore: number | null; percentile: number | null;
  perf: number | null; comp: number | null;
  org: { group: string | null; division: string | null; team: string | null };
  ruleSummary: { competencyIncluded: boolean; gradeScaleLabel: string; source: string };
}
export interface CompareResult {
  userId: string; userName: string;
  employmentStatus: EmploymentStatus; legalEntity: LegalEntity;
  timeline: CompareTimelineEntry[];
}
export interface DistributionBucket {
  deptName: string; total: number;
  counts: Record<"S"|"A"|"B"|"C"|"D", number>;
  ratios: Record<"S"|"A"|"B"|"C"|"D", number>;
}
export interface DistributionCycle {
  cycleId: string; cycleName: string; year: number;
  buckets: DistributionBucket[];
  overall: { total: number; counts: Record<string, number>; ratios: Record<string, number> };
}
export interface DistributionResult { scope: string; cycles: DistributionCycle[]; }
export interface LegacyImportReport {
  ok: boolean; cycleId: string; total: number; imported: number;
  matched: number; createdResigned: number; reviewQueue: number;
  review: { row: number; name: string; reason: string }[];
  errors: { row: number; message: string }[];
  legalEntityUpdated: number;
}
```

---

## 7. 검증 포인트(QA)

- 임포트 멱등: 재실행 시 imported 동일, 중복 EvaluationResult 없음.
- 매칭 3분기 정확성: matched + createdResigned + reviewQueue + errors = total.
- 퇴사 User: `isActive=false`·`employmentStatus=resigned`·placeholder 이메일·조직 스냅샷 채움. 조직도(/org-chart, /users)에서 숨김(isActive 필터) 유지.
- compare/distribution 응답 봉투·camelCase·행수준 권한(타인 userId·권한 밖 deptId → 403).
- distribution은 스냅샷 조직명 기준 집계(라이브 부서 변경에 영향 X).
- `byType` 라이브(self/downward) vs 임포트(round1/2/final) 키 공존 — 기존 결과 화면 비회귀. **`byType.source` 항상 존재**(임포트=`"import"`, 라이브=`"live"`, 누락 시 `toDto`가 `"live"` 기본 주입). 소비 측은 `source`로 분기(§4-1). 임포트 결과에 라이브 키 미주입 확인.
- distribution `buckets.length===0`/`cycles.length===0` 빈상태 — deptId↔스냅샷명 미스매치 시 정상(이름 매칭이 계약). 프론트 빈상태 처리 확인(§4 distribution 빈 결과 의미).
- 2025 seed 멱등 + 2026 사이클 불변.
