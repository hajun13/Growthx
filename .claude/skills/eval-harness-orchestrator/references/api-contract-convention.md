# API 계약 규약 (Contract-First Convention)

프론트엔드와 백엔드가 **구현 전에 합의**하는 API 계약의 표준 형식. 경계면 불일치(boundary mismatch) 버그의 근본 차단책이다. 백엔드는 이 계약대로 구현하고, 프론트는 이 계약대로 타입을 정의한다. QA는 양쪽이 계약을 지켰는지 교차 검증한다.

계약 산출물은 `_workspace/02_contract/openapi.yaml`(또는 `contract.md`)에 저장하며, 프론트·백엔드 두 에이전트가 **모두 읽는** 단일 파일이다.

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
