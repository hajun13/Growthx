# QA 리포트 — M1 통합 정합성 교차검증

> 작성: qa-inspector · 2026-06-02 · 마일스톤 M1(기반 수직 슬라이스)
> 방법: 정적 "양쪽 동시 읽기" 교차 비교(Node 미설치 → 빌드 실행 불가, 빌드 검증 필요 항목 별도 표기)
> 기준: `_workspace/02_contract/contract.md`, `references/domain-model.md`, `business-rules.md`
> 범위: `apps/api/`(11 모듈) ↔ `apps/web/`(훅·라우트·타입) 전 경계면

---

## 0. 요약 (게이트 판정: **조건부 통과**)

| 심각도 | 건수 | 내용 |
|--------|------|------|
| 🔴 Blocker | 0 | 릴리스 절대 차단 결함 없음 |
| 🟠 Major | 3 | D-1(KPI 검토 코멘트 미전송), B-1(finalGrade null 안전성), B-2(KPI nullable 필드 toDraft 크래시) |
| 🟡 Minor | 6 | snake/camel 누락 없음 확인 외 계약-구현 명세 불일치 6건 |
| 🔵 빌드검증필요 | 1 | Node/prisma generate 후 타입체크·빌드 1회 |

핵심: **봉투·라우팅·RBAC·상태머신·규칙엔진(단일계산)은 양쪽 정합**. 경계면 크래시 위험은 **null 허용 필드(finalGrade·companyAvg·Kpi 텍스트필드)를 프론트가 non-null로 가정**한 지점에 집중. 빌드 실행 시 잡힐 수도, 런타임에만 터질 수도 있어(제네릭 `apiGet<T>`가 런타임 shape를 검증 안 함) M1 내 수정 권장.

---

## A. API 응답 ↔ 프론트 훅

### [PASS] 응답 봉투 일치
- 생산자: `EnvelopeInterceptor`(envelope.interceptor.ts:21) — payload에 `data` 키 있으면 통과, 없으면 `{data}` 래핑.
- 모든 list 서비스가 `{data, meta}` 직접 반환(cycles.service.ts:23, users.service.ts:53, kpis.service.ts:38, evaluations.service.ts:52, results.service.ts:43, departments.service.ts:28, rule-sets.service.ts:12) → 인터셉터가 그대로 통과(이중 래핑 없음).
- 소비자: `apiGetList`(api.ts:151) `{data, meta}` unwrap + `data ?? []` 배열 보장. `apiGet`(api.ts:145) `{data}` unwrap.
- **결론: 봉투·페이지네이션 shape 양쪽 일치.**

### [PASS] 단건/목록 구분 정확
- 단건(get/create/patch/action) → 훅이 `apiGet`/`apiPost`/`apiPatch`(단일 unwrap). 목록 → `apiGetList`. 혼선 없음.

### [INFO] users 목록만 실제 페이지네이션
- `users.service.list`만 page/pageSize/total 실계산(users.service.ts:43-53). 나머지 list는 `pageSize=rows.length, page=1`(전량 반환). 계약상 page/pageSize 쿼리를 받지만 미적용 — M1 데이터량 소규모라 기능 영향 없음. **[Minor C-pg]**

---

## B. 필드명 snake ↔ camel

### [PASS] snake 누출 없음
- Prisma 모델 필드는 이미 camelCase, DB 컬럼만 `@map`으로 snake(schema.prisma). 따라서 직렬화 객체는 camelCase로 나감 → 프론트 타입(camelCase)과 1:1.
- `toUserDto`(users.serializer.ts)가 passwordHash 제거 + camelCase 명시. auth/login·me 모두 적용.
- **snake_case가 응답에 누출돼 프론트에서 undefined 되는 필드: 없음.**

### [FAIL — Major] B-1. `EvaluationResult.finalGrade`/`finalScore`/`companyAvg`/`percentile` 가 nullable인데 프론트는 non-null 가정
- 생산자: `prisma/schema.prisma:424-429` — `finalGrade Grade?`, `finalScore Float?`, `percentile Float?`, `companyAvg Float?` 전부 nullable. `results.service.aggregate`도 finalized 평가가 없으면 `finalScore=null, finalGrade=null`(results.service.ts:95,103)로 upsert.
- 소비자: `apps/web/lib/types.ts:245-255` — `finalGrade: Grade`(non-null), `finalScore: number`, `percentile: number`, `companyAvg: number` 로 선언.
- 크래시 경로: `app/(main)/eval/result/[userId]/page.tsx:30` `const fallbackGrade: Grade = detail.finalGrade;` → null이면 `GradeChip grade={null}`로 전달 → ComparisonBar/GradeChip이 `gradeBgClass[null]` undefined 클래스. `ComparisonBar`(ComparisonBar.tsx:33) `companyAvg/max`도 null이면 0 처리되나 등급 칩은 깨짐.
- 수정: (택1) 프론트 타입을 `finalGrade: Grade | null` 등 nullable로 정정하고 result 페이지에서 null 가드 추가 / (또는) 백엔드가 결과 미집계 시 404를 반환하도록 강제(현재 getDetail은 레코드 있으면 null필드째 반환). **권장: 프론트 타입 nullable화 + 가드(FE), 계약 객체 명세에 nullable 명시(BE 계약 보강).**

### [FAIL — Major] B-2. `Kpi.coreStrategy/csf/measureMethod/targetValue` nullable인데 프론트 `toDraft`가 non-null 가정
- 생산자: `schema.prisma:243-247` — `coreStrategy String?`, `csf String?`, `measureMethod String?`, `targetValue Float?`. DTO도 `@IsOptional`(kpi.dto.ts:20-34). 서비스 create는 `?? null` 저장(kpis.service.ts:56-60). → API는 이 필드들을 `null`로 응답할 수 있음.
- 소비자: `apps/web/lib/types.ts:157-171` — `coreStrategy: string`(non-null) 등으로 선언. `app/(main)/kpi/page.tsx:32-42 toDraft()`가 `k.coreStrategy`(string 기대)를 그대로 사용, `String(k.targetValue)` → null이면 `"null"` 문자열로 표시.
- 영향: `TextField value={d.coreStrategy}`에 null 주입 시 React 제어 컴포넌트 경고/표시 이상, 목표값 칸에 "null" 노출. 빌드 타입체크는 통과(런타임 null).
- 수정: 프론트 타입을 `coreStrategy: string | null` 등으로 정정하고 `toDraft`에서 `?? ''` 폴백(FE). 또는 계약/DTO를 필수로 승격(BE) — 단 seed 데모 KPI는 값 보유라 계약 측 정의 모호. **권장: 계약 Kpi 객체에 nullable 명시 + 프론트 `?? ''` 가드(양쪽).**

---

## C. 라우팅

### [PASS] 모든 href/router.push가 실존 경로
- page 경로(그룹 제거): `/login`, `/eval`, `/eval/self`, `/eval/result`, `/eval/result/[userId]`, `/kpi`, `/kpi/review`, `/`.
- 링크 수집: `/eval`(login·root redirect), `/kpi`·`/eval/self`·`/eval/result/${user.id}?cycleId=`·`/kpi/review`(eval/page.tsx), `/kpi`(self 빈상태), `/login`(logout). `/eval/result` → `/eval/result/${user.id}` replace(result/page.tsx:18).
- nav.ts `NAV_ITEMS` href: `/eval`,`/kpi`,`/kpi/review`,`/eval/self`,`/eval/result`, 나머지 `#`(comingSoon). 전부 실존 또는 의도적 placeholder.
- `(auth)`/`(main)` route group은 URL에서 제거됨 — 누락 접두사 없음.
- **결론: 죽은 라우트 없음. 내부 일관성 확보.**

### [INFO] 작업서 별칭 경로(`/evaluation`·`/kpis`·`/results`) 미사용
- 프론트는 wireframes 기준 `/eval`·`/kpi`·`/eval/result` 채택(progress §1). 백엔드 API 경로(`/kpis`,`/evaluations`,`/results`)는 별개(REST 리소스) — 프론트 라우트와 충돌 아님. **정상.**

---

## D. 상태 전이

### [PASS] Evaluation submitted→finalized 구현
- 맵: `EVALUATION_TRANSITIONS`(transitions.ts:29-34) not_started→in_progress→submitted→finalized.
- 구현: patch(not_started→in_progress, evaluations.service.ts:152), submit(→submitted, :189), finalize(→finalized, :214). 무단 전이 없음(assertTransition 강제).

### [PASS] Kpi approved→confirmed 구현
- 맵: `KPI_TRANSITIONS`(transitions.ts:22-27) draft→submitted→approved→confirmed, submitted→draft(reject).
- 구현: submit(:96), approve(:117), confirm(:136), reject(submitted→draft, :125). **approved→confirmed 존재 확인.**

### [PASS] Cycle/Appeal 전이 맵 정의
- Cycle draft→active→mid_review→calibration→closed(cycles.service.updateStatus:49). Appeal 맵 정의됨(M2 구현 예정).

### [FAIL — Minor] D-2. domain-model의 Kpi `rejected`/`revision_requested` 상태가 Prisma enum·전이맵에 부재
- 기준: domain-model.md:130-134 상태머신에 `rejected→draft`, `revision_requested→draft` 명시. 계약 §8 reject는 `submitted→draft`로 정의(일관). 프론트 `KpiStatus`(types.ts:26-32)·`kpiStatusStyle`(ui.ts:122-129)에 `rejected`·`revision_requested` 라벨 존재.
- 구현: `schema.prisma:52-57` KpiStatus enum = draft/submitted/approved/confirmed 만. `transitions.ts:22` 맵도 4값만. reject는 실제로 `status=draft + rejectReason`(kpis.service.ts:128) — 별도 상태 미저장.
- 결과: 백엔드는 `rejected`/`revision_requested`를 **절대 반환하지 않음** → 프론트의 해당 라벨/타입은 죽은 코드(dead path). 크래시는 아니나 도메인 상태머신 ↔ 구현 불일치.
- 판정: 계약(reject→draft+reason)이 SSOT라면 **프론트 타입에서 두 값 제거** 또는 **domain-model을 "표시 전용 파생 상태"로 주석**. → **D-2는 [수용 가능], 단 7건 협상 #3과 연동(아래).**

### [FAIL — Major] D-1. KPI 검토(K2)의 "코멘트 필수"가 백엔드에 미연동 — 코멘트가 어디에도 저장 안 됨
- 소비자: `app/(main)/kpi/review/page.tsx` — approve/reject 시 `comment` 입력 필수 가드(commentRequired, :76)는 **프론트에서만**. `approveAll`(:82)은 `kpiCommands.approve(k.id)`만 호출, **comment 미전송**. `confirmReject`(:104)는 `reject(k.id, comment)` — reason으로 전달(저장됨).
- 생산자: `POST /kpis/:id/approve`(kpis.controller.ts:55)·service approve(kpis.service.ts:114)는 **body·comment 인자 없음**. 계약 §8 approve도 body 없음. 따라서 **승인 시 입력한 검토 코멘트는 폐기**된다.
- 도메인 영향: business-rules의 "코멘트 의무화"는 **평가(Evaluation) 제출 단계**에서 백엔드 강제됨(evaluations.service.ts:192, COMMENT_REQUIRED) — 정상. 그러나 **KPI 검토 승인 코멘트**는 계약에 저장처가 없어 UX상 필수인데 실제 유실.
- 수정: (택1) 계약 보강 — `POST /kpis/:id/approve`에 `{ comment? }` body 추가 + Review/Comment 저장(BE) / (또는) 프론트에서 승인 시 코멘트 필수 가드 제거(검토 코멘트는 반려·수정요청에만 필수로 축소, FE). **권장: 계약 보강(BE) — KPI 검토 의견 영속화는 운영상 필요.**

---

## E. 권한 RBAC

### [PASS] 전역 가드 + @Roles 매트릭스
- `JwtAuthGuard`(전역, @Public 제외) + `RolesGuard`(전역, @Roles 강제). health/login/refresh만 @Public(auth.controller.ts:11,18; health).
- 쓰기 보호 정확: users create/update·cycles create/status·rule-sets·kpi-templates create·results aggregate·evaluations finalize = `@Roles(hr_admin)`. kpis approve/reject/confirm = `@Roles(hr_admin, division_head, team_lead)`.

### [PASS] 행 수준(소유권) service 강제
- `canViewUser`(access.util.ts) 본인/팀(managerId·동일 dept)/본부(트리 상향). 적용: users.get·kpis.get·evaluations.getDetail·results.getDetail/list·achievements.list.
- employee 목록 쿼리 본인 범위 축소: kpis.list(:34), evaluations.list(:45 OR evaluator/evaluatee), results.list(:35), users.list(:39).
- **프론트만 숨기고 API 가드 없는 엔드포인트: 없음.** K2 화면은 `canAccessReview`로 UX 가드하되 보안은 백엔드 approve/reject @Roles로 이중 방어.

### [FAIL — Minor] E-1. KPI 검토 권한이 "본인 팀/본부 한정" 행수준은 있으나 list 조회는 cycle 전체 노출
- 소비자: `kpi/review/page.tsx:39` `useKpis({ cycleId })` — userId 미지정 전체 조회.
- 생산자: `kpis.service.list`(:34) — employee만 본인 강제. team_lead/division_head는 **행수준 필터 없이 cycle의 전체 KPI 반환**. (get/approve 등 단건은 canViewUser·assertReviewer로 보호되나, **목록**은 타팀 KPI까지 노출.)
- 영향: 팀장이 GET /kpis로 타팀 제출 KPI 목록을 볼 수 있음(메타데이터 정보 노출). 단건 승인은 막힘.
- 수정: `kpis.service.list`에 team_lead/division_head 행수준 필터 추가(canView 범위 userId로 한정). **[Minor — 정보노출, M1 내 BE 수정 권장].**

### [INFO] kpis create에 @Roles 없음 = 전 인증역할 생성 가능
- 계약 §8 POST /kpis 권한 = employee/team_lead/division_head/hr_admin. service는 `userId=current.id` 강제(kpis.service.ts:50) → 본인 KPI만. **정상**(대리 생성은 계약상 가능하나 미구현 — Minor, 7건 #1과 무관).

---

## 인사평가 도메인 특화 체크

| 체크 | 결과 | 근거 |
|------|------|------|
| 가중치 합=100·정성≤30% 백엔드 검증 | ✅ PASS | `ScoringService.validateWeights`(scoring.service.ts:77), kpis.submit(:102)·kpi-templates 생성에서 호출. 프론트는 표시·UX 가드만(kpi/page.tsx:219 canSubmit). |
| 총점 백엔드 단일 계산 | ✅ PASS | `computeTotalScore` Σ(score×weight/100)(scoring.service.ts:100), evaluations.patch(:147)에서만 산출. 프론트 재계산 없음(표시만). |
| 등급·달성률·인상률 RuleSet 설정값(하드코딩 아님) | ✅ PASS | `loadRuleSetForCycle`로 주기별 RuleSet 로드 후 scoreToGrade/achievementRateToGrade/raiseRateForGrade. 상수 미박음. seed가 2026 기본값 주입(seed.ts:12). |
| 그룹 등급 풀 상한 강제(초과 제출 차단) | ✅ PASS | `checkPool`(scoring.service.ts:113) + evaluations.submit `assertPoolNotExceeded`(:203) → 422 POOL_EXCEEDED. 프론트는 에러코드 매핑만(self/page.tsx:166). |
| 평가 코멘트 의무화(본부장·팀장 미작성 시 차단) | ✅ PASS | evaluations.submit(:192) division_head/team_lead 코멘트 0건 → 422 COMMENT_REQUIRED. |
| 평가 유형 4값 문자열 일치 | ✅ PASS | self/peer/upward/downward — Prisma enum·계약·types.ts:20·ui.ts:50 일치. |
| 차원 5종 문자열 일치 | ✅ PASS | performance/common_competency/job_competency/leadership_competency/value_competency — schema·types.ts:14·dimensionLabel 일치. |
| 역할 4값 일치 | ✅ PASS | hr_admin/division_head/team_lead/employee 전 계층 일치. |
| 평가 상태 4값 일치 | ✅ PASS | not_started/in_progress/submitted/finalized 일치. |
| KPI 상태 일치 | ⚠️ 부분 | draft/submitted/approved/confirmed 일치. `rejected`·`revision_requested`는 프론트에만(D-2). |
| 다면 집계·percentile 백엔드 | ✅ PASS | results.aggregate(:64) 유형별 평균·downward 우선·percentile·companyAvg 백엔드 계산. |
| EvaluationItem.subtype 경계 | ⚠️ Minor | DTO·schema·service는 `subtype`(JobCompetencySubtype) 지원(evaluation.dto.ts:41, service:115), 계약 §10 EvaluationItem·프론트 `EvaluationItemInput`엔 subtype 없음. self 화면은 미전송(self/page.tsx:322). **추가 필드라 크래시 없음, 계약 명세 누락 [Minor]**. |

### [INFO] 역량 항목 점수(EvaluationItem.weight) 총점 미반영 — 의도된 M2 이월
- evaluations.patch(:144)에서 역량 items는 `weight:0`으로 총점 기여 0. 백엔드 progress §10·계약 의도와 일치(M2 템플릿 차원 가중 연동). 본인평가가 등급만 보내고 `score:0`(self/page.tsx:327)을 보내도 총점은 KpiScore 기준 → 7건 #6 판정 참조.

---

## 프론트 "계약 협상 필요" 7건 판정

| # | 항목 | 판정 | 근거(파일:라인) | 수정 주체 |
|---|------|------|----------------|----------|
| 1 | User에 이름/부서명 필드 부재 | **수용 가능(M2 이월)** | 계약 User는 `name` 보유(contract §2, types.ts:73 `name`). **부서명(departmentName)만** 부재 → `GET /departments`로 클라 조인 가능(progress §5-1). 평가자/피평가자 **이름**은 K2가 `userId.slice(0,8)`만 표시(kpi/review/page.tsx:163) — 이름 표시하려면 users 조인 필요. 크래시 아님, UX 개선건. | FE(조인) 또는 BE(M2 departmentName 추가) |
| 2 | DELETE /kpis/:id 부재 | **계약 보강 필요(BE)** | 계약·controller에 DELETE 없음. 프론트는 저장 draft 삭제를 화면 숨김으로 우회(kpi/page.tsx:151-157) — 서버 draft 잔존(데이터 누적). draft 삭제는 정상 기능. | BE — `DELETE /kpis/:id`(draft·owner 한정) 추가 |
| 3 | revision_requested 전용 액션 부재 | **수용 가능(M2 이월)** | 계약은 reject(submitted→draft+reason)만. K2 "수정요청"은 reject reason으로 표현(kpi/review/page.tsx:103). 기능상 반려와 동일 동작 → M1 수용. **단 프론트 KpiStatus 타입에서 `revision_requested` 제거 또는 별도 액션 신설은 M2.** (D-2와 연동) | M2: BE(별도 액션) 또는 FE(타입 정리) |
| 4 | EvaluationResultDetail 유형별 등급/코멘트 부재 | **계약 보강 필요(BE)** | 계약 결과 객체는 multiSource(유형별 **점수**)·종합 finalGrade·dimensionGrades만(contract §11). ComparisonBar는 유형별 막대에 종합 finalGrade를 fallback으로 병기(result/[userId]/page.tsx:30) — 부정확 표시. S7 코멘트(CommentThread)는 결과 객체에 없어 미노출. | BE — 결과 상세에 유형별 grade·comment 포함(M1.5/M2) |
| 5 | 역량 항목 마스터 출처 부재 | **계약 보강 필요(BE)** | S3 공통/리더십 역량 항목명이 프론트 상수 하드코딩(self/page.tsx:25-26 COMMON_COMPETENCY_ITEMS/LEADERSHIP_ITEMS). 정식은 KpiTemplate/RuleSet 또는 역량 마스터 API. 현재 백엔드 항목 목록 제공 엔드포인트 없음 → 프론트·백엔드 항목 불일치 위험. | BE — 역량 항목 마스터 API(또는 KpiTemplate.items 활용) |
| 6 | 본인평가 PATCH score placeholder(0) | **수용 가능(M2 이월)** | self/page.tsx:327 역량 items를 `score:0`로 전송. 백엔드 patch는 items.score를 그대로 저장(evaluations.service.ts:117)하고 **역량 weight=0이라 총점 미기여**(:144). 즉 grade만 의미. 계약 §10 "totalScore 백엔드 재계산"은 KpiScore 기준 — 모순 없음. **단 백엔드가 역량 grade→score 재산정은 미구현**(score 0 그대로 저장) → dimensionGrades 집계 시 0점 평균 위험(results.service.ts:110-114는 score!=null 필터라 0도 포함). **M2 역량 가중·grade→score 산정 시 정합 필요.** | M2: BE(grade→score 산정) |
| 7 | 주차 일정 메타 부재 | **수용 가능(M2 이월)** | S1 주차/단계 일정이 프론트 상수(eval/page.tsx:80-85 WEEKS, buildPhases 하드코딩). cycle startDate/endDate만으로 정밀 산출 불가. 표시 전용, 크래시 무관. | M2: BE(phase schedule 데이터) |

**7건 판정 집계:** 계약 보강 필요(BE) **3건**(#2·#4·#5) / 수용 가능(M2 이월) **4건**(#1·#3·#6·#7) / 프론트 수정 단독 **0건**.

---

## 빌드 검증 필요 (Node 미설치로 미실행)

- 🔵 **[빌드검증필요 V-1]** `apps/api`: `npm install && npx prisma generate && npm run build`. 현재 `@prisma/client` 미생성 — generate 전 enum/모델 타입 미확정(backend progress §9). generate 후 nest build로 DI·타입 최종 확인.
- 🔵 **[빌드검증필요 V-2]** `apps/web`: `npm install && npm run build`. B-1/B-2의 nullable 불일치 중 일부는 `strict` 타입체크에서 잡힐 수 있음(예: `Grade = detail.finalGrade`에서 finalGrade가 nullable이면 에러) — **타입을 nullable로 정정하면 빌드는 통과하되 런타임 가드가 추가로 필요**. useSearchParams Suspense 처리 확인됨(result/[userId]/page.tsx:49).

---

## 회귀(regression) 확인
- 이전 QA 리포트(`_workspace/05_qa/`) 없음 — 최초 검증. 회귀 대상 없음.

---

## 게이트 판정: **조건부 통과 (Conditional Pass)**

**차단(Blocker) 결함 없음** — 봉투·라우팅·RBAC·상태머신·규칙엔진 단일계산이 정합하여 핵심 수직 슬라이스는 동작 가능.

**조건(릴리스 전 처리 권장):**
1. **B-1 / B-2 (Major, 양쪽)** — finalGrade·companyAvg·Kpi 텍스트필드 nullable 정합. 프론트 타입 nullable화 + 가드. 미처리 시 결과 미집계 사용자/빈 KPI에서 화면 깨짐.
2. **D-1 (Major, BE)** — KPI 검토 승인 코멘트 유실. 계약 보강 또는 프론트 가드 축소로 "필수인데 저장 안 됨" 모순 해소.
3. **E-1 (Minor, BE)** — kpis.list 팀장/본부장 행수준 필터(정보노출).
4. **V-1 / V-2 (빌드)** — Node 환경에서 prisma generate + build 1회 통과 확인(이 검증 없이는 타입 안전성 미확정).

위 1~4 처리 후 **완전 통과**. 7건 협상 중 BE 계약 보강 3건(#2·#4·#5)은 M1.5 또는 M2 계약 갱신 트랙으로 분리 가능(M1 기능 동작에 비차단).

**통지 대상:** B-1/B-2/D-1/E-1 → backend-engineer + frontend-engineer 동시. 7건 #2·#4·#5 → 리더(계약 갱신 결정). V-1/V-2 → release-engineer.
