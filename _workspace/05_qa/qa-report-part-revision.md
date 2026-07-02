# QA 리포트 — Part/ 클라이언트 수정요청 재스킨 (프론트 전용) 최종 게이트

**일자:** 2026-07-02
**대상:** Foundation + FE-A~F 병렬 산출물(`_workspace/00_input/part-revision-requirements.md` P1~P18)
**범위:** `apps/web` 표현 계층 전용. `apps/api` 미검증 대상(변경 없음 확인).
**게이트 판정: PASS (조건부 아님 — 결함 3건 직접 수정 후 green)**

---

## 0. 빌드 게이트 (필수) — PASS

병렬 작업 직후 이 저장소의 `apps/web/node_modules`가 깨져 있어(pnpm workspace symlink 다수 누락, `.pnpm` 스토어 사실상 비어있음) `npx tsc`/`node_modules/.bin/tsc`가 `Cannot find module .../typescript/bin/tsc`로 즉시 실패했다. `pnpm install --force`로도 해결되지 않아(lockfile "up to date"로 재해석 스킵), **루트 node_modules(정상 설치됨)의 바이너리를 프로젝트 지정 인자로 직접 호출**하는 우회로 실행:

```
node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json   # 루트에서 실행
node ../../node_modules/next/dist/bin/next build            # apps/web에서 실행
```

- **tsc --noEmit**: 0 에러 (1차 실행, RuleSetEditor/RebaselineReviewQueue 수정 후 재실행 모두 0건)
- **next build**: 성공, **35개 라우트 전부 생성**(정적 33 + 동적 2: `/eval/result/[userId]`, 기타). 에러 0건. 경고 1건(`outputFileTracingRoot` unrecognized key — 기존부터 있던 next.config 경고, 이번 변경과 무관, 빌드 실패 아님).
- 삭제 파일(FE-F가 지운 `FinancialGrid.tsx`/`FinancialGridRows.tsx`/`FinancialGridStyles.ts`/`useFinancialSelection.ts`) 잔존 참조 없음 확인(grep — `FinancialGridHelpers.ts`의 `FinancialGridCell`/`fetchFinancialGrid` 등은 데이터 레이어 타입/함수명이라 별개, 정상).
- 에이전트 간 간섭 잔재(중복 정의·깨진 import) 없음 — FE-D가 세션 초반 자체 수습한 `DeptHeadEvalView.tsx` 중복 정의, FE-E의 `DeptHeadMidterm.tsx` 분리도 최종 상태에서 충돌 없음.

**참고(환경 이슈, 코드 결함 아님):** `apps/web/node_modules`가 다음 QA/빌드 세션에서도 동일하게 깨질 가능성이 있다 — 원인은 미상(디스크 정리·worktree 작업 등으로 추정). release-engineer/차기 세션은 `pnpm install`이 "Lockfile is up to date, resolution step is skipped"로 조용히 아무 것도 안 하는 경우 `pnpm install --force` 후에도 `apps/web/node_modules`가 3개 항목만 있다면 루트 바이너리 우회 호출로 진행할 것.

---

## 1. 데이터 레이어 불변 확인 — PASS

`git diff --stat main -- apps/web`로 변경 47개 파일 전수 확인. 데이터 계층 파일 중 diff가 있던 것은 3개:

| 파일 | 변경 내용 | 판정 |
|---|---|---|
| `features/reports/api.ts` | `fetchResultsSummary()` 신규 함수 추가 — 기존 `resultsControllerSummary`(P16과 동일 엔드포인트, orval 생성 계약) 재사용. 기존 `fetchResults` 시그니처/반환 shape 무변경 | PASS — 신규 소비 추가, 계약 변경 없음(브리프 §3 "추가 소비 허용") |
| `features/reports/hooks.ts` | `useResultsSummaryData()` 신규 훅 추가(P18 분포 모니터링 캐스케이드 필터용). 기존 `useResultsData` 무변경 | PASS — 동일 사유 |
| `features/reports-summary/hooks.ts` | `export type { SummaryRow }` re-export 1줄 추가만 | PASS — 타입 재노출, 요청/응답 shape 무변경 |

`features/appeals/api.ts`, `lib/types.ts`는 최종 워킹트리 기준 main 대비 diff 없음(대화 시작 시점 snapshot과 세션 진행 중 상태가 달랐던 것으로 확인 — 현재는 appeals의 `api.ts`/`hooks.ts` 완전 무변경). 엔드포인트 URL·요청 바디·응답 shape 변경 0건.

---

## 2. 등급 색 일관성 — PASS (결함 1건 발견·직접 수정)

### 2-1. 구 등급 색 하드코딩(`#3f2c80`/`#0054ca`/`#4CAF50`/`#FF9800`/`#F44336`) — 잔재 없음
`features/`·`components/` grep 결과 0건.

### 2-2. 흑백 등급 색(`#111111`/`#2F2E2C`/`#615D59`/`#8A8178`) — 등급 용도 오검출 정리
grep 히트 8개 파일을 전수 컨텍스트 확인:
- `CompensationView.tsx`(인쇄창 body 텍스트색), `WeightSummaryBar.tsx`(가중치 검증 SUCCESS_FILL), `SelfEvaluationView.tsx`(KPI 그룹 라벨색, S~D 등급 아님), `OrgStructureBoard.tsx`(조직 노드 타입 강조색 `K` 팔레트) → **등급(Grade) 용도 아님, §0-2 범위 밖** — false positive.
- **`RuleSetEditor.tsx`(등급/풀/인상률 설정 관리자 화면) — 실결함.** `gradeFill`(S~D 막대/세그먼트 색, 7곳에서 사용)과 `GRADE_BADGE`(등급 배지)가 여전히 `S:#111111`~`D:#E6E2DE` 흑백 그레이스케일이었다. 이 화면은 Part 요구사항 P1~P18 목록에 없어 6개 FE 그룹 누구의 할당 범위도 아니었고, Foundation 노트도 명시적으로 미접촉이라 기록 — **§0-2 "전 화면 동일 적용" 위반**으로 QA가 직접 수정.
  - **수정:** `apps/web/components/RuleSetEditor.tsx:41-47`(`gradeFill`), `:287-293`(`GRADE_BADGE`) — 이미 import돼 있던 `gradeChipColor`(브리프 §2 Solid 세트, `apps/web/lib/palette.ts`)에서 파생하도록 교체. tsc/build 재검증 green.

### 2-3. C 등급 흰 글씨 렌더 — 없음
`GradeChip`/`gradeSolidClass`/`gradeChipColor`(Foundation) 전부 C=`#3D2900`(진갈색) 텍스트로 통일 확인. `EvalReport.tsx`(인쇄 portal, 별도 document라 인라인 hex 복제 — 정당한 예외)도 `GRADE_FG.C = '#3D2900'` 일치. `EvalResultView.tsx`의 `GRADE_TONE`은 `gradeChipColor.{S,A,B,C,D}.bg`에서 파생(하드코딩 아님) — 오검출.

### 2-4. 표본 확인 — feature가 GradeChip/gradeSolidClass/gradeSoftClass/gradeChipColor 소비
`eval-my`(GradeTile→GradeChip), `eval-result-detail`(SummaryGradeBox→GradeChip), `eval-result`(GRADE_TONE→gradeChipColor 파생), `reports/DistDeptBars.tsx`(누적바→gradeChipColor), `reports-summary/SummaryGradeStats.tsx` 전부 공용 헬퍼 소비 확인, 하드코딩 재도입 없음.

---

## 3. 버튼 규칙 — PASS (결함 1건 발견·직접 수정)

`variant="danger"`(빨강 solid) 전수 검색 결과 4곳:

| 위치 | 액션 | 판정 |
|---|---|---|
| `admin-cycle/ui/CycleOpsView.tsx:429` | 사이클 삭제(Trash2 아이콘) | PASS — 진짜 파괴적 액션, 브리프 §4 예외("파괴적 액션은 Outline 빨강 + 확인 모달") 해당, 확인 모달(`confirmDelete`) 존재 |
| `components/PersonEditModal.tsx:215` | 사용자 비활성화 | PASS — 동일 사유(파괴적 액션 예외) |
| `kpi-review/ui/KpiReviewSubComponents.tsx`(RejectModal 확인 버튼) | 반려 확정 모달 내부 액션 | PASS — FE-D 노트가 근거 기록(공용 `Modal.tsx`이 `primary\|danger`만 지원하는 구조적 제약 + "확정 모달" 성격), 리스트의 트리거 버튼은 이미 secondary로 정리됨. 재확인 완료 |
| **`eval-midterm/ui/RebaselineReviewQueue.tsx:332`** | **재조정 요청 반려 버튼**(리스트 트리거, 확인 모달 아님) | **FAIL → 수정** |

**결함:** 재조정(rebaseline) 검토 큐의 "반려" 버튼이 `variant="danger"`(빨강 solid)로 렌더 — §0-4/§4 "반려·수정요청은 그레이 톤" 정면 위반. P11(중간점검) FE-E 담당 범위였으나 FE-E 노트가 "이 컴포넌트는 부서장 검토 프로세스 분리(§P11 범위)와 무관해 미변경"이라 기록한 파일 — 결과적으로 6개 그룹 중 누구도 처리하지 않은 커버리지 갭.
**수정:** `apps/web/features/eval-midterm/ui/RebaselineReviewQueue.tsx:332` — `variant="danger"` → `variant="secondary"`(승인 버튼 `variant="primary"`는 유지, 브리프 §4 그대로). tsc/build 재검증 green.

---

## 4. Avatar 채택 — PASS
`charAt(0)` 검색 결과 `Avatar.tsx`(정상, 폴백 이니셜 계산 자체) 외 0건. 유사 패턴(`slice(0,1)`/`substring(0,1)`/`[0]`) 4건도 배열 인덱싱(false positive)으로 이니셜 아바타와 무관 확인. 사용자 목록(`UsersTab`)·조직(`OrgStructureBoard`/`OrgPersonCard`)·이의제기(`AppealListPanel`)·평가 화면 전부 `Avatar` 사용 확인.

---

## 5. 요구사항 커버리지 표본 검사 — 전부 PASS

| 항목 | 확인 근거 |
|---|---|
| P3(정렬 5컬럼) | `UsersTab.tsx:40` `UserSortKey = 'group'\|'team'\|'position'\|'hireDate'\|'status'` — 5개 일치 |
| P7(스테퍼 마감일+대기 박스) | `MyEvaluationView.tsx` `dueLabel`(`"MM.DD(요일)까지"`), "대기" 박스 텍스트 확인 |
| P14(상단 요약 카드 삭제) | `EvalResultView.tsx` grep 0건(전체 대상자/완료자/평균점수/등급비율 문구 없음) — 요구사항대로 이미 부재 |
| P15(월 탭 방식) | `admin-monthly-performance/ui/MonthTabBar.tsx`·`MonthInputTable.tsx` 존재, 옛 그리드 삭제 확인 |
| P16(등급 카드 통계+행 확장) | `reports-summary/ui/SummaryGradeStats.tsx`(카드) + `SummaryRowExpand.tsx`(행 확장), `EvaluationSummaryView.tsx`에서 둘 다 렌더 확인 |
| P17(5종 결정) | `appeals/ui/AppealDecisionForm.tsx:12-16` — maintain/score/grade/reevaluate/reject 5종 확인 |
| P18(컬러 누적바+필터) | `reports/ui/DistDeptBars.tsx` `gradeChipColor[g].bg` 사용 컬러 누적바, `DistFilters.tsx` 캐스케이드 확인 |

---

## 6. 파일 200줄 상한(H1, 참고 — 비차단)
다음 파일은 이번 Part 패스 이전부터 초과 상태였고, 각 노트가 "최소 침습 처리, 전면 리팩터는 별도 작업"으로 명시적으로 기록한 기존 부채다. 이번 게이트의 차단 사유는 아니며 후속 리팩터 권고로만 기록:
- `AdminUsersView.tsx` 634줄, `PermissionsView.tsx` 758줄, `OrgStructureBoard.tsx` 811줄, `DeptHeadEvalView.tsx` 594줄, `KpiWriteView.tsx` 839줄.

---

## 7. API 갭 통합 목록 (후속 백엔드 작업 후보)

각 FE 노트에서 수집한 전체 갭. 우선순위는 요청 빈도·차단 정도 기준 QA 판단.

### 높음 — 여러 화면에서 실질 기능 차단
1. **`Evaluation.status`에 반려/수정요청 상태 없음** (FE-D, P13) — `EvalStatus`는 `not_started|in_progress|submitted|finalized` 4종뿐. 부서장 평가의 "수정요청 사유/반려 사유 입력, 상태: 수정요청·반려"(P13 요구사항)가 **프론트 구현 불가**. 필요: `revision_requested`/`rejected` 상태 추가 + `rejectReason` 필드 + 전이 엔드포인트.
2. **중간점검 KPI별 개별 반려/수정요청 불가** (FE-E, P11) — `MidtermReviewStatus`(`pending|self_done|confirmed`)에 반려/수정요청 없고, `KpiCheckIn.reviewerNote`/`reviewerGrade` 개별 upsert API 없음. 현재 review 전체 단위 승인(confirm)만 가능 — KPI 카드별 반려/수정요청 버튼은 비활성+안내로 정직하게 처리(가짜 상태 생성 회피).
3. **평가 상태 전이 이력 조회 API 없음** (FE-D) — `EvaluationDetail.comments`(기존 필드) 재사용으로 코멘트 이력만 표시 가능, 상태 전이(수정요청→재제출 등) 자체 이력은 표시 불가. 위 갭 1과 연동.

### 중간 — UI는 폴백/우회로 커버됨
4. **`User.photoUrl` 없음** (Foundation 최초 기록, 전 화면 공통) — `Avatar` 파스텔 폴백이 사실상 기본값. `OrgPerson.avatarUrl`만 존재.
5. **이의제기 결정 유형 enum 없음** (FE-F, P17) — `DecideAppealDto.decision`이 자유 텍스트뿐. `[유형] 사유` 접두어로 무손실 전송 중. 결정 유형 컬럼 추가 시 정식 필드 전환 필요.
6. **이의제기 상태 5종 중 "반려" 없음** (FE-F, P17) — `AppealStatus`는 `submitted|under_review|answered|closed` 4종. 필터·배지에서 제외 처리 중.
7. **이의제기 단계별 완료일시·담당자 이름 없음** (FE-F) — `updatedAt` 단일 타임스탬프 + ID만 존재. 근사치/역할명 폴백 중.
8. **월별실적 임시/최종저장 구분 없음** (FE-F, P15) — `POST /monthly-performance/bulk` 단일 저장뿐. UI는 로컬 draft로 "임시저장" 흉내만 냄(새로고침 시 유실). `MonthlyPerformance.status: draft|final` 필드 필요.
9. **월별실적 비고(코멘트) 필드 없음** (FE-F, P15) — UI만 존재, 미저장.
10. **분포 모니터링 캐스케이드 필터 우회** (FE-F, P18) — `EvaluationResultDto`가 `departmentName` 단일 문자열이라 그룹/본부/팀/직급 개별 필터 불가. `resultsControllerSummary`(SummaryRowDto)를 보조 조회해 `userId` 집합만 얻는 방식으로 우회(계산 값은 동일 소스라 안전, 다만 API 호출 2배).
11. **평가 결과표 단계별 코멘트 없음** (FE-F, P16) — `SummaryRowDto`는 점수만 제공, 의견 필드 없음.
12. **첨부파일 필드 없음(이의제기)** (FE-F, P17) — 카드 UI만, 업로드/다운로드 미구현.

### 낮음 — 표시 참고용
13. **단계별 완료 일시(`completedAt`) 없음** (FE-C, P7) — 스테퍼 완료 단계 "참고 날짜"가 항상 공란, `dueDate`만 신뢰 가능 소스로 사용.
14. **AI 목표 추천 미구현** (FE-D, P6) — 요구사항 자체가 "검토 항목(미구현 가능)"으로 명시, Pill 배지만 노출.

---

## 8. 최종 판정

| 게이트 | 결과 |
|---|---|
| tsc --noEmit | PASS (0 에러) |
| next build (35 라우트) | PASS |
| 데이터 레이어 불변 | PASS |
| 등급 색 일관성 | PASS (결함 1건 수정: `RuleSetEditor.tsx`) |
| 버튼 규칙 | PASS (결함 1건 수정: `RebaselineReviewQueue.tsx`) |
| Avatar 채택 | PASS |
| 요구사항 커버리지(P3/P7/P14/P15/P16/P17/P18) | PASS |

**릴리스 게이트: 통과.** 백엔드/계약 미수정(지시 준수). API 갭 14건은 §7에 백엔드 협상 후보로 기록, 이번 프론트 전용 패스의 차단 사유 아님.
