---
name: api-backend
description: "인사평가 솔루션의 분리형 백엔드 API(NestJS + Prisma + PostgreSQL)를 설계·구현. API 계약 작성, Prisma 데이터 모델/마이그레이션, NestJS 모듈(컨트롤러·서비스·DTO), RBAC 권한 가드, 평가 점수·가중치 계산, 상태 전이 구현 시 사용. 백엔드/API/데이터모델/서버 로직을 만들거나 수정·추가·보완할 때 반드시 사용."
---

# 인사평가 백엔드 API (NestJS + Prisma + PostgreSQL)

분리형 API 서버를 **계약 우선(contract-first)** 으로 구현하는 스킬. 응답 봉투·camelCase·RBAC·점수 계산의 단일 책임을 지킨다.

## 단일 진실 공급원
- 엔티티·역할(4)·KPI 분류·평가 유형·상태·명명: `eval-harness-orchestrator/references/domain-model.md`
- 수치 규칙(등급·풀·인상률·가중치·캐스케이드·RBAC): `eval-harness-orchestrator/references/business-rules.md`
- 응답 봉투·경로·인증 규약: `eval-harness-orchestrator/references/api-contract-convention.md`

## 절차

### 1. API 계약 작성 (코드보다 먼저)
도메인 모델 기반으로 엔드포인트를 계약 형식으로 명세하고 `_workspace/02_contract/contract.md`에 저장. 표준 리소스:

```
/api/v1/health            (헬스체크 — Docker healthcheck용)
/api/v1/auth              (login, refresh, me)
/api/v1/users             (CRUD, role·department·manager·jobLevel)
/api/v1/departments       (group→division→team 트리)
/api/v1/cycles            (평가 주기 CRUD, status 전이)
/api/v1/rule-sets         (등급·풀·인상률·가중치 설정 — HR)
/api/v1/kpi-templates     (직급별 KPI 양식)
/api/v1/kpis              (개인 KPI/과제 작성·제출·승인/반려·연계)
/api/v1/achievements      (분기 실적·달성률)
/api/v1/group-performance (그룹 실적 입력·tier 분류)
/api/v1/grade-pools       (그룹 등급 풀 산정)
/api/v1/evaluations       (self/downward(round 1 팀장·2 본부장) 작성·제출·확정, KPI 과제별 점수)
/api/v1/results           (self+downward 집계 결과·percentile·비교, 권한별 범위)
/api/v1/appeals           (이의제기 신청·검토·답변·결정)
/api/v1/compensations     (등급별 인상률 계산·시뮬레이션)
/api/v1/notifications     (D-7/D-1/D-3 알림)
```

각 엔드포인트: 권한 · 요청 body · 응답(봉투 포함) · 에러코드. frontend-engineer 검토·합의 후 확정.

### 1-1. 규칙 엔진 (설정 가능)
등급 구간·그룹 풀·인상률·가중치 정책을 코드 상수로 박지 않는다. `RuleSet`(주기별 설정)에서 읽어 계산하는 **규칙 엔진**을 둔다. 마이그레이션 시드로 에너지엑스 2026 값을 주입한다(business-rules의 기본값). HR이 `/rule-sets`로 편집.

### 2. Prisma 데이터 모델
`apps/api/prisma/schema.prisma`에 도메인 모델의 엔티티/관계를 정의한다.
- DB 컬럼은 snake_case (`@map`으로 매핑), 모델명은 PascalCase.
- enum: `Role(hr_admin/division_head/team_lead/employee)`, `Position(ceo/division_head/team_lead/chief/senior/pro)`, `EvaluationType(self/downward)`+`round`(1=팀장·2=본부장), `Department.type(group/division/team)`, `KpiCategory(revenue/construction/orders/collaboration/development)`, `KpiGroup(performance_core/collaboration_growth)`, `MeasureType(amount/rate/count/qualitative)`, `CycleStatus`, `EvaluationStatus`. (역량 차원·다면평가 없음 — 평가는 KPI 성과로만 구성)
- 관계: User.manager(self relation), Department 트리(parent, group→division→team), Cycle→Template→Item, Evaluation→KpiScore(과제별 점수).
- 마이그레이션: `prisma migrate dev` (개발), 배포는 `prisma migrate deploy`.

### 3. NestJS 모듈 구조
도메인별 모듈로 분리: `auth`, `users`, `cycles`, `templates`, `evaluations`, `calibrations`, `results`. 각 모듈은 controller·service·dto.

```
src/
├── main.ts            # ValidationPipe, 전역 응답 인터셉터, 전역 예외 필터
├── common/
│   ├── interceptors/envelope.interceptor.ts   # {data} 봉투 자동 래핑
│   ├── filters/http-exception.filter.ts        # {error} 봉투
│   ├── guards/roles.guard.ts + decorators/roles.ts
│   └── serializers/                            # snake_case→camelCase
├── prisma/prisma.service.ts
└── modules/<domain>/
```

### 4. 핵심 규율 (경계면 버그 차단)

**응답 봉투 (예외 없음):**
- 전역 인터셉터로 모든 성공 응답을 `{ data }`로 래핑. 목록은 `{ data, meta }`.
- 전역 예외 필터로 모든 에러를 `{ error: { code, message, details } }`로.
- 컨트롤러에서 배열/객체를 봉투 없이 직접 반환하지 않는다.

**camelCase 일관:**
- DB(snake_case) → API(camelCase) 변환을 직렬화 계층 한 곳에서. 응답 필드는 항상 camelCase.

**RBAC 가드 (보안):**
- 모든 보호 엔드포인트에 `@Roles()` + `RolesGuard`. 권한 매트릭스를 코드로 강제.
- 401(미인증, JWT 없음/만료) vs 403(권한 부족) 구분.
- "본인 한정"·"팀 한정" 같은 행 수준 권한은 service에서 소유권 검증.

**점수·가중치·등급 단일 책임 (전부 백엔드, 규칙 엔진 경유):**
- 가중치 합 = 100 검증(저장 시). 위반 시 400 `VALIDATION_ERROR`. 두 KPI 그룹(`performance_core` 70/80% · `collaboration_growth` 20/30%) 모두 포함, 정성 KPI ≤ 30% 검증.
- **점수 산정 흐름 (business-rules §4, 전부 백엔드):**
  1. KPI raw 등급: 각 KPI 실적 → 측정방식별(`measureType`) 등급 매핑(§2) — `amount`/`rate`는 달성률 기준(110%↑→S 등), `count`는 KPI별 건수 임계값(`grading` 설정), `qualitative`는 평가자 직접 부여.
  2. 가중 총점 = `Σ(kpiScore × weight / 100)`(KPI 과제 집계). 백엔드에서만 계산, 프론트 위임 금지.
  3. 최종 등급: 총점 → 등급(`gradeScale` S 96~100 등).
- **그룹 등급 풀 강제:** 그룹 tier(우수/보통/미흡)별 S/A/B/C/D 상한을 초과하는 배분은 거부(경고+제출 차단). 풀 산정은 그룹 실적 달성률로 tier 분류 후 RuleSet.poolRatios 적용.
- **집계:** self(참고)·downward round 1(팀장)·2(본부장) 점수를 가중 집계하여 `EvaluationResult`(종합 등급·점수·percentile) 산출(부서장 평가 가중이 확정 기준).
- **보상 연동:** 확정 등급 → 인상률(S+7%…D+0%) 계산, 전사 평균 ≈3% 모니터링·경고. 시뮬레이션 제공.
- **KPI 캐스케이드:** 그룹→본부→팀→개인 `parentKpiId` 연계. 연계 누락 표시.

**상태 전이 완전성:**
- 상태 전이를 명시적 맵으로 관리하고, 허용되지 않은 전이는 거부.
- 모든 전이 구현 — 특히 `Evaluation.submitted → finalized`(캘리브레이션 후 확정), `Kpi.approved → confirmed`, `Appeal` 4단계 누락 주의.

**코멘트·이의제기:**
- 본부장·팀장 코멘트 미작성 시 평가 제출 차단(422/400). 분기별 필수.
- 이의제기는 결과 통보 후 7일 이내만 접수. 팀장 1차 답변 → HR 최종 결정. 전 이력 `AuditLog` 보관.

### 5. 검증·테스트
- DTO에 `class-validator`로 입력 검증.
- 핵심 로직(가중치 합, 총점, 상태 전이, 권한)에 단위 테스트 권장.
- API가 끝난 모듈은 즉시 qa-inspector에게 검증 요청 (점진적 QA).

## 산출물
- `_workspace/02_contract/contract.md` — 합의된 계약
- `apps/api/` — NestJS 소스 + prisma
- `_workspace/03_backend/progress.md` — 현황·결정 노트

## 흔한 실수 (피한다)
- 봉투 없이 배열 반환 → 프론트 `.filter is not a function` 크래시
- snake_case 응답 누출 → 프론트 타입 불일치
- 프론트 화면만 숨기고 API 가드 누락 → 권한 우회(보안 결함)
- `submitted → finalized` 전이 미구현 → 결과가 영원히 확정 안 됨
