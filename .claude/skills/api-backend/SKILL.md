---
name: api-backend
description: "인사평가 솔루션의 모듈러 모놀리식 백엔드 API(NestJS + Prisma + PostgreSQL)를 설계·구현. API 계약 작성, OpenAPI 계약 발행(@nestjs/swagger), Prisma 데이터 모델/마이그레이션, NestJS 모듈(컨트롤러·서비스·DTO)·모듈 경계(바운디드 컨텍스트), RBAC 권한 가드, 평가 점수·가중치 계산, 상태 전이, 외부 API 연동 어댑터(integration) 구현 시 사용. 백엔드/API/데이터모델/서버 로직을 만들거나 수정·추가·보완할 때 반드시 사용."
---

# 인사평가 백엔드 API (NestJS + Prisma + PostgreSQL)

**모듈러 모놀리식** API 서버(프론트와 분리 배포·내부는 바운디드 컨텍스트 모듈)를 **계약 우선(contract-first)** 으로 구현하는 스킬. 응답 봉투·camelCase·RBAC·점수 계산의 단일 책임을 지킨다.

## 단일 진실 공급원
- **코드 구조(모노레포·모듈 경계·파일상한·매니페스트): `eval-harness-orchestrator/references/architecture.md`**
- 엔티티·역할(4)·KPI 분류·평가 유형·상태·명명: `eval-harness-orchestrator/references/domain-model.md`
- 수치 규칙(등급·풀·인상률·가중치·캐스케이드·RBAC): `eval-harness-orchestrator/references/business-rules.md`
- 응답 봉투·경로·인증·OpenAPI 발행: `eval-harness-orchestrator/references/api-contract-convention.md`
- 외부 API 소비/제공: `eval-harness-orchestrator/references/integration-adapter.md`

## 절차

### 1. API 계약 작성 (코드보다 먼저)
도메인 모델 기반으로 엔드포인트를 계약 형식으로 명세하고 `_workspace/02_contract/contract.md`에 저장. 표준 리소스:

> **계약 SSOT 전환:** 과도기(Phase 1~2)엔 `_workspace/02_contract/`가 **사람이 합의하는** 계약 SSOT다. Phase 3에서 `@nestjs/swagger` 발행 `openapi.json`이 **기계가 읽는** SSOT가 되고, 02_contract는 발행 스펙으로 대체/링크된다 (`api-contract-convention.md` §7).

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
/api/v1/evaluations       (self/downward 3단계(round1 팀장·2 본부장·3 그룹대표) 작성·제출·확정, KPI 과제별 점수)
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
- enum: `Role(hr_admin/division_head/team_lead/employee)`, `Position(ceo/division_head/team_lead/chief/senior/pro)`, `EvaluationType(self/downward)`+`round`(1=팀장·2=본부장·3=그룹대표), `Department.type(group/division/team)`, `KpiCategory(revenue/construction/orders/collaboration/development)`, `KpiGroup(performance_core/collaboration_growth)`, `MeasureType(amount/rate/count/qualitative)`, `CycleStatus`, `EvaluationStatus`. (역량 차원·다면평가 없음 — 평가는 KPI 성과로만 구성)
- 관계: User.manager(self relation), Department 트리(parent, group→division→team), Cycle→Template→Item, Evaluation→KpiScore(과제별 점수).
- 마이그레이션: `prisma migrate dev` (개발), 배포는 `prisma migrate deploy`.

### 3. NestJS 모듈 구조 (모듈러 모놀리식 — `architecture.md` §2)
도메인을 **바운디드 컨텍스트 모듈**로 분리한다. 모듈명 ↔ `@@schema` ↔ 소유 엔티티는 **`domain-model.md` §4-1 매핑표가 권위**다: `auth`·`org`·`cycles`·`kpi`·`evaluations`·`calibrations`·`results`·`compensation`·`notifications`·`audit`·`integration`. 임의로 모듈을 자르지 말고 이 매핑을 따른다(모듈 1개 = `@@schema` 1개, 교차참조 ID-only). 각 모듈은 **수직 슬라이스**(controller·service·dto·mapper·테스트·매니페스트 README가 한 폴더에 자기완결).

```
src/
├── main.ts            # ValidationPipe, 전역 응답 인터셉터, 전역 예외 필터, Swagger 발행
├── common/
│   ├── interceptors/envelope.interceptor.ts   # {data} 봉투 자동 래핑
│   ├── filters/http-exception.filter.ts        # {error} 봉투
│   ├── guards/roles.guard.ts + decorators/roles.ts
│   └── serializers/                            # snake_case→camelCase
├── prisma/prisma.service.ts
└── modules/<context>/
    ├── README.md                  # 매니페스트: 책임·공개 API·소유 데이터·불변식
    ├── <context>.module.ts
    ├── <context>.controller.ts    # @ApiTags·@ApiResponse (OpenAPI 발행)
    ├── <context>.service.ts
    ├── <context>.mapper.ts
    ├── dto/                       # @ApiProperty (스키마 원천)
    └── __tests__/
```

**모듈 경계 (미래의 절단선 — 반드시 지킴):**
- **모듈 간 DB 직접 조인 금지.** 다른 컨텍스트 데이터는 그 모듈의 **서비스 인터페이스**로만. 나중에 별도 서비스로 떼어낼 때 호출부만 HTTP로 바꾸면 되게.
- 모듈은 배럴(`index.ts`)로 **공개 API만** export. 다른 모듈 내부 파일을 깊은 경로로 import 금지.
- **Postgres schema 네임스페이스**로 데이터 분리(`@@schema`), 교차 참조는 ID로만.
- **파일당 ~200줄 상한.** 서비스가 비대하면 use-case별 파일로 쪼갠다(`packages/config`의 ESLint `max-lines`).

### 3-1. OpenAPI 발행 (계약 자동 동기화 — `api-contract-convention.md` §7)
- 컨트롤러·DTO에 `@nestjs/swagger` 데코레이터를 달아 `openapi.json`을 발행한다(DTO가 스키마 원천).
- 봉투는 공용 래퍼 스키마(`Envelope<T>`·`PaginatedEnvelope<T>`·`ErrorEnvelope`)로 한 번 정의하고 모든 응답이 참조.
- 발행된 스펙을 `packages/contracts`가 orval로 codegen → 프론트·외부 소비처가 받는다. 손으로 타입 베끼게 두지 않는다.

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
- **집계:** self(참고)·downward round1(팀장)·2(본부장)·3(그룹대표)를 **단계가중(0.5/0.3/0.2, 없는 단계 재정규화) + 평가자 동일인 예외**(①1차=최종→1차 100% ②2차=최종→1차 70%+최종 30%)로 합산해 `EvaluationResult`(종합 등급·점수·percentile) 산출. 역량은 `combineFinal`에서 기본 0% 반영(perf 1·comp 0). 가중치는 `RuleSet.weightPolicy` 설정값.
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
