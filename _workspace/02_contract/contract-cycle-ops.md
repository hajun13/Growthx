# API 계약 델타 — 평가 운영 단계 모델 개편 (Cycle Ops)

> 기준 계약: [contract.md](contract.md). 본 문서는 그 위의 **델타**다. 충돌 시 본 문서 우선(이 기능 한정).
> 응답 봉투·camelCase·RBAC 규약은 기존과 동일.
> 작성: orchestrator(리더) · 합의 대상: backend-engineer ∥ frontend-engineer

---

## 1. 정규 단계(phase) 키 — 단일 출처

운영 타임라인 = KPI 라이프사이클. **정규 키와 순서:**

| 순서 | phase 키 | 한글 라벨 | 기본 윈도우(2026) | 기본 잠금 |
|------|----------|-----------|-------------------|-----------|
| 1 | `kpi_selection` | KPI 선정·작성 | 03/01 ~ 03/31 | 열림 (false) |
| 2 | `execution_h1` | 상반기 실행관리 | 04/01 ~ 06/09 | **잠금 (true)** |
| 3 | `mid_review` | 중간평가(재오픈) | 06/10 ~ 06/30 | 열림 (false) |
| 4 | `execution_h2` | 하반기 성과관리 | 07/01 ~ 11/30 | **잠금 (true)** |
| 5 | `final_review` | 최종평가 | 12/01 ~ 12/31 | 열림 (false) |

- **하위호환:** 기존 키(`prep`/`preparation`/`self`/`downward1`/`downward2`/`result`)의 라벨 매핑은 **유지**(과거 데이터 렌더). 단 신규 기본 단계 목록(`DEFAULT_PHASES`)·seed는 위 정규 키로 통일.
- **prep/preparation 버그:** seed가 쓰던 `preparation`은 정규 키로 대체. UI `DEFAULT_PHASES`의 `prep`도 정규 키로 대체. 두 곳이 같은 키를 쓰게 되어 고아 레코드 해소.
- **윈도우 불변식:** 앞 단계 `dueDate` < 다음 단계 `startDate`(겹침 금지). 빈 구간 없이 연속 — 잠금 기간이 자동 열림으로 새지 않도록.

---

## 2. 재오픈 사유 필수 + 감사로그

### PATCH /api/v1/cycles/:id/schedules/:phase  (잠금/열기 토글, 기존 확장)
- 권한: `hr_admin`
- 요청 body: `{ "isLocked": boolean, "reason"?: string }`
- **규칙:** `isLocked=false`(= 열기/재오픈)일 때 `reason`(trim 후 비어있지 않음) **필수**. 누락 시:
  - 400 `{ error: { code: "VALIDATION_ERROR", message: "재오픈 사유를 입력해 주세요." } }`
- `isLocked=true`(잠그기)일 때 `reason`은 선택.
- 감사로그: `AuditService.record({ entity: "CycleSchedule", entityId, action: isLocked ? "cycle.schedule.lock" : "cycle.schedule.unlock", before:{isLocked}, after:{ isLocked, reason } })`
- 응답 200: `{ data: CycleSchedule }`

> 프론트는 잠금 해제를 **이 단건 엔드포인트**로 처리(사유 모달). 일정 일괄저장(PATCH :id/schedules)은 날짜·알림만 다루고 isLocked는 단건 토글로 분리한다.
> (백엔드: 일괄 upsert의 isLocked는 기존 동작 유지하되, 재오픈 사유 강제는 단건 엔드포인트에서만 적용.)

---

## 3. 현재 단계 + 다음 열림 시점 (배너)

### GET /api/v1/cycles/:id/current-phase  (기존 확장)
- 권한: 인증
- 응답 200 `{ data: { ... } }` — **추가 필드 굵게**:
```jsonc
{
  "cycleId": "...",
  "phase": "execution_h1",
  "dueDate": "2026-06-09T23:59:59.000Z",
  "isLocked": true,
  "schedules": [
    { "phase": "kpi_selection", "startDate": "2026-03-01T...", "dueDate": "2026-03-31T...", "isLocked": false }
    // ↑ startDate 추가 (기존엔 phase/dueDate/isLocked만 있었음)
  ],
  "nextOpen": { "phase": "mid_review", "startDate": "2026-06-10T00:00:00.000Z" } // 또는 null
}
```
- **`nextOpen` 산출(백엔드):** 현재 잠금 중일 때, 스케줄 중 `isLocked=false`이고 시작이 미래인(`startDate ?? dueDate` > now) 가장 이른 단계. 없으면 `null`. 현재가 열림이면 `null` 가능.
- 미배포/스케줄 없음 → 기존처럼 `phase: null`(배너 미표시).

---

## 4. 1차 확정 KPI 스냅샷 + diff

### 신규 엔티티 `KpiSnapshot` (Prisma)
```prisma
model KpiSnapshot {
  id        String   @id @default(uuid())
  cycleId   String   @map("cycle_id")
  userId    String   @map("user_id")
  label     String                       // 예: "1차 확정"
  data      Json                          // 해당 시점 KPI 배열 직렬화(아래 SnapshotKpi[])
  createdBy String?  @map("created_by")
  createdAt DateTime @default(now()) @map("created_at")

  cycle EvaluationCycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  user  User            @relation(fields: [userId], references: [id])

  @@index([cycleId, userId])
  @@map("kpi_snapshots")
}
```
- `data`에 담는 `SnapshotKpi` 필드: `{ id, title, category, group, measureType, targetValue, weight, isQualitative, status }`.
- 마이그레이션 1건 추가(`kpi_snapshots`). EvaluationCycle·User에 역참조 relation 추가.

### POST /api/v1/cycles/:id/kpi-snapshots  (스냅샷 생성)
- 권한: `hr_admin`
- 요청 body: `{ "label": string, "userIds"?: string[] }`
  - `userIds` 생략 시: 해당 cycle에서 KPI를 가진 **모든 사용자**(또는 status가 approved/confirmed인 KPI 보유자) 대상.
- 동작: 대상 사용자별로 현재 KPI 배열을 캡처해 `KpiSnapshot` 1행씩 생성(같은 label 재실행 시 사용자별 **upsert/덮어쓰기** 권장 — 1차 확정은 보통 1회).
- 응답 201: `{ data: { label, count } }`  (count = 생성/갱신된 사용자 수)
- 감사로그: `entity:"EvaluationCycle", action:"cycle.kpi_snapshot.create", after:{label,count}`

### GET /api/v1/cycles/:id/kpi-snapshots?userId=<id>  (스냅샷 메타 목록)
- 권한: 인증 — 행수준: `hr_admin` 전체 · 본인(userId=self) · 상위 평가자(팀장→팀원, 본부장→본부). 권한 밖 userId 요청 시 403.
- `userId` 생략 시 본인 기준.
- 응답 200: `{ data: [ { id, label, createdAt, kpiCount } ], meta }`

### GET /api/v1/cycles/:id/kpi-snapshots/:snapshotId/diff  (diff)
- 권한: 위와 동일(스냅샷 소유 user 기준 행수준 검증).
- 동작: 스냅샷 `data`(과거) vs 해당 user의 **현재 KPI**(같은 cycle) 비교. id로 매칭.
- 응답 200:
```jsonc
{ "data": {
  "snapshotId": "...", "label": "1차 확정", "createdAt": "...",
  "userId": "...",
  "added":   [ { "id", "title", "category", "group", "measureType", "targetValue", "weight" } ],   // 현재에만 있음
  "removed": [ { "id", "title", ... } ],                                                            // 스냅샷에만 있음
  "changed": [ { "id", "title", "fields": [ { "field": "targetValue", "before": 1000, "after": 1200 } ] } ],
  "unchangedCount": 5
} }
```
- 비교 대상 필드: `title`, `category`, `group`, `measureType`, `targetValue`, `weight`, `isQualitative`.

### 컨트롤러/모듈 배치
- `cycles` 모듈에 `kpi-snapshots` 라우트를 둔다(SnapshotsService 신설, CyclesModule providers/exports에 등록). KPI 조회는 PrismaService 직접.

---

## 5. 프론트 타입 (lib/types.ts 반영)
```ts
export interface PhaseScheduleLite { phase: string; startDate: string | null; dueDate: string; isLocked: boolean; }
export interface CurrentPhase {
  cycleId: string; phase: string | null; dueDate: string | null; isLocked: boolean;
  schedules: PhaseScheduleLite[];
  nextOpen: { phase: string; startDate: string | null } | null;
}
export interface SnapshotKpi { id: string; title: string; category: string; group: string; measureType: string; targetValue: number | null; weight: number; isQualitative: boolean; status: string; }
export interface KpiSnapshotMeta { id: string; label: string; createdAt: string; kpiCount: number; }
export interface KpiDiffField { field: string; before: unknown; after: unknown; }
export interface KpiDiffItem { id: string; title: string; fields?: KpiDiffField[]; }
export interface KpiSnapshotDiff {
  snapshotId: string; label: string; createdAt: string; userId: string;
  added: KpiDiffItem[]; removed: KpiDiffItem[]; changed: KpiDiffItem[]; unchangedCount: number;
}
```

---

## 6. 화면 변경(프론트)
- **평가 운영(admin/cycle)**: `DEFAULT_PHASES`를 §1 정규 키로 교체. 잠금 토글은 단건 setLock 호출 + **재오픈 시 사유 입력 모달**. "1차 KPI 스냅샷 생성" 버튼(label="1차 확정") 추가.
- **PeriodBanner**: 잠금 중이면 `nextOpen`으로 "다음 수정 가능: {라벨} {날짜}" 표시. nextOpen null이면 기존 "작성 잠금 중"만.
- **KPI 화면(/kpi)**: "1차 확정 대비 변경 내역" 패널 — 본인 최신 스냅샷 diff(added/removed/changed) 표시. 스냅샷 없으면 미표시.
- **lib/ui.ts `schedulePhaseLabel`**: §1 정규 키 5개 추가(기존 키 유지).

---

## 7. 검증 포인트(QA)
- prep/preparation 고아 해소: seed 재실행 후 schedules가 정규 키 5개만.
- 잠금 기간 연속성: 윈도우 빈틈 없음, 겹침 없음.
- 재오픈 사유 누락 → 400. 사유 포함 → 200 + AuditLog after.reason 존재.
- current-phase `nextOpen` 정확성(잠금 중 다음 열림 단계).
- diff: added/removed/changed/unchangedCount 정합 + 행수준 권한(타인 스냅샷 403).
- 응답 봉투·camelCase 일관.

---

## 8. 보상 시뮬레이션 — 그룹 실적 tier 보너스 연동 (델타)

> 대상: `GET /api/v1/compensations/simulation`, `GET /api/v1/compensations/simulation/team`, `POST /api/v1/compensations/compute`.
> 권한·봉투·camelCase 기존과 동일.

### 8.1 규칙
- 연봉 인상률 = `RuleSet.raiseRates[grade]` + **그룹 실적 tier 보너스**(`weightPolicy.groupTierBonus[tier]`).
- 그룹 tier 는 피평가자 부서의 **최상위 그룹**(`groupRootOf`) → 해당 `GroupPerformance(cycleId, groupId).tier`.
- `groupTierBonus` 미설정 시 기본값 `{ excellent: 2, standard: 0, poor: -1 }`(%, 음수·소수 허용).
- HR 이 `PATCH /api/v1/rule-sets/:id` 의 `weightPolicy.groupTierBonus` 로 편집 → 그대로 저장·반영.
- 그룹 실적 미입력/부서 없음 → `groupTier=null`, `groupTierBonus=0`(보너스 없음).

### 8.2 시뮬레이션 응답 shape (`data` 항목, simulation=단건 / team=배열)
```jsonc
{
  "userId": "string",
  "userName": "string | null",
  "departmentName": "string | null",
  "cycleId": "string",
  "currentSalary": "number | null",
  "currentGrade": "S|A|B|C|D | null",
  "raiseRate": "number | null",          // (raiseRates[grade] + groupTierBonus) 포함
  "projectedSalary": "number | null",    // currentSalary*(1 + raiseRate/100), tier 보너스 포함
  "position": "string | null",
  "previousSalary": "number | null",
  "divisionName": "string | null",
  "teamName": "string | null",
  "groupTier": "excellent|standard|poor | null",  // [신규] 표시용
  "groupTierBonus": "number",                       // [신규] 적용된 tier 보너스(%)
  "byGrade": [                                       // 등급별 비교(슬라이더)
    { "grade": "S|A|B|C|D",
      "raiseRate": "number",            // tier 보너스 포함
      "projectedSalary": "number | null" } // tier 보너스 포함
  ]
}
```
- `simulation/team` 은 `{ data: [...], meta: { ..., totalCurrentSalary, totalProjectedSalary, totalIncrease } }` — 합계는 tier 보너스 반영된 projectedSalary 기준.
- `compute` 응답·meta 변경 없음. 단, 인상률 산정 시 **사용자별 정확한 그룹 tier** 보너스가 반영됨(기존: 첫 GroupPerformance 행을 모두에 적용하던 버그 수정).

### 8.3 프론트 반영
- `lib/types` 시뮬레이션 타입에 `groupTier`, `groupTierBonus` 추가. `byGrade[].raiseRate`/`projectedSalary` 가 tier 보너스 포함 값임에 유의(별도 재계산 금지).
