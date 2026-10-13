# shadcn/ui 전면 전환 + @shadcn/lint 게이트 + QA — 실행 계획 (2026-10-13)

코디네이터: 메인 Claude 세션(Orca Run). 워커: Orca 세션(각자 내부에서 서브에이전트 팬아웃 가능).
요청 원문: "shadcn MCP 설치해서 전체 shadcn으로 바꾸고, shadcn lint 설치해서 빌드·테스트할 때 같이 돌리자. QA를 제대로 한 적이 없으니
테스트도 제대로. 여러 세션 + 에이전트 팀 + 서브에이전트, 토큰 무관 빠르게."

## 0. 현재 상태 (코디네이터가 이미 한 것)

- 브랜치: `feat/shadcn-migration` (← `feat/keycloak-sso` e862b45, 최신 브랜치). **커밋·푸시 금지**(사용자 미요청) — 변경은 워킹트리에만.
- `pnpm install` 완료(node_modules hoisted — `.npmrc node-linker=hoisted`).
- `apps/web` devDeps 추가: `@shadcn/lint@0.2.1`, `eslint@10`, `@typescript-eslint/parser@8`, `shadcn@4.21` (CLI).
- `.mcp.json`: `playwright-test` + `shadcn`(`npx shadcn@latest mcp`) 두 서버. shadcn MCP 로 레지스트리 검색/예제 조회 가능,
  컴포넌트 추가는 `pnpm -C apps/web exec shadcn add <name>`.
- **실측 결론: `@shadcn/lint` 의 테마 오라클은 Tailwind v4 전용**(`tailwindcss.__unstable__loadDesignSystem`, 없으면
  "is not Tailwind v4" throw). 현재 Tailwind 3.4.6 → **v4 업그레이드가 선행 조건**.

## 1. 확정 결정 (워커가 재논의하지 않는다)

1. **Tailwind 3.4 → 4.x** (CSS-first `@theme`). `tailwindcss-animate` → `tw-animate-css`. postcss → `@tailwindcss/postcss`.
2. **Next 14.2.5 / React 18.3.1 유지** (프레임워크 업그레이드는 범위 밖). 따라서 **`components/ui/*` 는 전부 `React.forwardRef` 유지**
   — React 18 은 함수 컴포넌트에 `ref` 를 prop 으로 넘기지 않아, shadcn v4 레지스트리 스타일(forwardRef 없는 함수 컴포넌트)을
   그대로 쓰면 Radix `asChild` 트리거(Tooltip/Popover/Dropdown)의 앵커 ref 가 끊겨 위치가 깨진다. CLI 로 추가한 컴포넌트는
   `data-slot` 속성은 살리고 forwardRef 로 변환한다.
3. **디자인 SSOT = 루트 `DESIGN.md`(Part 하이브리드) 불변.** 겉모습은 그대로, 구현만 shadcn 으로. 토큰은 CSS 변수(shadcn 방식)로.
   radius 의미 보존: `rounded-sm`=6px(라벨) / `rounded-md`=8px(컨트롤) / `rounded-lg`=10px(카드). 등급 S~D 5색·상태색·사이드바 퍼플 유지.
4. **3계층 구조**
   - L1 `apps/web/components/ui/*` — shadcn 프리미티브만(cva variants 로 DESIGN.md 인코딩). 여기만 스타일을 "소유"한다.
   - L2 `apps/web/components/*` — 앱 컴포지션(PageHeader·DataTable·GradeChip·StatusBadge 등). **L1 조합으로만** 구현, 자체 버튼/입력/다이얼로그 금지.
   - L3 `apps/web/features/*`, `apps/web/app/*` — L1/L2 import. raw `<button>/<input>/<select>/<textarea>/<table>` 손스타일 금지.
   - shadcn 과 중복되는 레거시 범용 래퍼(`components/Button|Card|Modal|Toast|Select|Tabs|TextField|Avatar|Collapsible|Pagination|SegmentedControl|Breadcrumb|HelpTooltip|SearchInput|States` 등)는
     사용처를 L1 로 옮긴 뒤 **삭제**한다(최종 T9). 정확한 매핑표는 T1 이 `_workspace/04_frontend/shadcn-guide.md` 에 확정.
5. **@shadcn/lint 6규칙 전부**(`no-restyle`, `no-raw-colors`, `no-arbitrary-values`, `no-inline-styles`, `no-unknown-classes`,
   `require-static-classes`) — 최종 상태 **전부 error, 위반 0**. 정당한 예외만 `// eslint-disable-next-line shadcn/<rule> -- <사유>`.
   suppressions 파일(베이스라인)은 최종 산출물에 남기지 않는 것이 목표(남으면 사유와 건수를 보고).
6. **게이트:** `pnpm lint`(turbo) 가 **build 와 test 의 선행 조건**. `pnpm build`·`pnpm test:e2e`·Docker 빌드에서 lint 가 함께 돈다.
7. **동작 불변:** 훅·API 호출·상태 로직·문구·접근성 이름(라벨/버튼 텍스트/role)은 바꾸지 않는다 — E2E(역할/라벨 기반 로케이터)가
   전환 회귀 게이트다. 화면 문구 변경 금지(필요하면 코디네이터에 질의).

## 2. 태스크 DAG

| ID | 세션 | 워크트리 | 의존 | 내용 |
|----|------|---------|------|------|
| T1 | foundation | current | — | Tailwind v4 + 테마 + shadcn 프리미티브 전체 + lint 인프라/게이트 + 공용 L2 + app/** + 가이드 |
| T2 | qa | new-child(전환 전 코드) | — | 격리 테스트 스택 + API 테스트 + 역할별 E2E + 시각 기준선 + 기준선 버그 리포트 |
| G1~G7 | fe-g1~g7 | current | T1 | 기능 그룹별 전환(파일 소유권 분리 — `groups.md`) |
| T9 | integrate | current | G1~G7 | 레거시 래퍼·사용처 0 죽은 컴포넌트 삭제·전역 lint 0·typecheck·build·Docker 빌드 |
| T10 | regression | current | T2,T9 | QA 스위트 이관 → 전환본 대상 전체 E2E·API·시각 비교 → 결함 수정 루프 |

## 3. 파일 소유권 (동시 편집 충돌 방지 — 소유 밖 파일은 수정 금지, 필요하면 코디네이터에 `ask`)

- **T1:** `packages/ui/**`, `packages/design-system/**`(필요 시), `apps/web/components/ui/**`, `apps/web/app/**`,
  `apps/web/{tailwind.config.ts,postcss.config.mjs,components.json,eslint.config.mjs,package.json,next.config.mjs}`,
  `apps/web/lib/{utils.ts,palette.ts,grade.ts}`, 루트 `package.json`/`turbo.json`, 공용 L2(아래 목록), `_workspace/04_frontend/shadcn-guide.md`.
  공용 L2 = AppShell, PageHeader, PageContainer, SectionHeader, Breadcrumb, States, InfoBanner, PeriodBanner, FilterChipBar,
  SearchInput, SegmentedControl, Tabs, Select, TextField, Button, Card, Modal, Toast, Avatar, Collapsible, Pagination, HelpTooltip,
  DesignLabel, DataTable, StatusBadge, GradeChip, CycleTypeBadge, ManualButton, ApiClientInit, NotificationBell, PasswordChangeGate,
  OrgCascadeFilter, ScopeSelect, UserCombobox, WidgetCard, StatCard, HeaderMetrics.
- **G1~G7:** T1 완료 후 `groups.md` 의 그룹별 소유 경로로 배정.
- **T2:** 별도 워크트리의 `e2e/**`, `apps/api/**/*.spec.ts`, 백엔드 버그 수정(`apps/api/src/**`), `_workspace/05_qa/**`. `apps/web` 수정 금지(리포트만).

## 4. 공통 규칙 (모든 워커)

- **git 파괴 명령 금지:** `checkout --`, `restore`, `reset`, `stash`, `clean`, `commit`, `push`, `rebase`. 다른 세션이 같은 워킹트리를 쓴다.
- 프론트 코드를 만지는 세션/서브에이전트는 **코드를 건드리기 전에 `nextjs-frontend` 스킬을 Skill 도구로 먼저 호출**(CLAUDE.md 필수).
- 서브에이전트 모델: frontend/QA/designer = sonnet, backend = opus (CLAUDE.md 정책. 일괄 상향 금지 — 속도는 병렬 팬아웃으로).
- 같은 `apps/web` 에서 여러 세션이 동시에 `next build`/`next dev` 를 돌리면 `.next` 가 깨진다 → **T1·T9·T10 외에는 next build/dev 금지.**
  기능 그룹 세션의 검증 = `pnpm -C apps/web exec eslint <소유 경로>` 0 + `pnpm -C apps/web typecheck`(남의 파일 에러는 보고만).
- 진행 노트: `_workspace/04_frontend/shadcn-<세션>.md`(프론트) / `_workspace/05_qa/`(QA).
- 끝나면 Orca `worker_done` 1회 — 변경 파일, 검증 결과(명령+수치), 남은 것/보류를 정직하게.
