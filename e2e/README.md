# @growthx/e2e — Playwright E2E 테스트 하네스

에너지엑스 인사 평가 솔루션의 **엔드투엔드 테스트**. Playwright Test Agents
(🎭 planner → generator → healer) 루프로 시나리오를 만들고 유지한다.

## 구조

| 경로 | 역할 |
|------|------|
| `config.ts` | 공유 상수(URL·인증 키·테스트 계정) |
| `playwright.config.ts` | baseURL·webServer·projects(setup→chromium) |
| `tests/global.setup.ts` | `/auth/login` → JWT 를 storageState localStorage 에 주입 |
| `tests/fixtures.ts` | 인증된 `page` + 도메인 헬퍼 — 모든 생성 테스트의 진입점 |
| `tests/seed.spec.ts` | 시드 테스트 — 부트스트랩 검증 + 생성 테스트의 본보기 |
| `specs/` | 🎭 planner 산출물(사람이 읽는 MD 테스트 플랜) |
| `tests/**` | 🎭 generator 산출물(.spec.ts) |

## 사전 조건

1. **DB(:5432) 가용** + 테스트 데이터 시드:
   ```pwsh
   cd ../apps/api; npx ts-node prisma/seed-test-data.ts   # 멱등
   ```
   (계정 `test@energyx.co.kr / 1234`, hr_admin — 전 페이지 데이터 포함)
2. 앱 스택은 `webServer` 가 자동 기동하거나, 이미 떠 있으면(로컬 dev/Docker) 재사용.

## 실행

```pwsh
pnpm -C e2e test            # 전체
pnpm -C e2e test:ui         # UI 모드
pnpm -C e2e report          # 마지막 리포트
```

다른 호스트/포트는 환경변수로: `E2E_BASE_URL`, `E2E_API_URL`, `E2E_USER_EMAIL/PASSWORD`.

## 🎭 에이전트 루프 (Claude Code)

`.claude/agents/` 의 `playwright-test-planner|generator|healer` 사용. Playwright
업데이트 시 `npx playwright init-agents --loop=claude` 로 정의를 **재생성**한다.

- **planner** — 앱을 탐색해 `specs/*.md` 테스트 플랜 작성 (도메인 규칙은
  `.claude/skills/eval-harness-orchestrator/references/business-rules.md` 기준)
- **generator** — `specs/` → `tests/*.spec.ts` (커스텀 `fixtures` 사용)
- **healer** — 실패 테스트 재실행·자가수정

## 주의

- 인증은 **localStorage(`gx.*`)** 기반(쿠키 아님). storageState origins 에 주입.
- 테스트가 DB 를 변형하므로, 결정적 결과가 필요하면 시나리오 전후 재시드.
