# T9 — integrate 세션 명세 (현재 워크트리, G1~G7 완료 후)

입력: `plan.md`, `_workspace/04_frontend/shadcn-guide.md`, `_workspace/04_frontend/shadcn-{foundation,G1..G7}.md`(각 그룹 노트), 루트 `DESIGN.md`.
**코드 수정 전 `nextjs-frontend` 스킬 필수 호출.** 이제 apps/web 전체가 이 세션 소유다(다른 프론트 세션은 종료됨).

1. **잔여 레거시 import 0 으로**: `grep -rnE "from '@/components/(Button|Card|Modal|Toast|Select|Tabs|TextField|Avatar|Collapsible|Pagination|SegmentedControl|Breadcrumb|HelpTooltip|SearchInput|States)'" apps/web`
   → 남은 사용처 이관 후 **레거시 래퍼 파일 삭제**(가이드가 "유지 L2"로 지정한 것은 제외).
2. **사용처 0 죽은 컴포넌트 삭제** — 삭제 직전 단어 grep 으로 재확인(`grep -rlw <Name> apps/web --include=*.ts --include=*.tsx`):
   SectionHeader, Breadcrumb, PeriodBanner, WidgetCard, StatCard, AchievementGauge, ActionItemFormModal, AuditFilterBar, CommentThread,
   DistributionBarChart, EvidenceUpload, GradeRadio, MonthlyTrendChart, OrgPersonCard, OrgTree, OrgViewToggle, PoolGauge, ProcessFlow,
   ProgressDonut, RebaselineHistory, RebaselineHistoryItem, RebaselineDiffRow, RebaselineStatusBadge, RebaselineTable, RebaselineChangedCell,
   WeightSummaryBar, ResultExportButton, SalarySimCard, ScoreCard, TemplateEditor, WeekScheduleCalendar, WeightField, yoy/RuleSetChip.
   (CategoryPolicyMatrix 는 유지.) 삭제 목록을 노트에 남긴다.
3. `packages/design-system`·`@energyx/ui` JS 헬퍼(getButtonClasses 등)가 소비처 0 이 되면 의존 정리(패키지 삭제는 하지 말고 apps/web 의존만).
4. **전역 게이트 (실행 증거를 노트에 그대로)**: `pnpm -C apps/web exec eslint . --max-warnings=0` = 0(eslint-disable 총 건수·사유 목록),
   suppressions 파일 없음(있으면 사유), `pnpm -C apps/web typecheck` = 0, 루트 `pnpm build`(turbo — lint 선행 확인), `pnpm -C apps/api test`,
   **Docker web 이미지 빌드**(`docker build -f apps/web/Dockerfile .` 또는 compose build web — lint 가 이미지 빌드에서도 도는지 확인. Docker 미가동이면 그 사실을 보고).
5. 시각 점검: `next build && next start -p 3400`(QA 스택 API :4300 가 떠 있으면 `API_PROXY_TARGET=http://localhost:4300`)로 주요 화면 스크린샷
   → DESIGN.md 위반(radius·색·버튼 규칙) 육안 검수, 발견 즉시 수정.
6. 노트 `_workspace/04_frontend/shadcn-integrate.md`, `worker_done` 에 수치.
