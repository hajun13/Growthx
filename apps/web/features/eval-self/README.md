# eval-self — 본인평가 슬라이스

본인(self)이 확정된 KPI 과제별로 달성 등급을 평가/제출하는 화면의 수직 슬라이스.
라우트 `app/(main)/eval/self/page.tsx` 는 `ui/SelfEvaluationView` 만 렌더하는 얇은 래퍼다.

## 파일

- `api.ts` — 데이터 계층. `@growthx/contracts` 생성 클라이언트를 호출하고 응답 봉투를 한 번 unwrap(`res.data.data`). 생성 DTO 의 loose 한 JSON 필드(weightPolicy·gradingScales·grading·gradingCriteria)를 화면·헬퍼가 쓰는 정밀 `lib/types` 도메인 타입으로 좁혀 반환한다(런타임 동일, 정적 타입만 정밀화).
- `hooks.ts` — `api.ts` 호출을 `{ data, loading, error, reload }` 형태로 감싼 데이터 훅(useAsyncValue). 화면 로직은 기존 useAsync 소비 형태를 그대로 유지.
- `ui/SelfEvaluationView.tsx` — 화면 컴포넌트(기존 page.tsx 로직 이동). 시각·동작 보존, 데이터 소스만 생성 클라이언트 훅으로 교체.

## 사용하는 생성 클라이언트 함수(@growthx/contracts)

- 조회: `evaluationsControllerList`(self 필터는 클라이언트), `evaluationsControllerGet`, `evaluationsControllerListEvidence`, `kpisControllerList`, `ruleSetsControllerGet`
- 명령: `evaluationsControllerCreate`, `evaluationsControllerPatch`, `evaluationsControllerSubmit`

## 슬라이스 밖에 남긴 것(범위 외)

- 증빙 업로드/다운로드/삭제는 `@/hooks/useEvaluations` 의 `evidenceCommands`·`openEvidence` 를 그대로 사용한다. multipart 업로드·인증 blob 다운로드는 생성 fetch 클라이언트가 다루지 않는 흐름이라 기존 `lib/api` 헬퍼를 유지.
- 등급 배지 색은 공유 모듈 `@/lib/grade`(`gradeColor` — dark-on-light) 사용. 기존 로컬 `GRADE_BADGE` 상수(흰 텍스트)는 제거.

## 에러 처리 주의

생성 클라이언트는 `@growthx/contracts` 런타임의 `ApiError` 를, 증빙 헬퍼는 `@/lib/api` 의 `ApiError` 를 던진다(서로 다른 클래스). `instanceof` 대신 `errInfo(err)` 로 `code`/`message` 를 안전하게 읽어 분기한다(COMMENT_REQUIRED·POOL_EXCEEDED·ALREADY_EXISTS).
