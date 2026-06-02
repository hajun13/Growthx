# QA 통합 정합성 리포트 — M2 + v2 도메인 대정정

> 검증자: qa-inspector · 일자: 2026-06-02 · 방법: 정적 교차 읽기("양쪽 동시 읽기", Grep)
> 기준: contract.md(v2), domain-model.md, business-rules.md
> 환경: **Node 미설치** → 빌드/런타임 미실행. 타입·경계면은 정적 교차 읽기로 검증. "빌드 검증 필요" 항목은 별도 표기.

## 게이트 판정: **통과 (PASS)**

차단(blocking) 결함 0건. 심각도 Major 0건. Minor(설계상 의도된 허용오차/후속) 2건 — 모두 계약·진행노트에 명시된 수용 사항. 회귀 없음.

---

## 0. 결함 요약 (심각도별)

| 심각도 | 건수 | 내용 |
|--------|------|------|
| Blocker(차단) | 0 | — |
| Major(경계면 불일치) | 0 | — |
| Minor(허용/후속) | 2 | M-1 KpiStatus 잉여 union 멤버, M-2 KpiScore.achievementRate nullable 표기차 |
| Info(빌드검증 필요) | 1 | 전체 TS 컴파일·prisma generate 미실행 |

---

## 1. v2 도메인 잔재 점검 (최우선) — **잔재 0건 확인**

`Grep -E "Dimension|EvaluationItem|peer|upward|multiSource|multi_source|competency|Competency|RadarChart|dimensionGrades|competency-items"` (apps 전체):

- **기능 코드 잔재 0건.** 매칭된 모든 라인은 "제거됨"을 설명하는 **주석/문서**뿐:
  - `apps/web/lib/types.ts:3,16,26`, `lib/ui.ts:2`, `tailwind.config.ts:97` (전부 주석)
  - `apps/api/prisma/schema.prisma:5,6,10`, `seed.ts:7` (전부 주석)
- `competency-items`/`competency_items`/`/competency` 라우트·엔드포인트: **매칭 0건** (M1의 `GET /competency-items`·`EvaluationItem` 완전 제거됨).
- `RadarChart`/`ScatterPlot` 컴포넌트: 미존재(생성 안 됨).

| 점검 항목 | 백엔드 | 프론트 | 결과 |
|----------|--------|--------|------|
| Dimension / 역량 차원 | 없음(주석만) | 없음(주석만) | ✅ |
| EvaluationItem / competency-items | 없음 | 없음 | ✅ |
| peer / upward | 없음 | 없음 | ✅ |
| multiSource / dimensionGrades | 없음 | 없음 | ✅ |
| RadarChart | 없음 | 없음 | ✅ |

---

## 2. 평가 유형·KPI 분류·조직 enum 양쪽 일치 — **전부 일치**

| enum | 백엔드(schema.prisma / @prisma/client) | 프론트(lib/types.ts) | 결과 |
|------|------------------|------------------|------|
| EvaluationType | `self`·`downward` (round 1·2) | `EvalType='self'\|'downward'` | ✅ |
| EvaluationStatus | not_started·in_progress·submitted·finalized | `EvalStatus` 동일 4값 | ✅ |
| KpiCategory | revenue·construction·orders·collaboration·development | 동일 5값 | ✅ |
| KpiGroup | performance_core·collaboration_growth | 동일 2값 | ✅ |
| MeasureType | amount·rate·count·qualitative | 동일 4값 | ✅ |
| DepartmentType | group·division·team | 동일 3값 | ✅ |
| GroupTier | excellent·standard·poor | 동일 + `PoolTier` 별칭 | ✅ |
| AppealStatus | submitted·under_review·answered·closed | 동일 4값 | ✅ |
| Role | hr_admin·division_head·team_lead·employee | 동일 4값 | ✅ |
| JobLevel | division_head·team_lead·senior_plus·senior_minus | 동일 4값 | ✅ |
| KpiStatus | draft·submitted·approved·confirmed (4값) | + `rejected`·`revision_requested` (6값) | ⚠️ M-1 |

---

## 3. 영역별 통과/실패/미검증

### A. API 응답 ↔ 프론트 훅 (봉투·unwrap·페이지네이션) — ✅ PASS
- **봉투 단일화:** `EnvelopeInterceptor`(api)가 `{data}` 또는 `{data,meta}`로 일괄 래핑. 서비스 list 가 직접 `{data,meta}` 반환 시 그대로 통과(이중래핑 없음).
- **unwrap 단일화:** `lib/api.ts` `apiGet`(→data)·`apiGetList`(→{data,meta}, `data ?? []` 배열보장)·`apiPost`/`apiPatch`/`apiDelete`/`apiPostList`. 배열 직접 가정 없음.
- `compensations/compute` 확장 meta(`companyAvgRaise`/`exceedsTarget`): `apiPostList<T,M>` 제네릭으로 수용, `CompensationMeta` 타입 1:1.
- 모든 contract 엔드포인트(§2~§16)에 대응 훅 존재·실제 호출(죽은 훅 0 — progress §3).

### B. snake ↔ camel 누출 — ✅ PASS
- Prisma 모델은 PascalCase 필드 + `@map("snake")` → **client 반환은 camelCase**. 응답에 snake 누출 경로 없음.
- `users.serializer.ts`가 `passwordHash` 제거 + camelCase DTO 명시 반환.
- 프론트 타입 전부 camelCase, contract 객체 명세와 1:1.

### C. 라우팅 (href↔page, (group) 제거, 다면 라우트 제거) — ✅ PASS
- `app/` route group `(auth)`·`(main)`은 URL서 제거됨 → 실제 URL `/login`,`/eval`,... 와 nav/href 일치.
- 전체 href·router.push 수집(13건) → 전부 실존 page 매칭:
  - `/eval`,`/kpi`,`/kpi/review`,`/eval/self`,`/eval/dept-head`,`/eval/result`,`/eval/result/[userId]`,`/appeals`,`/admin/group-performance`,`/reports`,`/admin/compensation`,`/admin/settings`,`/login` 모두 page 존재.
  - 동적 `/eval/result/${userId}?cycleId=` ↔ `result/[userId]/page.tsx` 일치.
- **다면(multi) 라우트 제거 확인:** `/eval/multi` 등 미존재(grep 0). `nav.ts`에 multi 항목 없음.
- `nav.ts` 11개 메뉴 href ↔ page 1:1.

### D. 상태 전이 — ✅ PASS
- `submitted→finalized`: `evaluations.service.finalize()` 구현 + `assertTransition(EVALUATION_TRANSITIONS, submitted, finalized)`.
- `approved→confirmed`: `kpis.service.confirm()` 구현 + `assertTransition(KPI_TRANSITIONS, approved, confirmed)`.
- KPI reject: 계약대로 `submitted→draft` + `rejectReason` 기록(별도 status 미반환). 프론트 `kpi/page.tsx:299` = `status==='draft' && rejectReason` 으로 "반려사유" 표시 — **계약 §8 표시전용 파생 패턴 정확히 준수**.
- Appeal: submitted→under_review→answered→closed. `respond()`가 submitted일 때 under_review 경유 보정 후 answered. `decide()` answered→closed.
- 모든 status 업데이트가 전이맵 경유(무단 전이 없음).

### E. RBAC (무방비 엔드포인트·행수준) — ✅ PASS
- **전역 가드:** `app.module.ts` `APP_GUARD = JwtAuthGuard → RolesGuard`. `@Public()`(health·login·refresh) 외 **모든 엔드포인트 인증 강제**. 프론트만 숨긴 무방비 엔드포인트 없음.
- 변경(mutation) 엔드포인트 `@Roles()` 가드 확인: users/cycles/rule-sets/kpi-templates/departments(POST)/results.aggregate/evaluations.finalize/notifications/compensations/group-performance/grade-pools.compute/appeals.respond·decide/kpis.approve·reject·confirm — 전부 역할 가드 존재.
- **행 수준(소유권):** service 단 `canViewUser()`로 구현 —
  - kpis.list/get·evaluations.getDetail·results.list/getDetail·appeals.list/respond 모두 가시범위 필터.
  - employee=본인, team_lead/division_head=가시범위 트리, hr_admin=전체.
- 의도된 비-가드 엔드포인트(POST `/kpis`, `/achievements`, `/appeals`, `/evaluations`, `/evaluations/:id/submit` 등)는 service 내 `assertOwner`/`assertEvaluator`/소유권 검사로 보호.

### 도메인 규칙 (백엔드 단일 책임) — ✅ PASS
- **가중치 합=100·정성≤30%:** `scoring.validateWeights()` (kpis.submit 에서 cycle 전체 siblings 기준). 프론트는 즉시 피드백 표시만(재계산 아님).
- **측정방식별 등급:** `scoring.measureToGrade()` — amount/rate=`gradingScales`(달성률표), count=KPI별 `grading`(건수 임계값), qualitative=`directGrade`. 백엔드 일관 구현. 프론트는 백엔드 산정값 표시만(GradeChip/ScoreCard/AchievementField).
- **총점:** `computeTotalScore = Σ score×weight/100` 백엔드 단일. 프론트 재계산 0.
- **그룹 풀 상한:** `evaluations.submit`→`assertPoolNotExceeded`→`checkPool` 초과 시 **422 POOL_EXCEEDED**(제출 차단). group→division→team 상향 탐색+하위트리 집계.
- **코멘트 의무:** downward+division_head/team_lead 코멘트 0건 시 **422 COMMENT_REQUIRED**.
- **이의제기 7일:** `appeals.create` `result.createdAt + 7d` 초과 시 **422 APPEAL_WINDOW_CLOSED**.
- **self+downward 집계·percentile:** `results.aggregate` byType={self,downward1,downward2}, finalScore=downward2→downward1→self 우선순위, percentile·companyAvg 백엔드 계산.
- 등급·풀·인상률·가중치 전부 `RuleSet`에서 읽음(하드코딩 없음 — `scoring.service` 상수 미박힘).

### EvaluationResult.byType shape (프론트 1:1) — ✅ PASS
- 백엔드 `results.service`가 `byType={self,downward1,downward2}` 각 `{score,grade,comment}` 생성 → `EvaluationByType`/`ByTypeEntry` 타입과 1:1.
- `result/[userId]/page.tsx:24~52` `toRows()`가 `byType.self/downward1/downward2` 소비, 전 필드 null 가드. ✅

### DistributionBarChart shape — ✅ PASS
- `counts:Record<Grade,number>`·`caps`·`tier`·`total`은 **프론트가 응답으로부터 파생**(GradePool ratio×인원, Evaluation.finalGrade 집계). API 응답을 그대로 받는 shape가 아니라 표시용 가공 — 누출 없음. `tier:PoolTier`는 `GradePool.tier` 직결, enum 일치.

---

## 4. 프론트 계약 협상 3건 — 판정표

| # | 항목 | 근거(파일:라인) | 판정 | 수정주체 |
|---|------|----------------|------|----------|
| 1 | 부서장 **종합 등급 직접 부여** 필드 부재 | 계약 PATCH `/evaluations/:id`는 per-KPI `kpiScores`만(contract §10:325-332). 구현: `dept-head/page.tsx:139-165` — 정성 KPI만 `directGrade`(GradeRadio), amount/rate/count는 self 실적 기반 백엔드 자동등급, 종합은 `ScoreCard`로 백엔드 산정 표시. 백엔드 `evaluations.service.patch:133` `measureToGrade` 일관 처리. | **[수용M2]** — 현 구현이 도메인 원칙(등급=백엔드 단일계산)에 부합. 운영상 평가자 강제 종합등급이 필요하면 차기 `overallGrade?` 협상. 지금은 차단 아님. | (후속 협상 시 BE) |
| 2 | 그룹 풀 상한 **인원 계산 근거**(정원 절대값) | 프론트 `dept-head/page.tsx:124-137` caps = `Math.floor(ratio% × targets.length)` 추정(안내용). 최종 강제는 백엔드 `evaluations.service:280 checkPool`(422). GradePool 응답에 headcount 절대값 없음. | **[수용M2]** — 표시 추정은 안내, **강제는 백엔드가 책임**(보안·정합 영향 없음). headcount 동봉은 UX 개선 후속. | (후속 협상 시 BE) |
| 3 | 부서명/대상자 이름 **비정규화 부재** | User 응답에 `departmentName`·대상자 `userName` 없음(`users.serializer.ts:5-16`). 프론트 `dept-head/page.tsx:274` `evaluateeId.slice(0,8)` 표시, 부서명은 departments 조회. | **[수용M2]** — UX 저하만, 정합·보안 무영향. `userName`/`departmentName` 동봉은 후속 개선. | (후속 협상 시 BE) |

> 3건 모두 **[수용M2]** — 경계면 깨짐이나 보안 결함이 아니라 "있으면 좋은" 보강. 게이트 차단 사유 아님. progress.md §5 frontend 자체 분석과 일치.

---

## 5. Minor 결함 상세

### [Minor] M-1 — KpiStatus union 잉여 멤버 (표기 불일치, 무해)
- **생산자:** `apps/api/prisma/schema.prisma:61-66` — `KpiStatus = draft|submitted|approved|confirmed` (4값). 백엔드는 `rejected`/`revision_requested`를 **반환하지 않음**(반려=`draft`+`rejectReason`, contract §8 명시).
- **소비자:** `apps/web/lib/types.ts:33-39` — `rejected`·`revision_requested` 2개 추가 union(6값). `lib/ui.ts:167,171`에 스타일 매핑 존재(영원히 도달 안 함).
- **영향:** 무해. API가 해당 값을 절대 보내지 않으므로 런타임 미스 없음. 프론트는 이미 `status==='draft' && rejectReason`로 "반려" 표시(`kpi/page.tsx:299`) — 잉여 멤버에 의존하지 않음.
- **수정(선택, FE):** types.ts에서 두 멤버 제거해 계약 4값과 정합. 우선순위 낮음.

### [Minor] M-2 — KpiScore.achievementRate nullable 표기차
- **생산자:** `schema.prisma:384` `achievementRate Float?`(nullable, qualitative는 null). 백엔드는 정성 KPI score에 null 반환 가능.
- **소비자:** `apps/web/lib/types.ts:228-236` `KpiScore.achievementRate: number`(non-null 표기).
- **영향:** 미미. 소비처 `self/page.tsx:313,322`·`dept-head/page.tsx:320`가 모두 `score?.achievementRate` + `fmtScore()`로 옵셔널 처리 → 런타임 안전. 타입 표기만 엄밀치 않음.
- **수정(선택, FE):** types.ts `achievementRate: number | null`로 정직화. 우선순위 낮음.

---

## 6. 빌드 검증 필요 (Info)
- Node 미설치로 `tsc`·`prisma generate`·`next build` 미실행. 위 정합은 정적 교차 읽기 결과.
- 릴리스 단계에서 ① `prisma generate`(@prisma/client enum 생성) ② `apps/api`·`apps/web` 타입체크 ③ seed enum 값(category/group/measureType/tier) 실행 검증 권장.

---

## 7. 회귀(M1 대비)
- M1 리포트 결함(D-1 코멘트 영속화, E-1 행수준 필터, D-2 KpiStatus, DELETE /kpis, nullable B-1/B-2) → v2 재빌드에서 유지·정합. `kpis.service.saveReviewComment`(D-1), list 행수준(E-1), reject reason 영속, nullable 가드 모두 잔존. **회귀 없음.**
