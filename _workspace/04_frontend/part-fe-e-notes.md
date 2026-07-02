# FE-E — 역량평가 문항 카드화 + 중간점검 검토 프로세스 분리 (2026-07-02)

**범위:** `_workspace/00_input/part-revision-requirements.md` §P10(역량평가)·§P11(중간점검) + §0 공통 규칙. 프론트엔드(apps/web)만, API 계약 변경 없음.

**입력:** `_workspace/01_design/part-revision-brief.md`(토큰 SSOT, §9 역량 카테고리 색·아이콘) · `_workspace/04_frontend/part-foundation-notes.md`(Avatar·gradeSoftClass) · 목표 시안 `Part/image 6.png`(역량평가) · `Part/image 7.png`(중간점검).

---

## P10. 역량평가 (`features/competency-eval/`)

시안(image 6) 재현: 문항별 독립 카드(그림자·여백 분리) + 카테고리 아이콘·색 + 접기/펼치기.

### 변경 파일
- `apps/web/features/competency-eval/ui/CompetencyEvalView.tsx` — 페이지 orchestration만 남기고 카드 렌더링·폼 상태를 분리(200줄 상한).
- `apps/web/features/competency-eval/ui/QuestionCard.tsx` **(신규)** — 문항 카드 1개. 카테고리별 아이콘(원형 배지)+Pill 배지, 질문 강조, 응답 영역(연한 배경 `#F8F9FD`), 5점 선택 그리드, 근거 textarea. 헤더 클릭 시 항상 접기/펼치기(기존엔 제출 완료 시에만 Collapsible이었고 작성 중엔 항상 펼침 고정 — 이번에 통일).
- `apps/web/features/competency-eval/ui/SubmitPanel.tsx` **(신규)** — 하단 고정 제출 액션 바(임시저장/최종제출) 분리.
- `apps/web/features/competency-eval/ui/useCompetencyForm.ts` **(신규)** — 답변 드래프트·접기펼치기 상태·저장/제출 커맨드를 커스텀 훅으로 추출. 응답 저장 로직(CompetencyResponse bulkSave/bulkSubmit)은 완전히 불변, 훅 시그니처만 정리.

### 카테고리 아이콘·색(브리프 §9)
`QuestionCard.tsx` 내부 로컬 상수 `CAT_CFG`(feature 전용이라 공용 lib에 넣지 않음):

| 카테고리 | 아이콘 | 아이콘 색/배경 | 배지 색 |
|---|---|---|---|
| 리더십 | `Crown` | `#0257CE` / `#EAF2FE` | 동일 |
| 협업 | `Users`(교류형 문구는 `Share2`) | `#0B7A47` / `#E3F7EC` | 동일 |
| 전문성 | `Award` | `#0E7E85` / `#E4FBFB` | 동일 |
| 혁신 | `Lightbulb` | `#C2570A` / `#FFEEDD` | 동일 |

'지원'·'공유'·'교류' 문구가 포함된 협업 문항은 `Share2` 아이콘으로 분기(브리프 관측: 혼재).

### 유의
- 응답 저장 로직(`CompetencyResponse` bulk save/submit, `scoreToGrade`/`gradeToScore` 매핑) **변경 없음**.
- 문항별 접기/펼치기 초기값: 작성 중=전체 펼침(시안대로), 제출 완료=전체 접힘. 이후 사용자가 개별 토글한 상태는 유지(재조회로 덮어쓰지 않음).

---

## P11. 중간점검 (`features/eval-midterm/`)

시안(image 7) 재현: "구성원 진척 검토" 탭 → 구성원 선택 시 상세 패널에 **KPI 진행 현황 / 상급자 중간 점검 / 보완조치** 3섹션 탭. "상급자 중간 점검" 탭에서 KPI 카드마다 **좌: 담당자 자기점검 요약(자세히 보기 펼침) / 우: 상급자 의견 + 승인/반려/수정요청**.

### 변경 파일
- `apps/web/features/eval-midterm/ui/DeptHeadMidterm.tsx` — 상위 orchestration(구성원 리스트·탭)만 남기고 `MemberDetail`/헬퍼를 분리(기존 608줄 → 198줄).
- `apps/web/features/eval-midterm/ui/MemberDetail.tsx` **(신규)** — 선택 구성원 상세. 섹션 탭을 `KPI 진척/자가점검 확인/보완조치` → **`KPI 진행 현황/상급자 중간 점검/보완조치`** 로 개편. 헤더에 KPI 진행률 metric 추가(image 7 "KPI 진행률 60%" 참고, 백엔드 산정값 표시만 — 정량 KPI 목표달성 비율로 계산, 재계산 아님·집계 표시).
- `apps/web/features/eval-midterm/ui/ReviewSplitPanel.tsx` **(신규)** — "상급자 중간 점검" 탭 본문. KPI 카드마다 `grid md:grid-cols-2`로 좌(`KpiSelfSummary`)/우(`KpiReviewerOpinion`) 분리.
- `apps/web/features/eval-midterm/ui/MemberActionsTab.tsx` **(신규)** — 기존 "보완조치" 섹션 탭 로직을 그대로 분리(상태 전이·모달 로직 불변).
- `apps/web/features/eval-midterm/ui/deptHeadHelpers.tsx` **(신규)** — `targetsToUsers`, `ReviewBadge`(구성원 리스트 배지: 승인/제출/미제출) 분리, 배지 색을 브리프 §7-2 토큰으로 통일.

### API 범위 확인 결과 — 배선 vs 갭
`MidtermReview`(`apps/web/lib/types.ts`)와 백엔드(`apps/api/src/modules/midterm/midterm-reviews.service.ts`)를 확인:
- `confirm` 액션은 **review 레코드 전체 1건**(`reviewerNote`, `confirmedAt`, `status: confirmed`)만 갱신. `POST /midterm/reviews/:id/confirm` 바디는 `{ reviewerNote?: string }`뿐.
- `KpiCheckIn.reviewerNote`/`reviewerGrade` 필드는 DTO에 존재하지만, 이를 KPI별로 개별 upsert하는 API는 없음(서비스 코드에 해당 write path 없음 확인).
- 반려(rejected)/수정요청(revision_requested) 상태는 `MidtermReviewStatus`(`pending`\|`self_done`\|`confirmed`)에 없음.

**따라서 구현:**
- ✅ **배선함:** 전체 승인(`midtermReviewCommands.confirm`) — `ReviewSplitPanel`의 "승인" 버튼 클릭 시 `reviewerNote`와 함께 review 전체를 confirmed로 전이. 모든 KPI 카드가 동일 `review` 객체를 참조하므로 승인 즉시 전 카드가 "승인 완료"로 갱신.
- ⚠️ **UI만 노출(비활성 + 안내), API 갭으로 기록:** KPI 카드별 "반려"·"수정요청" 버튼 — `disabled` + `title` 툴팁으로 "API 갭(리뷰 전체 단위 승인만 가능)"을 명시. 상급자 의견 textarea는 전 KPI가 공유(review 전체 단위로만 저장 가능)함을 placeholder에 명시.
- 실제로 오해를 유발하지 않도록, KPI별로 "검토 중" 가짜 상태를 만들지 않고 정직하게 "전체 승인 시 함께 저장됨"을 안내하는 방향으로 구현(1차 초안에서 KPI별 개별 배지를 시도했으나 API 실제 동작과 불일치해 철회).

### 색 토큰(브리프 §7-2 준수)
- 미제출: `#F4F5FA`/`#6B6980`, 진행중(self_done): `#EAF2FE`/`#0257CE`, 승인완료(confirmed): `#E3F7EC`/`#0B7A47`.
- 승인 버튼 = 블루 solid(`variant="primary"`), 반려/수정요청 = 그레이 outline(`variant="secondary"`, 비활성).
- 구성원 리스트는 이미 `EvaluationSubjectPanel`이 공용 `Avatar` 사용 중(Foundation 완료분, 미변경).

### 공용 컴포넌트 수정 여부
- `MidtermProgressTable.tsx`, `MidtermSignalBadge.tsx` — grep 확인 결과 `MidtermResultSummary.tsx`(다른 화면)에서도 사용 중 → **수정하지 않음**(§P11 지시대로).
- `MidtermStepper*` — 코드베이스에 해당 이름의 컴포넌트가 존재하지 않음(과거 CLAUDE.md 이력의 컴포넌트가 이후 리네임/제거된 것으로 추정). 영향 없음.
- `EmployeeMidterm.tsx`, `KpiCheckInCard.tsx`, `RebaselineReviewQueue.tsx` — 이번 작업 지시 범위(§P11은 부서장 검토 프로세스 분리에 한정) 밖이라 **미변경**. 하드코딩 구색 hex(`#1B64DA`·`#029359`·`#3182f6`) grep 결과 없음(토큰 클래스만 사용 중).

---

## 검증
- `npx tsc --noEmit -p apps/web/tsconfig.json` — P10/P11 대상 파일(competency-eval, eval-midterm) 0 에러. (전체 실행 시 `reports-summary/ui/SummaryRowExpand.tsx` 1건 에러가 남아있으나 이는 병렬 작업 중인 다른 화면 파일로 본 작업 범위 밖.)
- `next build` 미실행(작업 지시대로 QA가 1회 실행). 프리뷰 검증 미실시(메모리 규칙).
- 파일당 라인 수: 전 신규/수정 파일 200줄 이내(최대 198줄, `DeptHeadMidterm.tsx`).

## API 갭 (기록)
1. **KPI별 상급자 반려/수정요청** — `MidtermReviewStatus`에 `rejected`/`revision_requested` 없음, `KpiCheckIn.reviewerNote`/`reviewerGrade` 개별 저장 API 없음. 현재는 review 전체 단위 승인(confirm)만 가능.
2. **KPI별 개별 승인 시각/이력** — `confirmedAt`이 review 전체 1개뿐, KPI 카드별 독립 타임스탬프 없음.
(§P10은 기존 API로 완전 커버 — 신규 갭 없음.)
