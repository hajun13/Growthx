# FE-F 구현 노트 — 월별실적 개편 + 이의제기 프로세스 UI + 평가 결과표 + 분포 모니터링

(2026-07-02, `Part/` 클라이언트 수정요청 §P15·P16·P17·P18)

브랜치: `feat/part-spec`. 수정 범위: `features/admin-monthly-performance/`, `features/appeals/`,
`features/reports-summary/`, `features/reports/` + 해당 `app/(main)` 페이지(변경 없음, 이미 얇은 라우트).
공용 `components/`·`lib/`·`packages/`는 수정하지 않음(Foundation 패스가 이미 완료한
`Avatar`·`gradeSolidClass`·`gradeSoftClass`·`gradeChipColor` 등만 소비).

## P15. 월별실적 (image 11)

**핵심 변경**: 기존 코드는 "4행×15열 가로 스크롤 엑셀 그리드"(TSV 붙여넣기·셀 선택 포함)였으나,
요구사항이 "1~12월 탭 선택" 방식을 명시적으로 요구해 UI를 전면 재작업했다. 데이터 계층
(`api.ts`/`hooks.ts` — `useFinancialGrid`/`financialGridCommands.bulk`)은 그대로 재사용.

- 상단 요약 카드 7종(`PerfSummaryCards.tsx`): 누적매출/원가/매출총이익/이익률(목표대비 진행바) +
  입력완료현황(n/12) + 예상연간달성률(완료월 평균×12/목표) + 저장상태(수정됨/저장됨 + 시각).
- 그래프 분리(`PerfCharts.tsx`): ①매출 목표 vs 실적(라인 2종) ②매출총이익(바) vs 이익률(라인,
  우측 보조축) — `recharts` `ComposedChart`.
- 월 탭(`MonthTabBar.tsx`): 1~12월 버튼, 완료 월에 도트 표시.
- 월 입력 표(`MonthInputTable.tsx`): 매출/원가(편집 가능)·매출총이익/이익률(자동) 4행 ×
  [전년실적/올해목표/올해실적/달성률(B/A)/전년대비증감/비고] 열. 매출총이익·이익률은 라이브 계산만
  표시(백엔드에 저장하지 않음 — 값 자체가 파생값).
- 우측 달성 현황 패널(`AchievementPanel.tsx`): 매출달성률/이익률/매출총이익 3항목 + 양호(≥100%)/
  주의(80~99%)/위험(<80%) 배지.
- 하단 입력 가이드(`InputGuide.tsx`): 4개 카드(실적입력/입력기간/목표달성기준/저장안내), 시안 문구 그대로.
- 파생 계산은 `usePerfDerived.ts`, 부서 스코프 필터는 `useScopedDeptOptions.ts`, 저장 커맨드는
  `usePerfSave.ts`로 분리(파일당 ~200줄 상한 — `MonthlyPerformanceView.tsx`는 195줄로 오케스트레이션만).

**정리(dead code 제거)**: 옛 엑셀 그리드 전용이던 `FinancialGrid.tsx`·`FinancialGridRows.tsx`·
`FinancialGridStyles.ts`·`useFinancialSelection.ts` 4개 파일 삭제(더 이상 어디서도 import 안 됨,
tsc로 확인). `FinancialGridHelpers.ts`는 계산 헬퍼만 남기고 셀 네비게이션/TSV 파싱 헬퍼 제거(235→102줄).

**API 갭**:
- 임시/최종저장 구분 없음 — `POST /monthly-performance/bulk` 단일 저장만 존재. UI는 "임시저장"
  (로컬 draft만 유지, 서버 미호출)과 "최종저장"(실제 bulk 호출)으로 구분 표시하되, 새로고침하면
  임시저장 내용은 유실된다. 진짜 서버측 draft 상태가 필요하면 `MonthlyPerformance`에
  `status: draft|final` 필드 추가가 필요.
- 비고(월별 코멘트) 필드 없음 — 입력 표의 "비고" 열은 UI만 존재, 저장하지 않는다.

## P17. 이의제기 (image 13)

`AppealsView.tsx`를 오케스트레이션만 남기고 `AppealListPanel`(좌측 목록)·`AppealDetailPanel`
(우측 상세)·`AppealStepper`(진행 스테퍼)·`AppealDecisionForm`(HR 최종 결정)·`AppealCreateForm`
(신청 폼)·`useAppealActions`(커맨드 훅)로 분리.

- 좌측 목록: `Avatar` + `StatusBadge`(상태 배지) + 제목·신청자·날짜 카드형, 상단 필터칩(전체/접수/
  검토중/답변완료/최종완료 카운트).
- 우측 상세: 신청자 정보 카드(신청일·현재상태·처리담당자) → 진행 스테퍼(접수→검토중→부서장답변→
  HR최종결정, 완료 단계는 진네이비 체크) → 처리 내용 카드(신청내용/부서장답변/HR검토, 각각 아이콘+톤
  구분) → 첨부파일(안내만) → 최종 결정 폼.
- 최종 결정: 5종 라디오(평가유지/점수수정/등급수정/재평가진행/기각) + 사유 텍스트(500자 제한) +
  "등록 후 수정 불가" 경고 배너.

**API 갭**:
- 결정 유형 enum 없음 — `DecideAppealDto.decision`은 자유 텍스트 하나뿐. 선택한 유형 라벨을
  `[유형] 사유` 형태로 접두어 붙여 무손실 전송(백엔드 파싱 없이 텍스트로 저장). 백엔드에 결정 유형
  컬럼을 추가하면 즉시 정식 필드로 전환 가능.
- 상태 4종뿐(반려 없음) — `AppealStatus`는 submitted/under_review/answered/closed. 요구사항의
  5상태 중 "반려"는 계약에 없어 필터·배지에서 제외.
- 단계별 완료일시·담당자 이름 없음 — `respondedById`/`decidedById`(ID)와 `updatedAt`(단일
  타임스탬프)만 존재. 스테퍼는 상태 전이 여부로 완료를 판정하고 날짜는 근사치(`createdAt`/
  `updatedAt`)를 사용, 담당자는 역할명("부서장"/"HR")으로 폴백.
- 첨부파일 필드 없음 — 카드 UI만 두고 "준비 중" 안내, 업로드/다운로드 미구현.

## P16. 평가 결과표 (image 12)

- 상단 등급 분포 그래프 → `SummaryGradeStats.tsx`(S~D 등급별 인원 카드, 배지+인원+비율).
- 필터(`SummaryFilters.tsx`): 그룹→본부→팀 캐스케이드 + 직급 + 등급 + 평가상태(finalGrade 유무로
  판정) + 이름 검색.
- 기본 목록: 성명 앞 `Avatar`, 그룹/본부/팀/직급/평가상태/최종점수(정렬 토글)/최종등급/상세보기.
- 상세보기 클릭 시 `SummaryRowExpand.tsx`가 1차(팀장)/2차(본부장)/최종(그룹대표) 실적·역량 점수와
  환산 결과를 펼쳐 보여준다(`SummaryRowDto.stage1/2/Final/sum` 그대로 표시, 재계산 없음).

**API 갭**: 단계별 평가의견(코멘트) 필드 없음 — `SummaryRowDto`는 점수(perf/comp)만 제공, 확장
패널에 "평가의견은 별도 필드로 제공되지 않아요" 안내 문구로 대체.

## P18. 분포 모니터링 (image 14)

`ReportsView.tsx`의 "분포 모니터링" 탭을 `DistMonitorTab.tsx`(본체) + `DistGradeCards`(상단
S~D 카드) + `DistCompanyBar`(전사 컬러 막대) + `DistDeptBars`(부서별 컬러 누적바+더보기) +
`DistResultList`(Avatar·순위·최종점수·등급배지·상세보기) + `DistFilters`(캐스케이드+정렬+초기화) +
`DistFootnote`(하단 안내문)로 분리. "월별 실적" 탭은 P18 범위 밖이라 `MonthlyPerfTab.tsx`로
그대로 이관(구조 불변).

**API 갭**: 분포 목록 API(`resultsControllerList` → `EvaluationResultDto`)는 `departmentName`
단일 문자열만 가져 그룹/본부/팀/직급 개별 캐스케이드 필터가 불가능하다. `resultsControllerSummary`
(`SummaryRowDto` — group/division/team/position 분리 필드, P16과 동일 엔드포인트)를 추가로
소비해 필터 조건에 맞는 `userId` 집합만 얻고, 실제 표시(점수·등급·이름)는 여전히
`EvaluationResultDto` 기준을 유지한다(계산 값 불일치 방지 — 두 DTO의 finalScore/finalGrade는
동일 소스이므로 안전).

## 공통 사항

- 등급·상태 색은 전부 토큰 소비(`GradeChip`/`gradeChipColor`/`gradeSolidClass`/`gradeSoftClass`/
  `StatusBadge`) — 하드코딩 hex 없음(차트 라인 색만 시안 참고 인라인, 등급 배지와 무관).
- Avatar는 전부 공용 `@/components/Avatar` 사용(사진 없음 → 파스텔 이니셜 폴백, Foundation 갭
  기록과 동일).
- 계산(총점·달성률·년계 등)은 백엔드 응답을 표시하거나(SummaryRowDto의 점수), 프론트 라이브
  계산이 필요한 경우(월별실적 매출총이익·이익률·년계, 이의제기 스테퍼 진행도)는 명시적으로
  "저장값 아님, 표시 전용"으로 주석 처리.
- 파일당 ~200줄 상한 준수 — 4개 feature 전 파일이 200줄 이하(`MonthlyPerformanceView.tsx` 195,
  `AppealsView.tsx` 132, `EvaluationSummaryView.tsx` 197, `DistMonitorTab.tsx` 191).

## 검증

- `npx tsc --noEmit -p apps/web/tsconfig.json` — **0 에러**.
- `next build`는 QA가 별도 1회 수행(작업 지시 — 병렬 실행 금지).
- 프리뷰 검증 미실시(프로젝트 규칙 — 로그인 불가 환경).
