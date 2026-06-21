# eval-result-detail

평가 상세결과 화면(`/eval/result/[userId]`)의 수직 슬라이스.

## 책임
- 한 사용자의 한 주기 평가 상세결과를 보여준다: 종합/그룹별 등급, 평가자 플로우(본인→1차 팀장→2차 본부장→최종 그룹대표), 단계별 점수 비교, 역량(참고용), 코멘트.
- 주기 상태에 따라 분기:
  - `mid_review` → 등급/보상 숨기고 중간점검 진척 요약(`MidtermResultSummary`)으로 대체(결과 상세 fetch 자체를 비활성).
  - `calibration`/`closed` → 보완 조치 이행 패널(`MidtermActionPanel`) 추가 노출.
- 임포트된 과거(2025 등) 결과는 라운드 요약 표로, 라이브 결과는 평가자별 분해로 표시.

## 파일
- `api.ts` — 데이터 계층. 생성 클라이언트 `resultsControllerGetDetail`(@growthx/contracts) 호출 + 봉투 unwrap(`res.data.data`). 런타임 동일 shape 이므로 기존 도메인 타입 `EvaluationResultDetail`(lib/types)로 좁혀 헬퍼 호환 유지.
- `hooks.ts` — `useResultDetailData(userId, cycleId)`. 둘 다 있어야 호출(없으면 비활성 — mid_review 게이팅). `{ data, loading, error, reload }` 반환.
- `ui/ResultDetailView.tsx` — 화면 로직(분기·요약 카드·플로우·비교·역량·코멘트·인쇄 모달). 데이터 소스만 생성 클라이언트 훅으로 교체, 시각/동작은 기존 페이지와 동일.
- (라우트 `app/(main)/eval/result/[userId]/page.tsx` 는 `<ResultDetailView/>` 만 렌더하는 얇은 래퍼)

## 의존
- 중간점검·보완조치(`useMidtermProgress`/`useMidtermReviews`/`useActionItems`)는 기존 공용 훅을 그대로 사용(이 슬라이스 범위 밖).
- 등급 색은 이 화면에 등급-색 배지가 없어(요약 박스는 Notion Low Color Purple 고정색) `lib/grade` 적용 대상 없음.
