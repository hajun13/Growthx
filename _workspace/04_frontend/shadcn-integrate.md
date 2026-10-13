# shadcn 전환 — 통합(T9) 결과 (2026-10-13/14)

G1~G7(11개 서브에이전트 분할) 완료 후 통합. 그룹 노트: `shadcn-G1.md … G7b.md`. 가이드: `shadcn-guide.md`. 기반: `shadcn-foundation.md`.

## 게이트 실행 증거
| 항목 | 결과 |
|---|---|
| `pnpm -C apps/web exec eslint . --max-warnings=0` | **exit 0 (위반 0)** — 시작 2198 → 그룹 후 151(죽은 컴포넌트) → 0 |
| `pnpm -C apps/web typecheck` | exit 0 |
| 루트 `pnpm build`(turbo) | 3/3 성공 — web lint → api/web build (Prisma generate 선행 필요: `pnpm prisma:generate`) |
| `pnpm -C apps/api test` | 171 passed / 20 files |
| Docker `docker build -f apps/web/Dockerfile .` | **성공** — 빌드 로그에 `eslint . --max-warnings=0` 실행 확인 후 next build(36 페이지) (`_docker-final.log`) |
| suppressions 파일 | 없음 |
| `eslint-disable` (shadcn/·no-restricted-syntax) | 13건, 전부 사유 주석: DataTable 3(column/rowClassName 패스스루), MatrixSidebarTabs 2·VisibilityTab 1(DataTable rowClassName), EvaluationSummaryView·DistMonitorTab·DashboardView 각 1(뷰포트 calc), AppSidebar 1(스크롤바 숨김), ui/chart 1(`<style>`), file/range input 3(L1에 없음) |

## 삭제
- 사용처 0 죽은 컴포넌트 32개(SectionHeader, Breadcrumb, PeriodBanner, WidgetCard, AchievementGauge, ActionItemFormModal, AuditFilterBar, CommentThread, DistributionBarChart, EvidenceUpload, GradeRadio, MonthlyTrendChart, OrgPersonCard, OrgTree, OrgViewToggle, PoolGauge, ProcessFlow, ProgressDonut, Rebaseline{History,HistoryItem,DiffRow,StatusBadge,Table,ChangedCell}, WeightSummaryBar, ResultExportButton, SalarySimCard, ScoreCard, TemplateEditor, WeekScheduleCalendar, WeightField, yoy/RuleSetChip). StatCard 는 신규 사용처가 생겨 유지.
- 레거시 래퍼 11개: Button, Card, Modal, Select, Tabs, TextField, Collapsible, Pagination, SegmentedControl, SearchInput, Toast (OrgCascadeFilter·ScopeSelect·login·onboarding 은 L1/sonner 직접 사용으로 이관).
- **유지(결정)**: `States.tsx`(빈/에러/금지/스피너 표준 상태), `HelpTooltip.tsx`((?) 리치 툴팁), `Avatar.tsx`(이름 해시 파스텔 로직) — 1:1 shadcn 중복이 아니라 앱 도메인 합성이며 L1 위에서 구현됨. 가이드 §4 에 맞춰 유지.

## 남은 리스크 / 후속
1. **중복 로컬 헬퍼**: 각 그룹이 만든 StateViews/ConfirmDialog/아바타 복제본(MidtermAvatar, SubjectAvatar, PersonAvatar …) — 공용 L2 로 수렴 권장(기능 영향 없음).
2. **200줄 상한 초과 파일**(KpiWriteView 633, MemberRevisionPanel 628, AdminUsersView 608 …) — 훅 추출이 필요해 동작 리스크로 보류.
3. **시각 패리티(경미)**: 빈 상태 중앙정렬, 일부 높이/패딩, 로그인 CTA 48px, C 등급 글씨 진갈색(구 렌더 동일) 등 — 그룹 노트 "패리티 메모". 스크린샷 비교는 API 목킹 화면만 가능(전→후 0.2~1.8% 픽셀 차).
4. **접근성 이름 변화 가능 지점**: 네이티브 select→Radix(role combobox), 토글→radiogroup, 삭제 확인 alertdialog — E2E(T10)에서 확인 필요.
5. **T10 회귀(QA 스위트 이관·전체 E2E)는 미실행** — 별도 QA 워크트리(`hajun13/shadcn-qa-baseline`) 산출물 기준으로 후속.
