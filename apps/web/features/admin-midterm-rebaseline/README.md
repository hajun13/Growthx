# feature: admin-midterm-rebaseline

`/admin/midterm/rebaseline` 경로의 수직 슬라이스. 중간점검 목표 재조정(rebaseline) 데이터 계층.

## 현재 상태 (동작 보존)

이 경로의 화면은 2026-06-08 재조정 워크플로우 전환으로 **폐기**됐다. 부서장 검토 큐는
`/eval/midterm` 의 `DeptHeadMidterm`(`RebaselineReviewQueue`)·구성원 요청은
`RebaselineRequestSection` 에 통합됐다. 따라서 라우트 진입 시 `/eval/midterm` 으로
**리다이렉트**한다(`ui/RebaselineAdminView.tsx`). 기존 page.tsx 의 redirect 동작 그대로.

## 구성

| 파일 | 역할 |
|------|------|
| `api.ts` | `@growthx/contracts` 생성 클라이언트 호출 + 봉투 unwrap(`res.data.data`). 도메인 값만 반환. |
| `hooks.ts` | 목록·상세·이력 로드 훅 + 변이 커맨드(`rebaselineCommands`). `'use client'`. |
| `ui/RebaselineAdminView.tsx` | 라우트 본문. 현재는 `/eval/midterm` 리다이렉트. |

라우트 `app/(main)/admin/midterm/rebaseline/page.tsx` 는 `<RebaselineAdminView/>` 만 렌더하는
얇은 래퍼.

## 사용 계약 (midterm 모듈)

생성 클라이언트(`@growthx/contracts`)에서 사용하는 함수:

- `midtermControllerListRebaselineRequests` — 요청 목록(`{ cycleId, evaluateeId? }`).
- `midtermControllerGetRebaselineRequest` — 단건 상세(`currentKpis`·`proposedChanges`·`weightValid`).
- `midtermControllerCreateRebaselineRequest` — 요청 생성.
- `midtermControllerUpdateRebaselineRequest` — 요청 수정(제출 전 보완).
- `midtermControllerReviewRebaselineRequest` — 부서장 검토(승인·반려).
- `midtermControllerRebaselineHistory` — 승인분 변경 이력(스냅샷 단위).

> ⚠ 봉투 gotcha: 목록·이력 함수는 `{ data: { data: [...], meta } }` 형태(봉투 안에 또
> 페이지 봉투) → 실제 배열은 `res.data.data.data`. `api.ts` 에서 unwrap 완료.

등급 배지 색이 필요하면 공유 모듈 `@/lib/grade`(`gradeColor`)를 쓴다(페이지 로컬 상수 금지).
