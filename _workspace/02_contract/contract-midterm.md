# API 계약 — 6월 중간평가 · 피드백 보완 조치 (Model B)

> 작성 2026-06-08 · 백엔드 엔지니어 · 범위 ①②③④ (④ KPI 목표 재조정 = §7. **2026-06-08 재설계: 즉시-적용 → 본인 제안·부서장 검토·승인 반영 워크플로우**)
> 봉투 규약: 모든 성공 응답 `{ data }` 또는 `{ data, meta }`, 에러 `{ error: { code, message, details? } }`. 필드 camelCase. 베이스 경로 `/api/v1`.
> 인증: JWT Bearer. 401(미인증)/403(권한없음) 구분.

이 문서는 **프론트가 보고 구현**하는 단일 계약이다. 변경 시 §6 프로토콜(통지→갱신→양쪽 반영).

---

## 0. 배경 — Model B (1주기 · 체크포인트)

- 2026 연간 정기평가 = **1개 주기**가 `draft → active → mid_review → calibration → closed` 로 진행.
- **`mid_review` = 6월 중간평가 체크포인트** (비구속: 등급/보상/역량평가 미산정).
- **`calibration`/`closed` = 최종평가 단계** (등급·보상·역량평가 산정 가능).
- `cycleType` 은 연간 운영이므로 `FINAL`. (`MIDTERM` enum 값은 보존하되 미사용.)
- 단계 판정은 `cycleType` 이 아니라 **`cycle.status` 기준**.

프론트는 현재 주기의 `status` 로 화면을 분기한다(`mid_review` → 중간 점검 UI, 등급/보상 숨김).

---

## 1. 게이팅 — 등급·보상·역량평가 차단 (①)

`cycle.status` 가 `calibration` 또는 `closed` 가 **아니면** 아래 호출은 **400** 차단.

```
{ "error": { "code": "VALIDATION_ERROR", "message": "최종평가(조정/완료) 단계에서만 등급·보상을 산정할 수 있어요." } }
```

| 영향 엔드포인트 | 차단 조건 | 메시지 |
|---|---|---|
| `POST /results/aggregate` | status ∉ {calibration, closed} | 최종평가(조정/완료) 단계에서만 등급·보상을 산정할 수 있어요. |
| `POST /compensations/compute` | 〃 | 〃 |
| `POST /competency/questions`, `POST /competency/responses/bulk` | 〃 | 중간 점검 단계에서는 역량평가를 진행하지 않습니다. 최종평가(조정/완료) 단계에서만 가능해요. |

> `GET /compensations/simulation`·`/simulation/team` 은 **what-if 미리보기**라 차단하지 않음(영속 없음).
> 본인/부서장 평가 작성·제출(`/evaluations`)은 mid_review 에서 **계속 가능**(중간 피드백). 단 집계·등급 확정은 위 게이팅으로 차단.

---

## 2. 진척 점검 (②)

### GET /api/v1/midterm/progress
- 권한: 인증 사용자. `employee` 는 본인만. 그 외는 `userId` 지정 시 가시 범위 검증(밖이면 403).
- 쿼리: `cycleId`(필수), `userId`(선택 — 미지정 시 현재 사용자).
- 응답 200: `{ data: MidtermProgress }`
- 에러: 403 FORBIDDEN, 404 NOT_FOUND(규칙세트 없음).

```ts
type ProgressSignal = 'on_track' | 'at_risk' | 'off_track';   // 순항 / 주의 / 위험
type ProgressTrend  = 'up' | 'flat' | 'down';

interface MidtermProgress {
  cycleId: string;
  userId: string;
  overallSignal: ProgressSignal;          // KPI 신호 worst-case 집계
  kpis: KpiProgress[];
  org: OrgProgress | null;                // 소속 그룹 월별 실적 누적(없으면 null)
}

interface KpiProgress {
  kpiId: string;
  title: string;
  category: 'revenue'|'construction'|'orders'|'collaboration'|'development';
  group: 'performance_core'|'collaboration_growth';
  measureType: 'amount'|'rate'|'count'|'qualitative';
  weight: number;
  targetValue: number | null;
  targetText: string | null;
  cumulativeActual: number;               // 분기 실적 누적(actualValue 합)
  cumulativeRate: number | null;          // 누적 달성률(%) — 정성은 null 가능
  currentGrade: 'S'|'A'|'B'|'C'|'D' | null; // 중간 시점 등급(정성은 null)
  trend: ProgressTrend;                   // 직전 분기 대비
  signal: ProgressSignal;
  quarters: { quarter: number; actualValue: number; achievementRate: number }[];
}

interface OrgProgress {
  departmentId: string;
  departmentName: string | null;          // 그룹명
  targetAmount: number;
  actualAmount: number;
  achievementRate: number;                // % (소수1)
  byCategory: { category: string; targetAmount: number; actualAmount: number; achievementRate: number }[];
  monthlyTrend: { month: number; achievementRate: number }[];  // 누적
}
```

> 신호 경계(기본): 누적 달성률 ≥90% on_track / 70~90% at_risk / <70% off_track / null(미입력) at_risk.

---

## 3. 진척 점검 리뷰 — 자가점검 + 부서장 확인 (②)

`MidtermReview` = cycle × evaluatee 단위 유일. status: `pending → self_done → confirmed`.

```ts
interface MidtermReview {
  id: string;
  cycleId: string;
  evaluateeId: string;
  evaluateeName: string | null;
  status: 'pending' | 'self_done' | 'confirmed';
  selfNote: string | null;
  selfSubmittedAt: string | null;     // ISO
  reviewerId: string | null;
  reviewerName: string | null;
  reviewerNote: string | null;
  confirmedAt: string | null;         // ISO
  createdAt: string;
  updatedAt: string;
}
```

### GET /api/v1/midterm/reviews
- 권한: `employee`=본인만. 부서장=본인+가시부서. `hr_admin`=전체. `evaluateeId` 지정 시 가시 범위 검증.
- 쿼리: `cycleId`(필수), `evaluateeId`(선택).
- 응답 200: `{ data: MidtermReview[], meta }`

### POST /api/v1/midterm/reviews  (본인 자가점검 제출)
- 권한: 인증 사용자(본인 것만 — evaluatee = 현재 사용자, 서버 강제).
- body: `{ cycleId: string, selfNote?: string }`
- 동작: upsert. status → `self_done`. (재제출 시 `confirmed` 였어도 `self_done` 로 되돌림 → 재확인 필요.)
- 응답 201: `{ data: MidtermReview }`

### PATCH /api/v1/midterm/reviews/:id/confirm  (부서장 확인)
- 권한: `hr_admin` 또는 **피평가자의 상위 장**(1차 팀장/2차 본부장/최종 대표). 그 외 403.
- body: `{ reviewerNote?: string }`
- 동작: reviewerId=현재 사용자, confirmedAt=now, status → `confirmed`.
- 응답 200: `{ data: MidtermReview }`
- 에러: 403 FORBIDDEN, 404 NOT_FOUND.

---

## 4. 피드백 보완 조치 — ActionItem (③)

**최종등급 미반영(참고용).** 12월 최종평가 화면이 `GET /action-items?cycleId=&evaluateeId=` 로 이행 현황 패널을 그린다.

```ts
type ActionItemStatus = 'planned' | 'in_progress' | 'done' | 'canceled';

interface ActionItem {
  id: string;
  cycleId: string;
  evaluateeId: string;
  evaluateeName: string | null;
  kpiId: string | null;
  kpiTitle: string | null;
  source: 'midterm_review';
  title: string;
  detail: string | null;
  assigneeId: string;          // 담당(기본 = evaluatee)
  assigneeName: string | null;
  dueDate: string | null;      // ISO
  status: ActionItemStatus;
  createdById: string;
  createdByName: string | null;
  completedAt: string | null;  // ISO (done 시)
  completionNote: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 상태 전이 (서버 강제 — assertTransition)
```
planned     → in_progress | done | canceled
in_progress → done | planned | canceled
done        → in_progress            (완료 취소/재개)
canceled    → planned                (취소 철회)
```
허용 외 전이는 409 `INVALID_STATE_TRANSITION`.

### GET /api/v1/action-items
- 권한: `employee`=본인(피평가자 OR 담당)만. 부서장=가시부서+본인. `hr_admin`=전체.
- 쿼리: `cycleId`(필수), `evaluateeId`(선택), `assigneeId`(선택), `status`(선택).
- 응답 200: `{ data: ActionItem[], meta }` (정렬: status → dueDate → createdAt)

### GET /api/v1/action-items/:id
- 권한: 본인(피평가자/담당)·부서장·HR.
- 응답 200: `{ data: ActionItem }` / 403 / 404.

### POST /api/v1/action-items  (생성)
- 권한: `hr_admin`, `division_head`, `team_lead` (+ 서비스에서 **피평가자의 상위 장**인지 추가 검증).
- body:
  ```ts
  {
    cycleId: string;
    evaluateeId: string;
    kpiId?: string;            // 연결 시 해당 evaluatee·cycle 소속 검증(아니면 400)
    title: string;            // ≤200
    detail?: string;          // ≤4000
    assigneeId?: string;      // 미지정 → evaluateeId
    dueDate?: string;         // ISO 8601
  }
  ```
- 응답 201: `{ data: ActionItem }` (status=planned)
- 에러: 400 VALIDATION_ERROR(잘못된 kpi 연결), 403 FORBIDDEN.

### PATCH /api/v1/action-items/:id  (내용 수정)
- 권한: 생성과 동일(부서장·HR).
- body: `{ title?, detail?, assigneeId?, kpiId?, dueDate? }`
- 응답 200: `{ data: ActionItem }`

### PATCH /api/v1/action-items/:id/status  (상태 전이)
- 권한: **담당 본인 + 부서장 + HR**(컨트롤러 role 제한 없음 — 서비스에서 검증).
- body: `{ status: ActionItemStatus, completionNote?: string }`
- 동작: assertTransition 검증. `done` → completedAt=now(+completionNote). `done`에서 벗어나면 completedAt 초기화.
- 응답 200: `{ data: ActionItem }`
- 에러: 409 INVALID_STATE_TRANSITION, 403 FORBIDDEN, 404 NOT_FOUND.

---

## 5. 감사(AuditLog)

생성·상태전이·확인 시 기록(entity/action):
- `MidtermReview` — `midterm_review.self_submit`, `midterm_review.confirm`
- `ActionItem` — `action_item.create`, `action_item.update`, `action_item.transition`
- `RebaselineRequest` — `rebaseline_request.submit`, `rebaseline_request.update`, `rebaseline_request.resubmit`, `rebaseline_request.approve`, `rebaseline_request.reject` (④ 워크플로우)
- `Kpi` — `kpi.rebaseline` (④ **승인 반영 시점**에만. before/after=변경 필드만, after 에 `reason`·`snapshotId`·`requestId`·`requesterId`·`reviewerId` 포함)

---

## 6. 최종평가 화면 연동 (③)

12월 최종평가(부서장 평가) 화면은 **`GET /action-items?cycleId=&evaluateeId=`** 로 피평가자의 보완 조치 목록을 받아 "중간 보완 조치 이행 현황" 패널을 그린다. 이행률(done/전체) 등은 프론트에서 계산해 **표시만** 한다. **등급 계산에 절대 반영하지 않는다.**

---

## 7. 중간 KPI 목표 재조정 — 제안→검토→승인 워크플로우 + 변경 이력 (④)

> **재설계 2026-06-08.** (이전 §7 의 즉시-적용 `POST /midterm/rebaseline` 은 **폐기**.) 환경변화 반영을 위해 6월 중간 시점에 KPI 목표·가중치를 조정하되, **본인 제안 → 부서장 검토 → 승인 시 반영**의 승인 워크플로우를 따른다.
>
> **흐름:** 피드백 받음 → **본인(피평가자)이 재조정을 제안**(`RebaselineRequest` 생성, status=submitted) → **부서장이 검토** → **승인(approve) 시 실제 KPI 반영**(스냅샷·감사). **반려(reject) 시 본인이 수정·재제출**(rejected → submitted). 즉 실제 KPI 변경·`KpiSnapshot`·`AuditLog kpi.rebaseline` 은 **승인 시점에만** 발생한다.

### 상태 머신 (`RebaselineRequestStatus`, 서버 강제 — assertTransition)
```
submitted → approved | rejected
rejected  → submitted          (본인 수정·재제출)
approved  →                    (종단)
```
허용 외 전이는 409 `INVALID_STATE_TRANSITION`.

### 핵심 규칙
- **허용 윈도우 = `cycle.status === 'mid_review'` 일 때만.** 생성·수정·검토 모두 이 단계에서만. 그 외 **400 VALIDATION_ERROR**.
  ```
  { "error": { "code": "VALIDATION_ERROR", "message": "중간평가(mid_review) 단계에서만 KPI 목표 재조정을 제안할 수 있어요." } }
  ```
- **제안 주체 = 피평가자 본인.** `evaluateeId` 는 body 로 받지 않고 서버가 `current.id` 로 강제한다.
- **검토·승인자 = 그 구성원의 부서장**(`resolveDownwardEvaluators` 의 round1 팀장, 없으면/상위 round2 본부장, round3 그룹대표 중 현재 사용자). **HR 은 승인자 아님 — 조회만.**
- **한 cycle×evaluatee 당 미결(submitted) 요청 1건.** 이미 submitted 인 요청이 있으면 신규 생성 400(기존 요청을 수정·재제출하라). (DB 부분 unique 불가 → 서비스 검증.)
- **대상 KPI = `status === 'confirmed'` 한정.** confirmed 아닌 KPI 를 `items` 에 넣으면 400(`확정(confirmed)된 KPI만 재조정할 수 있어요.`). 프론트도 편집 대상을 confirmed KPI 로만 로드.
- **편집 대상 필드: `targetValue`(숫자|null) · `targetText`(문자|null) · `weight`(정수 0~100)** 만. 그 외 필드 변경 불가.
- **정량(비정성) KPI 의 `targetValue` ≥ 0.** 음수면 400.
- **검증(confirmed 한정·정량≥0·중복금지·각 item 최소 1필드·가중치 합=100)을 제출 시 + 승인 시 둘 다 수행.** 가중치 합=100 검증 모집단 = 해당 cycle×evaluatee 의 `status='confirmed'` KPI 집합(제안 반영 후 값). (승인 시점에 confirmed 집합이 바뀌어 합이 깨졌다면 승인이 400 으로 실패 → 본인이 재제출.)
- **사유(reason) 필수**(공백 불가).
- **이력(승인분만):** 승인 시 직전 상태를 `KpiSnapshot`(라벨 `"중간 조정 전 (YYYY-MM-DD)"`)로 캡처(같은 날 같은 라벨 있으면 재캡처 안 함) + 각 KPI update + `AuditLog`(`Kpi`/`kpi.rebaseline`, before/after=변경필드만 + `reason`·`snapshotId`·`requestId`·`requesterId`·`reviewerId`). `RebaselineRequest.appliedSnapshotId` 에 스냅샷 id 기록.

### 권한(RBAC)
| 동작 | 허용 |
|---|---|
| 생성·수정·재제출 | 본인(`evaluateeId === current.id`). employee 포함 모든 인증 사용자가 본인 것 가능. mid_review 단계. |
| 검토(승인/반려) | 해당 구성원의 부서장(round1/2/3 중 현재 사용자). 그 외(HR 포함) 403. mid_review 단계. |
| 조회(목록·상세·이력) | 본인 · 부서장 · HR(`canViewUser` 패턴). 밖이면 403. |

### 공통 타입
```ts
type RebaselineRequestStatus = 'submitted' | 'approved' | 'rejected';
type RebaselineField = 'targetValue' | 'targetText' | 'weight';

interface RebaselineItem {              // 제안 1건(저장·반환되는 items[] 요소)
  kpiId: string;
  targetValue?: number | null;          // undefined=변경 안 함, null=목표값 제거
  targetText?: string | null;           // undefined=변경 안 함, ≤2000
  weight?: number;                      // undefined=변경 안 함, 0~100 정수
}

interface RebaselineFieldChange {
  field: RebaselineField;
  before: number | string | null;
  after: number | string | null;
}

interface RebaselineKpi {               // 현재 KPI(confirmed) 스냅샷 shape — diff 기준
  id: string;
  title: string;
  category: string;
  group: string;
  measureType: string;
  targetValue: number | null;
  targetText: string | null;
  weight: number;
  isQualitative: boolean;
  status: string;
}

// 목록/공통 view
interface RebaselineRequestView {
  id: string;
  cycleId: string;
  evaluateeId: string;
  evaluateeName: string | null;
  reason: string;
  status: RebaselineRequestStatus;
  itemCount: number;
  reviewerId: string | null;            // 검토(승인/반려)한 부서장
  reviewerName: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;            // ISO
  appliedSnapshotId: string | null;     // 승인 시 캡처한 스냅샷 id
  createdAt: string;                    // ISO
  updatedAt: string;                    // ISO
}

// 상세 = view + 제안·현재값 비교 정보(프론트가 diff·가중치 검증 표시)
interface RebaselineRequestDetail extends RebaselineRequestView {
  items: RebaselineItem[];              // 제안 원본
  currentKpis: RebaselineKpi[];         // 현재 confirmed KPI 집합(diff·가중치 기준)
  proposedChanges: {                    // 제안 vs 현재 — 승인 시 실제로 바뀔 필드만
    kpiId: string;
    title: string | null;
    proposed: { targetValue?: number | null; targetText?: string | null; weight?: number };
    current: { targetValue: number | null; targetText: string | null; weight: number } | null;
    fields: RebaselineFieldChange[];
  }[];
  projectedWeightSum: number;           // 제안 반영 후 confirmed 가중치 합
  weightValid: boolean;                 // projectedWeightSum === 100
}
```

### POST /api/v1/midterm/rebaseline-requests  (본인 제안·제출)
- 권한: 인증 사용자(본인 것만 — `evaluateeId` = `current.id`, 서버 강제).
- body:
  ```ts
  { cycleId: string; reason: string /* 1~1000자 */; items: RebaselineItem[] /* ≥1, kpiId 중복 불가 */ }
  ```
- 검증 순서: ①reason 필수 → ②mid_review 단계 → ③미결(submitted) 요청 중복 없음 → ④items confirmed 소속·중복·정량≥0·최소1필드 → ⑤weight 변경 시 confirmed 모집단 합=100.
- 응답 201: `{ data: RebaselineRequestDetail }` (status=submitted)
- 에러: 400 VALIDATION_ERROR(단계·사유·중복요청·KPI소속/confirmed/중복·음수·변경필드없음·가중치≠100).

### GET /api/v1/midterm/rebaseline-requests  (목록)
- 권한: 역할별 가시 범위. 본인 것 + 내가 부서장인 구성원 것. HR=전체.
- 쿼리: `cycleId`(필수), `evaluateeId`(선택, 가시 검증), `status`(선택), `forReview`(선택 — truthy 시 **부서장 검토 큐** = 내가 부서장인 구성원들의 미결(submitted) 요청; `status` 명시 시 그 상태).
- 응답 200: `{ data: RebaselineRequestView[], meta }` (정렬: status asc → createdAt desc)
- 에러: 403 FORBIDDEN(가시 밖 evaluateeId).

### GET /api/v1/midterm/rebaseline-requests/:id  (상세)
- 권한: 본인 · 부서장 · HR. 밖이면 403.
- 응답 200: `{ data: RebaselineRequestDetail }` / 403 / 404 NOT_FOUND.

### PATCH /api/v1/midterm/rebaseline-requests/:id  (본인 수정·재제출)
- 권한: 본인(`evaluateeId === current.id`). 그 외 403. mid_review 단계.
- 대상 상태: `submitted`(검토 전 수정) 또는 `rejected`(반려 후 수정→재제출). `approved` 면 400(수정 불가).
- body: `{ reason?: string; items?: RebaselineItem[] }` (둘 다 선택 — 부분 수정. 미지정 필드는 기존 유지.)
- 동작: 재검증(confirmed·가중치 등). `rejected` 였으면 status → `submitted`(재제출, 직전 reviewer/comment/reviewedAt 초기화).
- 응답 200: `{ data: RebaselineRequestDetail }`
- 에러: 400 VALIDATION_ERROR, 403, 404, 409 INVALID_STATE_TRANSITION.

### PATCH /api/v1/midterm/rebaseline-requests/:id/review  (부서장 검토)
- 권한: 해당 구성원의 **부서장**(round1/2/3 중 현재 사용자). HR 포함 그 외 403. mid_review 단계.
- 대상 상태: `submitted` 만(전이 검증). 그 외면 409.
- body: `{ decision: 'approve' | 'reject'; comment?: string /* ≤2000 */ }`
- 동작:
  - `approve` → 승인 시점 재검증 후 **실제 KPI 반영**(스냅샷+update+`kpi.rebaseline` 감사), status → `approved`, `reviewerId`·`reviewedAt`·`appliedSnapshotId` 기록.
  - `reject` → status → `rejected`, `reviewComment`·`reviewerId`·`reviewedAt` 기록(KPI 미변경).
- 응답 200: `{ data: RebaselineRequestDetail }`
- 에러: 400 VALIDATION_ERROR(승인 시 검증 실패), 403 FORBIDDEN, 404, 409 INVALID_STATE_TRANSITION.

### GET /api/v1/midterm/rebaseline/history  (이력/diff 조회 — 유지)
- 쿼리: `cycleId`(필수), `evaluateeId`(필수).
- 응답 200: `{ data: RebaselineHistoryEntry[], meta }` (최신 스냅샷이 먼저, createdAt desc)

```ts
interface RebaselineHistoryEntry {
  snapshotId: string;
  label: string;                     // "중간 조정 전 (YYYY-MM-DD)"
  createdAt: string;                 // ISO — 재조정 직전(=조정 시점) 시각
  createdBy: string | null;          // 재조정 실행자 userId
  createdByName: string | null;      // 재조정 실행자 표시명(User.name 조회). 프론트는 이 필드로 표시.
  reason: string | null;             // 해당 재조정 사유(AuditLog 매칭)
  changed: RebaselineKpiChange[];    // 이 스냅샷(before) → 다음 시점(after) diff
}
```
- diff 기준: 각 스냅샷의 `before` = 그 스냅샷에 캡처된 KPI 들, `after` = 바로 다음(더 최신) 스냅샷의 KPI 들. 가장 최신 스냅샷의 `after` = **현재 KPI**. 즉 시계열로 누적된 재조정을 차례로 비교한다.
- 에러: 403 FORBIDDEN.

> **프론트 노트(워크플로우 전환):**
> - **본인 화면**(`/eval/midterm` 등): 본인이 confirmed KPI 의 목표/가중치 변경을 제안 → `POST /midterm/rebaseline-requests`(evaluateeId 불필요). 반려 시 같은 요청을 `PATCH …/:id` 로 수정→재제출. 상태 배지(submitted/approved/rejected)·반려 코멘트 표시.
> - **부서장 화면**(검토 큐): `GET /midterm/rebaseline-requests?cycleId=&forReview=1` 로 본인이 부서장인 구성원의 미결 요청 목록 → 상세(`GET …/:id`)에서 `proposedChanges`(현재 vs 제안 diff)·`projectedWeightSum`/`weightValid` 로 가중치 검증 표시 → `PATCH …/:id/review` `{decision, comment}`.
> - **이력 패널**: `GET /midterm/rebaseline/history` 그대로(승인 반영분만 스냅샷 기반 타임라인). 변경자(`createdByName`)=승인한 부서장.
> - **⚠️ 폐기:** 기존 `POST /midterm/rebaseline`(즉시 적용) 라우트·`rebaselineCommands.apply`·즉시-적용 페이지(`/admin/midterm/rebaseline`)는 새 워크플로우로 대체. 프론트가 §6 프로토콜로 마이그레이션 필요(`apps/web/hooks/useMidterm.ts`·`lib/types.ts`·`/admin/midterm/rebaseline` 페이지). 가중치 합 100 은 클라 사전 안내 + 백엔드 최종 검증(400).
