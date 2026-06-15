# competency-eval feature

역량평가(임직원 본인 응답) 화면 슬라이스. 라우트 `/(main)/competency/eval` 가 `<CompetencyEvalView/>` 만 렌더한다.

역량평가는 **참고용**(연봉·등급 미반영) — 연 1회(12월) 진행, 10문항 S/A/B/C/D. 중간평가(MIDTERM) 주기에서는 진행하지 않고 안내 배너만 표시한다.

## 구성

| 파일 | 책임 |
|------|------|
| `api.ts` | `@growthx/contracts` 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). 문항/응답 조회, 일괄 저장/제출. |
| `hooks.ts` | `useCompetencyQuestions`·`useCompetencyResponses`(로드+reload) + `competencyResponseCommands`(저장/제출). |
| `ui/CompetencyEvalView.tsx` | 화면 로직·렌더. 점수(1~5)↔등급(S~D) 매핑, 카테고리 필터, 진행률, 하단 고정 액션 바. |

## 데이터 흐름

- 생성 클라이언트(`competencyControllerListQuestions` 등)는 `{ data: <봉투>, status, headers }` 를 반환 →
  실제 값은 `res.data.data`. `api.ts` 가 한 번 unwrap 해 컴포넌트엔 배열만 넘긴다.
- 점수 버튼은 1~5 이지만 백엔드 저장은 Grade enum(S/A/B/C/D). View 의 `scoreToGrade`/`gradeToScore` 가 변환.
- 인증/baseUrl 부트(`configureApi`)는 `(main)/layout` 에 마운트되어 있어 별도 처리 없음.

## 사용 API (competency 컨트롤러)

- `competencyControllerListQuestions({ cycleId })` — 주기별 문항 목록
- `competencyControllerListResponses({ cycleId, userId })` — 본인 응답 목록
- `competencyControllerBulkRespond({ cycleId, submit, responses })` — 일괄 임시저장(`submit:false`)/최종제출(`submit:true`)

> 문항 CRUD(`create/update/remove`)는 관리자 화면(`/admin/competency/items`) 소관 — 본 슬라이스는 조회·응답만 사용.
