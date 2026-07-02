# FE-A — 로그인 화면 재디자인 + 업무 중심 대시보드 (2026-07-02)

SSOT: `_workspace/00_input/part-revision-requirements.md` §P1·P2·§0, `_workspace/01_design/part-revision-brief.md`, `_workspace/04_frontend/part-foundation-notes.md`.
Foundation(공용 토큰·Avatar·GradeChip)은 이미 반영되어 있어 이 패스에서는 재사용만 하고 공용 파일은 건드리지 않았다.

## 변경 파일

### P1. 로그인
- `apps/web/app/(auth)/login/page.tsx` — 전면 재작성(244→177줄). 로직(`useAuth`/`login`/`ApiError`/`landingPath`/localStorage 등)은 100% 그대로, 표현 계층만 교체.
  - 좌측 대형 hero 사진 + 우측 폼의 기존 2단 레이아웃(어두운 이미지, 그림자 큰 카드)을 폐기하고, 브리프 톤(`#F8F9FD` 배경, 흰 카드 radius 10px + soft shadow)에 맞춘 **중앙 정렬 단일 카드**로 단순화.
  - 배경에 블루(`#0257CE`)·민트(`#0ED0D9`) 저채도 블러 장식만 은은하게(과함 없이 정갈하게 — 브리프 요구).
  - 보안 안내 박스를 긴 2문단 → 짧은 1줄로 절제, 불필요 장식(대문자 트래킹 라벨 등) 제거.
  - 버튼/입력 radius를 8px(브리프 §3/§4)로, 포커스 링 색을 `#0257CE`로 통일.
  - 데모 계정 나열 등 부가 요소는 기존에도 없었음(추가 절제 불필요) — 확인만 하고 그대로 둠.
- `apps/web/app/(auth)/login/LoginFormFields.tsx` — 신규. 아이디/비밀번호 입력 필드를 분리해 `page.tsx` 200줄 상한 준수(상태·핸들러는 부모에서 prop으로 주입, 로직 이동 없음).

### P2. 대시보드
- `apps/web/features/dashboard/ui/DashboardView.tsx` — 전면 재작성(389→162줄). **데이터 훅(useAuth/useCurrentCycle/useCurrentPhase/useKpis/useEvaluations/useDashboardSummary)과 파생 상태 계산(selfDone/kpiConfirmed/upperDone 등)은 전부 그대로 유지** — 배치·컴포넌트 구조만 재구성.
  - 기존 순서(요약 밴드 → 진행 스테퍼 → 액션/일정 패널 → 최근 변경 표)를 뒤집어, **"지금 할 일"(TodoSection)을 최상단 주인공**으로 배치. 요약·스테�퍼는 한 줄로 압축한 보조 바로, 일정+최근변경은 2단 보조 패널로 격하.
- `apps/web/features/dashboard/ui/TodoSection.tsx` — 신규. 4장의 카드형 그리드(`KPI`/`본인평가`/`구성원 평가(다운워드 권한자만)`/`평가 결과`), urgency(`urgent`/`active`/`done`)별 배지·아이콘·버튼 variant(주요 액션만 블루, 나머지 secondary) 적용.
- `apps/web/features/dashboard/ui/buildTodoItems.ts` — 신규. To-do 카드 4종의 상태→문구 매핑을 순수 함수로 분리(200줄 상한, 표시만 — 재계산 없음, 기존 boolean 플래그를 문구로 매핑할 뿐).
- `apps/web/features/dashboard/ui/ProgressSummaryBar.tsx` — 신규. 기존 `SummaryBand`+`ProgressStepper`를 한 줄 압축 카드로 통합(볼드 최소화, 회색 위계 — 브리프 §10). 완료=진네이비, 진행중=블루(#0257CE), 미도래=회색 아웃라인.
- `apps/web/features/dashboard/ui/ScheduleAndActivity.tsx` — 신규. 기존 `SchedulePanel`+최근 변경 표를 2열 보조 패널로 재구성, 표 형태 대신 리스트로 정보 밀도를 낮춤.

## 구현 노트
- 등급 표시는 대시보드/로그인 화면 어디에도 없어(GradeChip 미사용 화면) `gradeSoftClass` 등 Foundation 등급 헬퍼는 이번 패스에서 소비 대상이 아니었음.
- Avatar도 대시보드에 사용자 아바타 노출 지점이 없어(요약 위주 화면) 이번 패스에서는 미사용 — 필요 시 후속 패스에서 PageHeader 우측에 추가 검토 가능.
- 색상은 브리프 §1 토큰 hex를 인라인(`#0257CE` 등)으로 직접 사용 — 기존 코드가 `text-primary`/`bg-primary` 같은 시맨틱 클래스도 이미 Foundation에서 신팔레트로 remap되어 있어(`packages/ui/tailwind-preset.cjs` `primary.500=#0257CE` 확인) 혼용 가능하지만, 신규 컴포넌트는 브리프 표에 명시된 hex를 그대로 인용해 디자이너 스펙과의 추적성을 우선했다.
- 파일당 ~200줄 상한 준수: `DashboardView.tsx` 162줄, `page.tsx`(login) 177줄, 신규 컴포넌트 각 72~91줄.

## API 갭
- 없음. 이번 패스는 두 화면 모두 기존 엔드포인트(`dashboardControllerSummary`, `/cycles/:id/current-phase`, `useKpis`, `useEvaluations`)로 100% 구현 가능했고, 데이터가 없어 폴백 처리한 항목도 없음.

## 검증
- `npx tsc --noEmit -p apps/web/tsconfig.json` — 수정 범위(`app/(auth)/login/**`, `app/(main)/dashboard/**`, `features/dashboard/**`) 관련 에러 0건. (전체 실행 시 `apps/web/features/eval-dept-head/ui/DeptHeadEvalView.tsx`에서 20건이 나오나, 이는 병렬 진행 중인 다른 작업 범위의 기존 파일이며 본 패스가 건드리지 않음 — grep으로 확인.)
- `next build`는 지시에 따라 실행하지 않음(다른 에이전트와 병렬 진행 중, 최종 QA가 1회 수행 예정).
- 프리뷰/브라우저 시각 검증 미실시(지시·프로젝트 규칙).

## 수정 범위 확인
- 공용 `components/`·`lib/`·`packages/`는 전혀 수정하지 않음(읽기만).
- 수정/생성 파일은 전부 `app/(auth)/login/**`, `app/(main)/dashboard/**`(변경 없음, 얇은 라우트 그대로), `features/dashboard/**` 내부.
