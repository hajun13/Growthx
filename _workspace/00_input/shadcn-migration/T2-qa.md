# T2 — qa 세션 명세 (별도 워크트리 — 전환 "전" 코드 기준선)

이 세션은 **별도 Orca 워크트리**에서 돈다(전환 전 코드 = feat/keycloak-sso e862b45 상태). 메인 워크트리
`C:\Users\user\orca\Growthx` 에서는 다른 세션들이 shadcn 전환을 진행 중이다 — **메인 워크트리 파일은 읽기만**.
먼저 메인 워크트리의 `_workspace/00_input/shadcn-migration/plan.md` 를 읽어라. `integration-qa` 스킬을 Skill 도구로 먼저 호출하라.
서브에이전트: qa-inspector/일반 = sonnet, 백엔드 버그 수정 = backend-engineer(opus). 독립 작업은 병렬 팬아웃.

배경: 이 프로젝트는 **QA 를 제대로 한 적이 없다**(사용자 원문). E2E 는 `e2e/` 에 스펙 4개 수준(login-dashboard, self-eval, downward-eval,
midterm-checkin) + API vitest 20 spec 뿐. 목표 = **신뢰할 수 있는 회귀 스위트 + 실제 결함 발굴**, 그리고 그 스위트가
shadcn 전환(T3~T9)의 **회귀 게이트**가 된다.

## 0. 환경 (격리 — 기존 데이터·컨테이너 절대 건드리지 말 것)

- 레포에 `.env` 가 없다(`.env.example`, `apps/api/.env.example` 만). Docker Desktop 은 방금 기동 중이었다 — `docker info` 가 정상이 될 때까지
  기다려라(Monitor/until 루프). 장시간 실패 시 escalation.
- **기존 컨테이너·볼륨(growthx-*, growthx-manual-*) 사용/삭제 금지.** 포트 3000/4000/5432(작업), 3100/4100/5532·3200/4200(매뉴얼)도 피한다.
- 권장 구성: 전용 postgres 컨테이너(예: `docker run -d --name growthx-qa-db -p 5632:5432 postgres:16-alpine` + 전용 볼륨) →
  이 워크트리에서 `pnpm install` → `prisma migrate deploy` → `prisma:seed` + `prisma/seed-test-data.ts`(test@energyx.co.kr / 1234 등) →
  API 를 `AUTH_MODE=password` 로 **:4300**(nest build 후 node dist 권장 — watch 모드 금지), web 을 `NEXT_PUBLIC_AUTH_MODE=password`,
  `API_PROXY_TARGET=http://localhost:4300` 로 **`next build && next start -p 3300`**(dev 모드는 on-demand 컴파일로 flaky).
  `deploy/seed-data.sql` 은 구 스키마라 쓰지 마라. 실데이터 덤프 복제도 하지 마라(시드 데이터만 — 개인정보 무관 테스트 환경).
- 재기동/정리 스크립트를 `e2e/qa-stack/`(setup.sh·teardown.sh·README) 로 남겨 T10(전환본 회귀)이 **같은 DB/API 에 web 만 메인 워크트리
  빌드로 바꿔** 돌릴 수 있게 하라(`E2E_BASE_URL`/`E2E_API_URL` env 로 대상 지정 — `e2e/config.ts` 가 이미 지원).
- 역할별 계정: hr_admin·division_head·team_lead·employee (+ 3단계 평가 체인이 되는 계정 세트). 시드에 없으면 시드/setup 스크립트로 만든다
  (테스트 전용, 멱등). `e2e/tests/global.setup.ts` 를 역할별 storageState/토큰 다중화로 확장.

## 1. API 테스트
- `pnpm -C apps/api test` 실행 → 실패 triage. 핵심 도메인 규칙에 단위 테스트 보강(backend-engineer 서브에이전트, opus):
  등급 산정(floor semantics·측정방식별), 다단계 결합 50/30/20 + 동일인 예외①②(+겸직 finalAlsoSecond), 역량 환산, KPI 순차 결재 전이,
  중간점검 순차 확인, 결과 공개 게이트(calibration/closed·본인 closed 후), RBAC 스코프(팀장 자기팀·본부장 자기본부·그룹대표 자기그룹).
  근거: `.claude/skills/eval-harness-orchestrator/references/business-rules.md`, `domain-model.md`, CLAUDE.md 변경 이력.
- Playwright `request` 기반 **API 계약/권한 스모크**(e2e 에 프로젝트로 추가): 역할별로 주요 GET 이 200/403/404 를 기대대로 내는지,
  응답 봉투(`{data}`/`{data,meta}`/`{error}`) 유지.

## 2. E2E (역할/라벨 기반 로케이터만 — CSS 클래스·구조 선택자 금지 → shadcn 전환 후에도 그대로 통과해야 한다)
- **라우트 × 역할 스모크 매트릭스:** `apps/web/app/**/page.tsx` 33개 라우트 × 4역할 — 렌더 성공, 미처리 콘솔 에러 0, 5xx 0,
  권한 없는 화면은 접근불가 처리(리다이렉트/Forbidden), 사이드바 메뉴 노출이 권한 매트릭스와 일치.
- **핵심 플로우(상태 변화 포함, 테스트 데이터는 setup 에서 만들고 끝나면 원복/격리):** KPI 작성→제출→1·2·최종 순차 결재→확정 / 중간 단계 반려,
  본인평가 임시저장→제출, 부서장 평가(다단계), 중간점검 순차 확인, 역량평가 시트 저장/제출, 결과 공개 게이트(사이클 상태별),
  이의제기, 관리(평가 운영 일정·사용자·규칙·권한) 핵심 CRUD, 알림. 기존 4개 스펙은 유지·보강.
- **시각 기준선:** 별도 Playwright 프로젝트 `visual`(기능 스위트와 분리 — 하드 게이트 아님, 리뷰 보조) — 역할별 핵심 화면 ~20장
  `toHaveScreenshot`(동적 텍스트/날짜 마스킹). 전환 전 기준선을 이 워크트리에서 생성.
- 기존 스크립트 유지: 루트 `pnpm test:e2e` 가 기능 스위트를 돈다(visual 은 `pnpm test:e2e:visual` 별도).

## 3. 실행·triage·수정
- 전환 전 코드(이 워크트리 스택)로 전체 실행 → 실패를 **테스트 결함 / 앱 결함** 으로 분류. 테스트 결함은 고친다.
- **백엔드 결함:** 재현 테스트 먼저 → 수정(apps/api — 이 워크트리에서. 메인의 전환 작업은 apps/web 만 건드리므로 병합 충돌 없음).
- **프론트 결함:** apps/web 은 **수정하지 말고** 재현 스텝·기대/실제·스크린샷·파일:라인 추정을 `_workspace/05_qa/web-defects.md` 에 기록하고,
  심각도 High 이상은 즉시 코디네이터에게 orchestration `send`(status). (전환 세션들이 고친다)
- 리포트: `_workspace/05_qa/qa-baseline-report.md` — 커버리지 표(라우트×역할, 플로우), 통과/실패 수치, 결함 목록(심각도), 실행법.
  (이 워크트리의 `_workspace` 에 쓰고, 경로를 worker_done 에 명시)

## 완료 기준
- 기능 E2E 스위트 + API 테스트가 **전환 전 코드에서 통과**(앱 결함으로 인한 실패는 `test.fail`/skip 이 아니라 결함 목록으로 추적 — 어떤 테스트가
  어떤 결함 때문에 빨간지 명시), visual 기준선 생성, qa-stack 스크립트로 재현 가능.
- `worker_done` 에 이 워크트리 경로·브랜치, 변경 파일 목록, 수치(테스트 수/통과/실패), 결함 요약, T10 에서 메인으로 옮길 파일 목록.
