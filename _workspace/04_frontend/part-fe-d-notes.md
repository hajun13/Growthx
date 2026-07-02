# Part/ FE-D — 본인평가·부서장 평가·KPI 검토·KPI 작성 가이드 (2026-07-02)

SSOT: `_workspace/00_input/part-revision-requirements.md` §P6·P9·P12·P13 + §0(공통규칙), `_workspace/01_design/part-revision-brief.md`(토큰), `_workspace/04_frontend/part-foundation-notes.md`(공용 Avatar/gradeSolidClass 등).
목표 시안: `Part/image 8.png`(본인평가) · `Part/image 9.png`(부서장평가) · `Part/image 5.png`(KPI 검토).

이 문서는 세션 초반 백그라운드 위임 패스가 일부 파일을 WIP 상태(중복 정의·미완성 import)로 남긴 것을 이어받아 직접 마무리한 결과다.

## 수정/신규 파일

### P12. 본인평가 (`features/eval-self/`)
- `apps/web/features/eval-self/ui/KpiCard.tsx` — 정보영역(CSF/목표/평가방식) 배경 `bg-[#faf9f7]` → `bg-muted`(브리프 §8 토큰).
- `apps/web/features/eval-self/ui/SelfEvaluationView.tsx` — KPI 카드 그룹 간격 `space-y-4`→`space-y-5`, 카드 좌측 컬러 바 하드코딩 hex(`#d1cbc4`/`#9a948e`) → `rounded-lg border-border shadow-elev-1`/`border-l-muted-foreground/40` 토큰 클래스로 교체.
- 제출·등급 산정 로직(`directGrade` 등)은 무변경 — 표현 계층만 수정.

### P13. 부서장 평가 (`features/eval-dept-head/`)
- `apps/web/features/eval-dept-head/ui/DeptHeadEvalView.tsx` — 대대적 정리:
  - 하드코딩 hex(`#faf9f7`/`#d1cbc4`/`#9a948e`) 전부 토큰 클래스로 교체.
  - **평가 이력 섹션 신규 추가**: `EvaluationDetail.comments`(기존 필드, 이미 fetch 중)를 시간순 정렬해 "평가 이력" 카드로 표시(라운드 라벨 + 작성시각 + 코멘트 본문). 신규 API 호출 없음 — 기존 데이터에서 도출.
  - 중복 정의 제거: 이전 패스가 `KpiEvalCard`/`SelfStatusBanner`/`GradePicker`를 별도 파일로 추출해놓고 원본 파일에서 지우지 않아 재선언 충돌 상태였음 → 원본의 중복 함수 삭제, import로 통일.
  - 파일 200줄 상한 대응: KPI 그룹 렌더 블록(`performance_core`/`collaboration_growth` map + Collapsible + KpiEvalCard)을 신규 `DeptHeadKpiGroupList.tsx`로 추가 추출. 914줄 → 594줄(그래도 상한 초과 — 남은 것은 상태·훅·제출 핸들러·JSX 셸로, 추가 분리 시 prop-drilling이 과해질 지점까지 이미 나눔).
  - 승인/제출 = `variant="primary"`(블루), 반려·수정요청 계열 액션은 `variant="secondary"`(그레이) — 기존에도 `danger` variant 없었음, 유지 확인.
- `apps/web/features/eval-dept-head/ui/DeptHeadKpiEvalCard.tsx` (신규, 이전 패스가 만들어둔 것을 그대로 채택) — `KpiEvalCard` 컴포넌트(본인평가 연동 실적 + 부서장 등급부여 + 증빙 + 코멘트). 208줄.
- `apps/web/features/eval-dept-head/ui/DeptHeadHelpers.tsx` (신규, 이전 패스 산출물 채택) — `SelfStatusBanner`/`GradePicker`. 85줄.
- `apps/web/features/eval-dept-head/ui/DeptHeadKpiGroupList.tsx` (신규, 이번 세션에서 작성) — KPI 그룹별 카드 리스트. 140줄.

### P9. KPI 검토 (`features/kpi-review/`)
- `apps/web/features/kpi-review/ui/KpiReviewSubComponents.tsx` (이전 패스가 이미 완료, 이번 세션에서 검증만):
  - KPI 번호 배지(01/02…) 블루 계열 → `bg-muted text-muted-foreground`(그레이 톤, rounded 추가).
  - 등급 기준 섹션 배경 `bg-[#faf9f7]` → `bg-muted`.
  - 카드 좌측 컬러 바 하드코딩 hex → 토큰 클래스.
  - 반려 버튼 `variant="danger"`(빨강 solid) → `variant="secondary"`(그레이 아웃라인, 브리프 §4). 수정요청은 이미 secondary였음.
  - `RejectModal`의 확인 버튼(`primaryAction.variant: 'danger'`)은 유지 — `Modal` 공용 컴포넌트가 `primary | danger`만 지원하고, 이 버튼은 "반려를 확정하는 모달 내 강조 액션"이라 브리프 §4의 "파괴적 액션은 확인 모달 필수"에 해당. 리스트의 트리거 버튼(반려/수정요청)은 secondary로 이미 정리됐으므로 브리프 취지 위반 아님 — 주석으로 근거 남김.
  - 가중치는 이미 숫자만 표시(`{k.weight}%`), 진행률 바 없음 — 확인만, 추가 수정 불필요.
  - 좌측 사용자 목록 사진: `EvaluationSubjectPanel`(공용, Foundation에서 이미 Avatar 내장) 그대로 사용 — 별도 작업 불필요.

### P6. KPI 작성 가이드 (`features/kpi/`)
- `apps/web/features/kpi/ui/KpiGoalGuidePanel.tsx` (신규, 이전 패스 산출물을 검증 후 채택) — 목표 수립 가이드 카드. `Collapsible`(공용) 재사용, 기본 접힘.
  - 예시 문구는 `Part/kpi 3751aa9d693e80d28ebfcd8ebcd184d9.md` "목표수립" 절 원문을 그대로 인용(제목 "KPI 수립·중간점검·최종평가 체계 운영 정착" + 기대역할 서술 전문).
  - AI 목표 추천 기능은 미구현 — "AI 활용 목표 추천 (예정)" Pill 배지로만 표시(갭 기록, 실제 로직 없음).
- `apps/web/features/kpi/ui/KpiWriteView.tsx` — `import { KpiGoalGuidePanel }` 추가, `PageHeader`/잠금 안내 배너 아래·`KpiBalancePanel` 위에 `{!submissionComplete && <KpiGoalGuidePanel />}`로 삽입(제출 완료 모드에서는 숨김 — 이미 작성 끝난 사용자에게는 불필요).
- `apps/web/features/kpi/ui/KpiDraftCard.tsx`, `apps/web/features/kpi/ui/KpiLockedCard.tsx` — 카드 테두리/배경 하드코딩 hex(`#d1cbc4`/`#faf9f7`) 토큰 클래스로 교체(P6 범위는 아니지만 같은 feature 디렉토리 내 잔존 구색이라 함께 정리).

## API 갭 (신규 발견분 포함)

1. **부서장 평가의 "반려/수정요청" 자체 상태 전이 API 없음** — `EvalStatus`는 `not_started | in_progress | submitted | finalized` 4종뿐(`apps/web/lib/types.ts`). `evaluationsController*`(`packages/contracts`)에는 `create/patch/comment/evidence CRUD/submit/finalize/list/get/gradeDistribution/autoAssign`만 있고 reject/revision-request에 해당하는 엔드포인트가 없다. (참고: `KpiStatus`에는 `rejected`/`revision_requested`가 있지만 이건 KPI 작성 단계의 것이지 평가 자체의 상태가 아니다.) → 요구사항 §P13의 "수정요청 사유 입력/반려 사유 입력/상태: 수정요청·반려" 항목은 **프론트에서 구현 불가**(발명 금지 원칙). 백엔드에 `Evaluation.status`를 확장(`revision_requested`/`rejected` 추가)하고 사유 필드(`rejectReason`)를 붙이는 계약 변경이 필요.
2. **평가 이력 조회 전용 API 없음** — `evaluationsControllerComment`는 POST만 있고 이력을 별도로 GET하는 엔드포인트가 없다. 현재는 `EvaluationDetail.comments`(상세 조회에 이미 포함된 필드)를 재사용해 "평가 이력" 섹션을 만들었다 — 이것으로 **코멘트 이력은 표시 가능**하지만, 상태 전이(수정요청→재작성→재제출 등) 자체의 이력은 여전히 표시 불가(1번 갭과 연동).
3. (기존 갭 재확인, 변경 없음) `User.photoUrl` 없음 — `Avatar` 폴백이 사실상 기본, `EvaluationSubjectPanel`이 이미 처리.

## 검증
- `npx tsc --noEmit -p apps/web/tsconfig.json` — **eval-self / eval-dept-head / kpi-review / features/kpi 4개 scope 내 0 에러** 확인(grep으로 격리 확인).
- 전체 실행 시 아래 **무관 파일**의 사전 존재 에러가 함께 나타나지만 이번 FE-D 세션에서 손대지 않은 파일이라 그대로 둠(다른 진행 중인 패스의 미완 상태로 추정):
  - `apps/web/features/eval-midterm/ui/DeptHeadMidterm.tsx` (import 충돌, `CheckCircle2`/`Clock` 미정의)
  - `apps/web/features/reports-summary/ui/SummaryRowExpand.tsx` (`SummaryRow` export 없음)
  - `apps/web/features/reports/ui/ReportsView.tsx` (`useRouter`/`GRADE_TONE` 미정의)
  - 이 3개 파일은 FE-D 범위(§P6·P9·P12·P13) 밖이라 수정하지 않았다. QA/오케스트레이터가 별도 패스로 확인 필요.
- `next build` 미실행(지침에 따라 QA가 1회 수행 예정).
- 프리뷰/브라우저 검증 미실시(지침).

## 페이지 에이전트/QA 유의사항
- `DeptHeadEvalView.tsx`는 594줄로 200줄 상한을 여전히 초과한다. 이미 정보영역 카드(`DeptHeadKpiEvalCard`)·그룹 리스트(`DeptHeadKpiGroupList`)·소형 보조 컴포넌트(`DeptHeadHelpers`)로 분리했고, 남은 부분은 데이터 훅 호출·상태·제출 핸들러·JSX 셸(팀원 목록/헤더/모달)이라 추가 분리 시 상태를 여러 파일에 걸쳐 prop으로 넘겨야 해서 가독성이 오히려 나빠질 수 있는 지점까지 나눴다. 필요하면 후속 패스에서 "제출 로직 훅(`useDeptHeadSubmit`)" 등으로 상태 관리를 커스텀 훅으로 뽑는 걸 권장.
- `KpiWriteView.tsx`(839줄)는 이번 패스 범위가 아니라 손대지 않음 — 기존부터 200줄 상한 초과 상태였고, P6 요구사항(가이드 패널 추가)만 최소 침습으로 반영했다. 대형 리팩터는 별도 작업으로 분리 권장.
- 부서장 평가의 반려/수정요청 상태·사유 입력 UI는 **계약이 없어 구현하지 않았다** — backend-engineer와 계약 협상이 필요한 항목(API 갭 1, 2). 협상 후 `EvalStatus`에 `revision_requested`/`rejected` 추가 + `rejectReason` 필드 + 상태 전이 엔드포인트가 생기면, `StatusBadge`(공용 컴포넌트, `apps/web/components/StatusBadge.tsx`)에 새 상태 매핑 추가 + `DeptHeadEvalView.tsx`에 반려/수정요청 트리거 버튼과 사유 입력 모달을 붙이면 된다(패턴은 `features/kpi-review`의 `RejectModal`을 그대로 참고 가능).
