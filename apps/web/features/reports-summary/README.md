# reports-summary feature

평가자정리 표(평가 결과 요약) 화면 — 새 아키텍처 표준 패턴(두 번째 적용, [[notifications]] 패턴 복제).

- **책임:** 다단계(1차 팀장·2차 본부장·최종 그룹대표) 평가 합산 표 조회·필터.
- **소비 API:** `@growthx/contracts` `resultsControllerSummary`(타입: `SummaryRowDto`).
- **구조 (image 12 재현, 2026-07-02 Part/ 수정요청 P16):**
  - `api.ts`(봉투 unwrap) · `hooks.ts`(`useEvaluationSummaryData`).
  - `ui/EvaluationSummaryView.tsx` — 오케스트레이션(상단 등급 통계 + 캐스케이드 필터 + 표).
  - `ui/SummaryGradeStats.tsx` — 상단 S~D 등급별 인원 카드(분포 그래프 대체).
  - `ui/SummaryFilters.tsx` — 그룹/본부/팀/직급/등급/평가상태 캐스케이드 필터 + 검색.
  - `ui/SummaryRowExpand.tsx` — 행 확장 시 1차/2차/최종 점수·환산 결과 표시.
  - 라우트는 `<EvaluationSummaryView/>`만.
- **백엔드:** `results` 컨트롤러 `GET /summary`에 `@ApiTags('results')`+`@ApiOkEnvelopeArray(SummaryRowDto)` 부착(응답 타입화).
- **API 갭 (P16):** 단계별 평가의견(코멘트) 필드 없음 — `SummaryRowDto`는 점수(perf/comp)만 제공, 의견 텍스트는 행 확장 패널에 안내 문구로 대체.
- **비고:** `usePositions`·`useCurrentCycle` 등 보조 데이터는 기존 훅 유지(주 데이터만 생성 클라이언트로 이관). Avatar는 공용 `@/components/Avatar` 사용.
