# shadcn 전환 — T1 foundation 결과 (2026-10-13)

가이드: `_workspace/04_frontend/shadcn-guide.md` (기능 세션 입력). 브리프: `_t1-l1-brief.md`, `_t1-l2-brief.md`.

## 1. 변경 요약
| 영역 | 내용 |
|---|---|
| Tailwind | 3.4.6 → **4.3.3** (`@tailwindcss/postcss`, `tw-animate-css`). `tailwind.config.ts`·JS preset 삭제. 토큰 SSOT = **`packages/ui/theme.css`**(`:root/.dark` shadcn 변수 + `@theme inline` 매핑 + `@theme` 도메인 토큰 + `@utility gx-*`). radius sm=6/md=8/lg·xl·2xl=10 보존, shadow xs/sm/md/lg/xl = 옅은 중립 그림자로 재정의, px 타이포 토큰(`text-12`, `text-11h` …), `--radius-xs`, `tracking-eyebrow`, `scrim` 색 추가 |
| v3→v4 | `outline-none→outline-hidden`, `flex-shrink-0→shrink-0`, `shadow-elev-N→shadow-{sm,md,lg,xl}`, `hsl(var(--x))→var(--x)`, `text-[Npx]→text-N`(900여 곳 일괄), 기본 border 색/버튼 cursor/placeholder 색 베이스 레이어 보존, 레거시 design-system CSS 는 `layer(components)` 로 격리(unlayered 가 v4 유틸을 이기는 문제) |
| shadcn | `components.json` v4(config ""), CLI 로 신규 20종 추가 → **L1 40종 전부 forwardRef + data-slot + Part 재인코딩**. 도메인 variant(Badge status/grade, Alert tone, Button loading/sidebar/help, Table·Dialog·Tooltip·Avatar 확장). `recharts` 2→3(shadcn chart 요구, tsc/build 통과), `radix-ui` 통합 패키지 추가(구 `@radix-ui/*` 개별 패키지는 T9 에서 정리) |
| lint 인프라 | `apps/web/eslint.config.mjs`(flat, ESLint 10) — @shadcn/lint 6규칙 error + no-restricted-syntax(raw 폼/표 요소) + `components/ui/**` override + `noRestyleContracts`(텍스트/컨테이너/입력 계약) + react-hooks/next 스텁(기존 disable 디렉티브 보호). `packages/ui/lint-anchor.cjs`(no-op `@plugin` — 없으면 `text-12` 류가 글자색 오탐), `cn@0.4` devDep(린터 문법 경고 제거) |
| 게이트 | `turbo.json`: `build`·`test` dependsOn `lint`. 루트: `verify`(lint+typecheck+build), `test`, `test:e2e`/`:ui` 앞 `turbo run lint`. `next.config.mjs` `eslint.ignoreDuringBuilds`. Dockerfile web build 단계 `pnpm -C apps/web run lint && … run build` |
| L2 | 공용 L2 재구성(셸/폼/표시) — 공개 API 유지, 레거시 래퍼는 `@deprecated` + L1 위임(삭제는 T9). AppShell 499→244줄(+`AppSidebar.tsx` 신규). Button 은 `getButtonClasses` 의존 제거 |
| app/** | 로그인(InputGroup·Checkbox·Label·Button lg)·콜백·providers(Toaster 직접) |

## 2. 검증 (실행 결과)
- `pnpm -C apps/web typecheck` → **0 에러**.
- `pnpm -C apps/web exec eslint <T1 소유 경로>`(app, components/ui, components/yoy, 공용 L2 40여 파일, lib, hooks) `--max-warnings=0` → **exit 0(위반 0)**.
- `next build` → **PASS**(Tailwind v4, 36 페이지). 빌드 CSS 클래스 대조: 구 빌드(1559 클래스) 대비 사라진 실사용 클래스 **0**(차이는 주석/미사용 `score-rail`·`summary-dark`, 이스케이프 파싱 노이즈뿐).
- **게이트 실증**: `pnpm exec turbo run build --filter=@growthx/web` → `@growthx/web:lint` 가 먼저 실행되어 위반 시 build 로 진행하지 않음(확인). **Docker**: `docker build -f apps/web/Dockerfile --target build` 에서 alpine/Node 20.20.2 로 lint 가 실제 실행됨(`_docker-lint-evidence.log` — 2198 problems 로 의도대로 실패, 호스트 집계와 정확히 일치 = 환경 차이 없음). ⚠ T9 전까지 Docker/`pnpm build`(turbo)는 lint 위반(아래 표) 때문에 **실패하는 것이 정상**. `next build` 직접 실행·`pnpm -C apps/web typecheck`는 그린.
- 패리티 스크린샷(`shadcn-foundation-shots/`, API 목킹 — 로그인/관리 화면 위주; 대시보드·조직은 목 데이터 형상 불일치로 에러 화면): 전→후 픽셀 차이(임계 24) 0.7~1.6%. 차이 원인 = 버튼 폭·텍스트 1~2px, 아바타 파스텔 hex→토큰 근사, 로그인 CTA 44→48px(lg), 사이드바 구분선 색(0.14로 맞춤). 구조·색·간격 동일.
- **lint 오라클 실증**: `bg-primary`·`text-gradeFg-c`·`bg-status-review-bg`·`text-12`·`rounded-xs`·`shadow-md` 통과 / `bg-pink-500`·`text-foo-bar`·`rounded-huge`·`p-[13px]` 검출, Button `className="mt-2 w-full"` 통과·`text-12` 거부.

## 3. 베이스라인 위반 (전체 `eslint .` — T1 완료 시점, 합계 2198)
| 경로 | no-restyle | no-raw-colors | no-arbitrary-values | no-inline-styles | no-unknown-classes | require-static-classes | raw-element | 합계 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| components (L2) | 35 | 0 | 30 | 1473 | 3 | 4 | 59 | 1604 |
| features/admin-audit | 0 | 0 | 1 | 3 | 0 | 0 | 0 | 4 |
| features/admin-compensation | 0 | 0 | 4 | 134 | 0 | 0 | 16 | 154 |
| features/admin-competency-items | 0 | 0 | 7 | 2 | 0 | 0 | 8 | 17 |
| features/admin-cycle | 4 | 0 | 13 | 0 | 0 | 0 | 1 | 18 |
| features/admin-group-performance | 0 | 1 | 3 | 1 | 0 | 0 | 5 | 10 |
| features/admin-kpi-import | 0 | 0 | 1 | 3 | 0 | 0 | 12 | 16 |
| features/admin-monthly-performance | 0 | 0 | 6 | 2 | 0 | 0 | 2 | 10 |
| features/admin-permissions | 0 | 0 | 10 | 1 | 0 | 3 | 3 | 17 |
| features/admin-rules | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 3 |
| features/admin-settings | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 |
| features/admin-users | 1 | 5 | 7 | 0 | 0 | 0 | 11 | 24 |
| features/appeals | 3 | 0 | 10 | 5 | 0 | 0 | 9 | 27 |
| features/competency-eval | 1 | 0 | 10 | 3 | 0 | 0 | 3 | 17 |
| features/dashboard | 0 | 0 | 6 | 7 | 0 | 0 | 1 | 14 |
| features/eval-dept-head | 12 | 1 | 6 | 6 | 0 | 1 | 2 | 28 |
| features/eval-midterm | 4 | 1 | 10 | 55 | 0 | 0 | 15 | 85 |
| features/eval-my | 0 | 0 | 6 | 1 | 0 | 0 | 1 | 8 |
| features/eval-result | 0 | 0 | 3 | 4 | 0 | 0 | 0 | 7 |
| features/eval-result-detail | 0 | 0 | 4 | 0 | 0 | 0 | 1 | 5 |
| features/eval-self | 6 | 0 | 4 | 13 | 0 | 1 | 4 | 28 |
| features/kpi | 2 | 4 | 6 | 7 | 0 | 1 | 5 | 25 |
| features/kpi-review | 0 | 0 | 3 | 2 | 0 | 0 | 5 | 10 |
| features/notifications | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 |
| features/org | 11 | 0 | 3 | 10 | 0 | 0 | 0 | 24 |
| features/reports | 0 | 0 | 7 | 21 | 0 | 0 | 4 | 32 |
| features/reports-summary | 0 | 0 | 4 | 3 | 0 | 0 | 2 | 9 |
| **합계** | **79** | **12** | **166** | **1759** | **3** | **10** | **169** | **2198** |

- `components (L2)` 1604건은 **T1 소유 밖 46개 파일**(아래). RuleSetEditor·EvalReport·OrgStructureBoard 3개가 1269건(인라인 style) — 소유 배정이 필요하다.
```
46 files 1604 violations
628 components/RuleSetEditor.tsx {'no-inline-styles': 622, 'raw': 6}
356 components/EvalReport.tsx {'no-inline-styles': 351, 'no-unknown-classes': 1, 'raw': 4}
285 components/OrgStructureBoard.tsx {'no-inline-styles': 272, 'raw': 11, 'no-unknown-classes': 2}
43 components/KpiGradingDisplay.tsx {'no-inline-styles': 41, 'no-arbitrary-values': 2}
37 components/EvidencePreview.tsx {'no-inline-styles': 34, 'raw': 3}
33 components/WeightSummaryBar.tsx {'no-inline-styles': 33}
26 components/GradeCriteriaPicker.tsx {'no-inline-styles': 24, 'no-arbitrary-values': 1, 'raw': 1}
25 components/RebaselineHistoryItem.tsx {'no-inline-styles': 24, 'raw': 1}
16 components/OrgPersonCard.tsx {'no-restyle': 15, 'raw': 1}
12 components/RebaselineTable.tsx {'raw': 1, 'no-inline-styles': 9, 'no-arbitrary-values': 2}
12 components/RebaselineDiffRow.tsx {'no-inline-styles': 12}
12 components/MidtermProgressTable.tsx {'raw': 1, 'no-inline-styles': 11}
10 components/OrgTree.tsx {'no-arbitrary-values': 2, 'no-restyle': 3, 'raw': 4, 'no-inline-styles': 1}
10 components/OrgNodeModal.tsx {'raw': 1, 'no-inline-styles': 9}
7 components/ScheduleEditor.tsx {'raw': 5, 'no-arbitrary-values': 2}
7 components/RebaselineHistory.tsx {'no-inline-styles': 6, 'raw': 1}
7 components/MidtermActionPanel.tsx {'no-inline-styles': 7}
7 components/DistributionBarChart.tsx {'no-restyle': 2, 'require-static-classes': 1, 'no-inline-styles': 2, 'no-arbitrary-values': 2}
6 components/KpiCard.tsx {'no-restyle': 4, 'require-static-classes': 1, 'raw': 1}
5 components/TrendIndicator.tsx {'no-inline-styles': 5}
5 components/ResultTable.tsx {'no-restyle': 3, 'require-static-classes': 2}
5 components/ComparisonBar.tsx {'no-inline-styles': 2, 'no-arbitrary-values': 3}
5 components/AuditFilterBar.tsx {'no-arbitrary-values': 3, 'raw': 2}
4 components/EvaluationSubjectPanel.tsx {'no-arbitrary-values': 3, 'raw': 1}
3 components/WeightField.tsx {'no-restyle': 3}
3 components/TemplateEditor.tsx {'raw': 3}
3 components/NotificationItem.tsx {'raw': 1, 'no-arbitrary-values': 2}
3 components/ActionItemRow.tsx {'raw': 2, 'no-inline-styles': 1}
3 components/AchievementField.tsx {'no-restyle': 3}
2 components/WeekScheduleCalendar.tsx {'no-arbitrary-values': 1, 'raw': 1}
2 components/RebaselineChangedCell.tsx {'no-arbitrary-values': 2}
2 components/ProgressDonut.tsx {'no-inline-styles': 2}
2 components/MidtermSignalBadge.tsx {'no-inline-styles': 2}
2 components/GradeRadio.tsx {'no-arbitrary-values': 2}
2 components/EvidenceUpload.tsx {'raw': 2}
2 components/DiffViewer.tsx {'no-arbitrary-values': 1, 'raw': 1}
2 components/CommentThread.tsx {'no-restyle': 2}
2 components/CategoryPolicyMatrix.tsx {'raw': 2}
1 components/SalarySimCard.tsx {'raw': 1}
1 components/RebaselineStatusBadge.tsx {'no-arbitrary-values': 1}
1 components/PoolGauge.tsx {'no-inline-styles': 1}
1 components/OrgViewToggle.tsx {'raw': 1}
1 components/MonthlyTrendChart.tsx {'no-arbitrary-values': 1}
1 components/FileDropzone.tsx {'raw': 1}
1 components/ActionItemStatusBadge.tsx {'no-inline-styles': 1}
1 components/AchievementGauge.tsx {'no-inline-styles': 1}
```
원본 JSON: `shadcn-baseline-lint.json`(집계 스크립트 `shadcn-foundation-shots/lintsum.py`, 파일별 `l2files.py`).

## 4. 남은 리스크 / 결정 필요
1. **소유 배정**: 위 46개 비공유 L2(+features 전체)는 T3~T8 명세에 포함시켜야 한다. suppressions(베이스라인) 파일은 쓰지 않았다(최종 0 목표).
2. **시각 패리티(경미)**: 로그인 CTA 48px(원래 44, no-restyle 로 h-11 불가) · FilterChipBar 칩 8px 라운드/13px · UserCombobox 높이 40→32px·선택 시 보더 강조 제거 · Tabs 는 L1 을 구 L2 렌더(13px/활성 foreground)에 맞춰 조정 · Avatar 파스텔 hex→근사 토큰 · SearchInput `type=search`→`text`+`role=searchbox`(접근성 이름 동일). T10 시각 비교에서 허용 오차 판단 필요.
3. **DESIGN.md 불일치 발견**: §7 은 버튼 36px 이라 하나 실제 앱은 40px(md) — 코드 패리티를 우선해 40px 유지. GradeChip C 글씨는 §2 표엔 흰색, 실제 렌더는 진갈색(`gradeSolidClass`) — 코드 패리티 유지(`text-gradeFg-c`). 문서 정정 필요 여부는 디자인 판단.
4. **예외 주석**: `AppSidebar` 스크롤바 숨김 `[scrollbar-width:none]` 1건(`@utility` 로 승격 가능), `DataTable` 정적분석 불가 패스스루 3건, `ui/chart` `<style>` 1건. `rg "eslint-disable.*shadcn/"`.
5. **재배포 주의**: `recharts@3`·`radix-ui` 신규 패키지 — 기존 recharts 사용 차트(reports 등)는 빌드/타입 통과했으나 런타임 시각 확인은 T10. 구 `@radix-ui/react-*` 개별 의존은 T9 에서 제거.
6. Docker 베이스 `node:20-alpine` 은 부동 태그(현재 20.20.2 ≥ lint 요구 20.19) — 필요하면 `20.20-alpine` 로 고정.
7. `.gx-*` 레거시 유틸은 `@utility` 로 존치(사용 약 40곳) — T9 에서 `Card`/Tailwind 조합으로 대체 검토.
