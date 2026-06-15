# API 계약 규약 (Contract-First Convention)

프론트엔드와 백엔드가 **구현 전에 합의**하는 API 계약의 표준 형식. 경계면 불일치(boundary mismatch) 버그의 근본 차단책이다. 백엔드는 이 계약대로 구현하고, 프론트는 이 계약대로 타입을 정의한다. QA는 양쪽이 계약을 지켰는지 교차 검증한다.

계약 산출물은 `_workspace/02_contract/openapi.yaml`(또는 `contract.md`)에 저장하며, 프론트·백엔드 두 에이전트가 **모두 읽는** 단일 파일이다.

> **계약 = 발행된 OpenAPI (§7).** 멀티서비스 구조에서 계약은 손으로 베끼는 문서가 아니라 **백엔드가 `@nestjs/swagger`로 발행하고 소비처가 codegen으로 받는 기계가 읽는 스펙**이다. 봉투·camelCase·경로 규약(§1~5)은 그대로 유지하되, 그 규약을 **OpenAPI로 표현하고 자동 동기화**하는 것이 목표다. 구조 전반은 `architecture.md`, 외부 서비스 연동은 `integration-adapter.md` 참조.

## 1. 응답 래핑 규약 (필수 고정)

모든 API 응답은 다음 봉투(envelope)를 사용한다. 래핑 여부가 흔들리면 런타임 크래시가 발생하므로 예외 없이 적용한다.

**단건 / 객체 응답:**
```json
{ "data": { ...resource } }
```

**목록 응답 (페이지네이션 포함):**
```json
{ "data": [ ...resources ], "meta": { "page": 1, "pageSize": 20, "total": 137 } }
```

**에러 응답 (모든 4xx/5xx):**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "weight 합계는 100이어야 합니다", "details": [] } }
```

> 프론트 훅은 항상 `res.data`를 꺼내 사용한다. 목록은 `res.data`(배열) + `res.meta`. 백엔드는 절대 봉투 없이 배열/객체를 직접 반환하지 않는다.

## 2. 계약 명세 형식

각 엔드포인트를 다음 표 형식으로 명세한다 (OpenAPI yaml로 작성하면 더 좋다):

```
### POST /api/v1/evaluations
- 권한: hr_admin, division_head, team_lead, employee (배정된 경우)
- 요청 body: { cycleId, evaluateeId, type }
- 응답 201: { data: Evaluation }
- 에러: 400 VALIDATION_ERROR, 403 FORBIDDEN, 409 ALREADY_EXISTS
```

## 3. 필드명 규약

- 모든 요청/응답 필드는 **camelCase** (도메인 모델 §6 참조).
- 식별자는 `xxxId` (예: `cycleId`, `evaluateeId`).
- 날짜/시간은 ISO 8601 문자열 (`"2026-06-02T09:00:00Z"`).
- 금액·점수는 number, 불리언은 `isXxx`/`hasXxx`.

## 4. 버전·경로 규약

- 베이스 경로: `/api/v1`
- 리소스는 복수형 명사: `/evaluations`, `/cycles`, `/users`
- 중첩은 1단계까지: `/cycles/{cycleId}/evaluations`

## 5. 인증 규약

- 백엔드는 JWT(Bearer) 검증. 프론트는 `Authorization: Bearer <token>` 헤더 첨부.
- 401(미인증)과 403(권한없음)을 구분한다. 프론트는 401→로그인 리다이렉트, 403→권한 안내.

## 6. 계약 변경 프로토콜

구현 중 계약을 바꿔야 하면 — 한쪽이 임의 변경하지 않는다:
1. 변경 제안자가 `SendMessage`로 상대 에이전트 + QA에게 통지
2. `_workspace/02_contract/`의 계약 파일을 갱신 (변경 이력 주석 추가)
3. 양쪽 모두 갱신된 계약 반영 후 진행

> 계약을 코드보다 먼저, 그리고 항상 최신으로 유지하는 것이 이 하네스의 핵심 규율이다.

## 7. OpenAPI 발행 & codegen (계약 자동 동기화)

손으로 fetch 타입을 쓰면 계약과 코드가 어긋난다. 백엔드가 OpenAPI를 **발행**하고 소비처가 **codegen**으로 받아, 계약이 깨지면 빌드가 즉시 잡게 한다.

**발행 (백엔드):**
- NestJS 컨트롤러·DTO에 `@nestjs/swagger` 데코레이터(`@ApiTags`·`@ApiResponse`·`@ApiProperty`)를 단다. DTO가 곧 스키마의 원천.
- 부트스트랩에서 `SwaggerModule`로 `openapi.json`을 빌드 산출물로 내보낸다(`/api/docs` 노출 + 파일 emit).
- 봉투(§1)는 공용 래퍼 스키마(`Envelope<T>`·`PaginatedEnvelope<T>`·`ErrorEnvelope`)로 한 번 정의하고 모든 응답이 참조하게 한다. ⚠ `@nestjs/swagger`는 제네릭 `Envelope<T>`를 자동 추론하지 못한다 — `getSchemaPath()` + `allOf`로 데이터 타입을 합성하는 **커스텀 `@ApiOkEnvelope(Dto)` 데코레이터**를 만들어 각 엔드포인트에 적용한다(`@ApiExtraModels`로 모델 등록).

**소비 (프론트·다른 서비스):**
- 발행된 `openapi.json`을 `packages/contracts`에서 **orval**로 codegen → 타입 + react-query 훅 클라이언트 생성.
- 프론트는 손으로 fetch/타입을 쓰지 않고 생성된 클라이언트를 import. 봉투 unwrap·인증 헤더는 orval mutator(공용 fetch 래퍼)에서 한 곳 처리.
- **점진 전환 인증 충돌 주의:** orval mutator는 기존 `lib/api.ts`의 인증 로직(JWT refresh·토큰 회전·401 재시도·프록시 분기)을 **재사용/이관**해 단일 소스로 둔다. 전환 중 수동 래퍼와 생성 클라이언트가 인증 상태를 **각자 관리하지 않게** — mutator를 기존 `request()`를 감싸는 얇은 어댑터로 시작하는 점진 경로를 권장.
- `turbo.json`에 `contracts#generate`를 `web#build`의 선행으로 걸어, 계약이 바뀌면 자동 재생성 → 타입 불일치는 컴파일 에러로 노출.

**도구:** 발행 = `@nestjs/swagger`, 클라이언트 = `orval`(react-query). 단순 타입만 필요하면 `openapi-typescript`도 가능.

## 8. 버저닝 & 외부 인증 (서비스 간 계약)

- **버전:** 베이스 `/api/v1`. 공개(외부 소비자용) 엔드포인트는 깨는 변경 금지 — 바꿔야 하면 `/api/v2` 신설 + 구버전 유예 유지.
- **사람 인증 vs 서비스 인증:** 사람은 JWT Bearer(§5), **서비스 간 호출은 API 키 또는 OAuth2 client credentials**. 키별 스코프(읽기 전용 등)를 RBAC로 강제.
- **public/internal 분리:** Swagger 태그/그룹으로 외부 공개 스펙과 내부 전용을 분리해, 내부 엔드포인트가 외부 OpenAPI에 새지 않게 한다.

> 외부 API를 **소비**할 때의 어댑터(부패 방지)·회복탄력성·비밀 관리는 `integration-adapter.md` 참조.
