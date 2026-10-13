# G1~G7 — 기능 그룹 전환 세션 명세 (현재 워크트리 `C:\Users\user\orca\Growthx`, 브랜치 feat/shadcn-migration)

T1(foundation)이 끝난 상태에서 시작한다. 입력은 셋:
1. `_workspace/00_input/shadcn-migration/plan.md` — 확정 결정·공통 규칙(필독).
2. `_workspace/04_frontend/shadcn-guide.md` — **T1 이 확정한 L1 API·레거시→shadcn 매핑·토큰 매핑·lint 사용법. 이 문서가 이긴다.**
3. 루트 `DESIGN.md` — 시각 SSOT.

**코드를 건드리기 전에 `nextjs-frontend` 스킬을 Skill 도구로 먼저 호출하라(예외 없음).** 그룹 안의 feature 디렉터리·컴포넌트가 서로 독립이면
frontend-engineer 서브에이전트(sonnet)로 병렬 팬아웃하라(같은 파일을 두 에이전트가 동시에 만지지 않게 분할). 서브에이전트 프롬프트 첫 줄에도
"nextjs-frontend 스킬 먼저 호출(필수)" 과 가이드 경로를 넣어라.

## 해야 할 일 (소유 경로 안에서만)

1. 레거시 범용 래퍼(Button/Card/Modal/Toast/Select/Tabs/TextField/Avatar/Collapsible/Pagination/SegmentedControl/Breadcrumb/HelpTooltip/
   SearchInput/States 등) **사용처를 L1(`@/components/ui/*`)로 이관** — 가이드 매핑표대로. (래퍼 파일 자체 삭제는 T-integrate 가 한다.)
2. raw `<button>/<input>/<select>/<textarea>/<table>` 손스타일 → L1 컴포넌트. (hidden file input 등 정당한 예외는 사유 주석)
3. `@shadcn/lint` 위반 0: 임의값 → 테마 토큰, `style={{…}}` → 클래스(동적 수치만 가이드의 허용 패턴), raw 팔레트색 → 테마색,
   `className` 으로 L1 재스타일 → variant/size 또는 contract 허용 범위. 정당한 예외만 `// eslint-disable-next-line shadcn/<rule> -- <사유>`.
4. 차트(recharts 직접 사용)는 가이드가 정한 `ui/chart`(ChartContainer) 패턴으로.
5. **동작·문구·접근성 이름 불변**: 훅/API 호출/상태 로직/조건 분기/텍스트/aria-label/버튼 라벨/heading 은 그대로(E2E 회귀 게이트가 역할·라벨 기반).
   레이아웃·간격·색은 DESIGN.md 와 기존 화면 모습을 유지(새 디자인 발명 금지).

## 검증 (각자 소유 경로 기준 — next build/dev 금지)

- `pnpm -C apps/web exec eslint <소유 경로들> --max-warnings=0` → **0**
- `pnpm -C apps/web typecheck` → 내 파일 에러 0 (남의 파일 에러는 보고만)
- 소유 경로 내 레거시 import 0: `grep -rnE "from '@/components/(Button|Card|Modal|Toast|Select|Tabs|TextField|Avatar|Collapsible|Pagination|SegmentedControl|Breadcrumb|HelpTooltip|SearchInput|States)'" <소유 경로>`
  (가이드가 "유지"로 지정한 L2 컴포지션은 예외)
- 진행 노트 `_workspace/04_frontend/shadcn-<그룹ID>.md`: 파일별 변경 요약, 예외(eslint-disable) 목록+사유, 보류/질문.
- 소유 밖 파일 수정이 필요하면 직접 고치지 말고 `orca orchestration ask` 로 코디네이터에 요청(특히 L1/L2 API 추가 필요 시).
- 끝나면 `worker_done`: 변경 파일, 위 3개 검증 명령의 실제 수치, 예외 건수, 남은 것.

---

## 그룹별 소유 경로

### G1 — 중간점검 (≈4.9k줄)
- `apps/web/features/eval-midterm/**`
- `apps/web/components/{MidtermSignalBadge,MidtermProgressTable,MidtermResultSummary,MidtermActionPanel,TrendIndicator,ActionItemRow,ActionItemStatusBadge}.tsx`

### G2 — KPI 작성·검토 (≈2.8k줄)
- `apps/web/features/kpi/**`, `apps/web/features/kpi-review/**`
- `apps/web/components/{KpiGradingDisplay,EvaluationDetailHeader,EvaluationSubjectPanel}.tsx`
  (EvaluationDetailHeader·EvaluationSubjectPanel 은 G1·G3·G4 기능도 import — **공개 props API 유지**)

### G3 — 본인평가·역량평가 (≈2.6k줄)
- `apps/web/features/eval-self/**`, `apps/web/features/competency-eval/**`
- `apps/web/components/{KpiCard,AchievementField,GradeCriteriaPicker,EvidencePreview,EvaluationActionPanel}.tsx`
  (EvaluationActionPanel·GradeCriteriaPicker·EvidencePreview 는 다른 그룹도 import — **공개 props API 유지**)

### G4 — 부서장 평가·결과·이의제기 (≈4.7k줄)
- `apps/web/features/{eval-dept-head,eval-my,eval-result,eval-result-detail,appeals}/**`
- `apps/web/components/{EvalReport,EvaluatorFlow,ComparisonBar}.tsx`

### G5 — 조직·사용자·권한·감사·알림 (≈4.1k줄)
- `apps/web/features/{admin-users,org,admin-permissions,admin-audit,admin-settings,notifications}/**`
- `apps/web/components/{OrgStructureBoard,OrgNodeModal,PersonEditModal,DiffViewer,NotificationItem,CategoryPolicyMatrix}.tsx`
  (CategoryPolicyMatrix 는 소비처 0 이지만 2026-07-07 결정으로 "잔존 유지" 대상 — 삭제하지 말고 전환)

### G6 — 평가 운영·규칙·보상·역량 문항 (≈4.6k줄)
- `apps/web/features/{admin-cycle,admin-rules,admin-compensation,admin-competency-items,admin-midterm-rebaseline}/**`
- `apps/web/components/{ScheduleEditor,RuleSetEditor,FileDropzone,ResultTable}.tsx`

### G7 — 경영실적·KPI 임포트·리포트·대시보드 (≈5.6k줄)
- `apps/web/features/{admin-monthly-performance,admin-group-performance,admin-kpi-import,reports,reports-summary,reports-yoy,dashboard}/**`
- `apps/web/components/ExportButton.tsx`

### 공통 비소유(수정 금지)
- T1 소유(ui/**, app/**, 공용 L2, lib/{ui,utils,palette,grade}.ts, 설정 파일), 다른 그룹 경로, `hooks/**`, `lib/**`(로직), 사용처 0 죽은 컴포넌트(T-integrate 가 삭제).
