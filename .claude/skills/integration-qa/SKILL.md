---
name: integration-qa
description: "인사평가 솔루션의 통합 정합성을 교차 검증하는 QA 스킬. API 응답↔프론트 훅 타입, 응답 봉투 unwrap, snake/camel 필드명, 라우팅(href↔page 경로), 상태 전이, RBAC 권한 가드의 경계면을 양쪽 동시 읽기로 검증. 각 모듈 완성 직후 점진적으로 실행. QA/검증/테스트/정합성/버그 점검 요청 시 사용."
---

# 통합 정합성 검증 (Integration Coherence QA)

풀스택 경계면 버그를 잡는 QA 스킬. 핵심은 **"존재 확인"이 아니라 "양쪽 동시 읽기 + 교차 비교"**, 그리고 **점진적 실행**이다.

## 왜 정적 리뷰로는 못 잡나
- TypeScript 제네릭(`fetchJson<T>()`)은 런타임 응답이 달라도 컴파일 통과.
- `build 성공 ≠ 동작`. `as`·`any`·제네릭이 타입 안전성을 우회.
- "API가 있는가?"와 "API 응답이 호출측 기대와 일치하는가?"는 전혀 다른 검증.

## 검증 영역 (양쪽 동시 읽기)

### A. API 응답 ↔ 프론트 훅
1. 백엔드 컨트롤러의 응답 shape 추출 (`{data}` 봉투 포함 여부)
2. 대응 프론트 훅의 fetch 타입·unwrap 방식 확인
3. 비교: 봉투 일치? `res.data` unwrap? 목록은 `data`(배열)+`meta`?
4. 주의 패턴: 봉투 누락(배열 직접 반환), 페이지네이션 shape 불일치, 즉시응답 vs 최종결과 shape 차이

### B. 필드명 (snake ↔ camel)
1. DB 컬럼(snake_case) → API 응답(camelCase) 변환이 직렬화 계층에 있는가
2. 프론트 타입(camelCase)이 API 응답과 1:1인가
3. snake_case가 응답에 누출되어 프론트에서 `undefined`가 되지 않는가

### C. 라우팅
1. `apps/web/app/` page 파일 경로에서 URL 패턴 추출 (`(group)` 제거, `[param]` 동적)
2. 코드의 모든 `href`/`router.push`/`redirect` 수집
3. 각 링크가 실제 존재하는 경로를 가리키는가 (특히 route group 접두사 누락)

### D. 상태 전이
1. 도메인 모델 상태 머신에서 허용 전이 추출
2. 백엔드의 모든 `status` 업데이트 검색
3. 무단 전이(맵에 없음)·죽은 전이(맵에 있으나 코드에 없음) 식별
4. 특히 `submitted → finalized` 구현 확인

### E. 권한 (RBAC)
1. 백엔드 보호 엔드포인트의 `@Roles()`/가드 추출
2. 권한 매트릭스(domain-model)와 대조
3. **프론트만 숨기고 API 가드가 없는** 엔드포인트 식별 (보안 결함)
4. "본인/팀 한정" 행 수준 권한이 service에 구현됐는가

## 인사평가 도메인 특화 체크
`domain-model.md` + `business-rules.md` 기준으로:
- 가중치 합(=100)·정성 KPI(≤30%) 검증이 백엔드에 있고, 프론트는 표시만 하는가
- 총점·등급·달성률 매핑·인상률이 백엔드 단일 계산(규칙 엔진)인가 (프론트 재계산 불일치 없는가)
- 등급·풀·인상률·가중치가 **하드코딩이 아니라 RuleSet(설정값)**에서 읽히는가
- **그룹 등급 풀 상한 강제**가 백엔드에 있는가 (풀 초과 배분 시 차단). 프론트만 막지 않는가
- 평가 유형(self/downward+round 1팀장·2본부장) 문자열이 양쪽 일치 (peer·upward 없음)
- KPI 분류 — category(revenue/construction/orders/collaboration/development)·group(performance_core/collaboration_growth)·measureType(amount/rate/count/qualitative) 문자열이 양쪽 일치
- 측정방식별 등급 매핑(amount/rate=달성률, count=건수 임계값)이 일관 적용되는가
- 조직 계층(Department.type=group/division/team) 문자열이 양쪽 일치
- 역할 4값(hr_admin/division_head/team_lead/employee)이 양쪽 일치, 권한 매트릭스대로 가드
- 평가 상태(not_started→in_progress→submitted→finalized) 4값 일치, KPI·Appeal 상태 머신 구현
- **코멘트 의무화**(본부장·팀장 미작성 시 제출 차단)가 백엔드에 있는가
- **이의제기 7일 기한**·self+downward 집계·percentile 계산이 백엔드인가
- 분포 차트(DistributionBarChart) 데이터 shape이 API 응답과 일치하는가

## 점진적 QA (incremental)
전체 완성 후 1회가 아니라 **각 모듈 완성 직후** A~E를 해당 모듈 범위로 실행한다. 초기 경계면 불일치가 후속 모듈로 전파되어 수정 비용이 폭증하기 때문.

## 검증 체크리스트 (리포트에 포함)
```markdown
### {모듈명} 통합 정합성
#### API ↔ 프론트
- [ ] 응답 봉투({data}/{data,meta}) 일치, 훅이 res.data unwrap
- [ ] 모든 응답 필드 camelCase, 프론트 타입 1:1
- [ ] 모든 API 엔드포인트에 대응 훅 존재·실제 호출
#### 라우팅
- [ ] 모든 href/router.push가 실제 page 경로와 매칭 ((group) 제거 고려)
#### 상태 머신
- [ ] 모든 status 업데이트가 전이 맵에 정의 (무단 전이 없음)
- [ ] 맵의 모든 전이가 코드에 구현 (submitted→finalized 포함)
#### 권한
- [ ] 모든 보호 엔드포인트에 RBAC 가드 (프론트만 숨긴 곳 없음)
- [ ] 본인/팀 한정 행 수준 권한 구현
#### 도메인
- [ ] 가중치 합 검증(백엔드), 총점 단일 계산
- [ ] 평가 유형·상태 문자열 양쪽 일치
```

## 결함 리포트 형식
실패 항목은 `파일:라인 + 원인 + 수정방법`을 명시한다:
```
[FAIL] 평가 목록 봉투 누락
  생산자: apps/api/src/modules/evaluations/evaluations.controller.ts:42 — 배열 직접 반환
  소비자: apps/web/hooks/useEvaluations.ts:18 — res.data 기대
  수정: 전역 봉투 인터셉터 적용 또는 컨트롤러에서 {data} 래핑
```
경계면 결함은 **생산자·소비자 양쪽 담당 에이전트 모두**에게 `SendMessage`로 통지한다.

## 산출물
- `_workspace/05_qa/qa-report-{module}.md` — 통과/실패/미검증 구분
- 모든 모듈 통과 시 릴리스 게이트 통과를 리더 + release-engineer에게 통지
