# extra-3 — 중간점검 진행 현황(설계 §7.5)

기준 커밋: `4232f95` (feat/midterm-two-stage). 워크트리 HEAD 를 이 커밋으로 맞춘 뒤 작업.

## 무엇을 만들었나

HR 이 "지금 어디서 멈춰 있고, 누구를 재촉해야 하나"를 화면에서 답할 수 있게 하는 읽기 전용 집계와
평가 운영 화면 패널.

### 백엔드

| 파일 | 역할 |
|---|---|
| `apps/api/src/modules/midterm/midterm-summary.util.ts` (신규) | 판정 순수 함수 — `resolveWaitingOn`(상태→대기 주체·경과일), `groupWaitingByReviewer`(평가자 단위 묶음). Prisma 의존 없음 |
| `apps/api/src/modules/midterm/midterm-summary.service.ts` (신규) | HR 게이트 + 2쿼리 조회 + 조립. 단계별 인원수(`counts`) + `waitingOnReviewer` / `waitingOnMember` / `unassigned` |
| `apps/api/src/modules/midterm/midterm-summary.util.spec.ts` (신규) | 순수 함수 테스트 12건 |
| `midterm.controller.ts` | `GET /midterm/summary` (`@Roles(hr_admin)` + 느슨한 봉투) |
| `midterm.module.ts` | `MidtermSummaryService` 등록 |
| `dto/midterm.dto.ts` | `MidtermSummaryQuery { cycleId }` |

대기 주체 매핑(설계 흐름 그대로):

- `pending` → 1차 평가자 (경과 기준 `createdAt`)
- `commented` → 대상자 본인 (`firstCommentedAt`)
- `revised` → 2차 검토자 (`memberSubmittedAt`)
- `returned` → 대상자 본인 (`decidedAt`)
- `closed` / 레거시 자가점검 상태(`self_done`·`confirmed`·`revision_requested`·`rejected`) → 대기 아님
  (레거시는 `counts.legacy` 로 따로 세어 신규 흐름 수치를 오염시키지 않음)

부가 신호 두 가지:

- `compressedChain` — 1차·2차가 같은 사람(그룹대표 단독 폴백). 묶음 키는 `평가자:자리` 라
  겸직이어도 "1차 코멘트 대기"와 "2차 검토 대기"가 섞이지 않는다.
- `unassigned` — 평가자가 비어 있는 건. 재촉이 아니라 **재배정**이 필요하다는 점을 별도 경고로 표시.

권한: 컨트롤러 `@Roles(Role.hr_admin)` + 서비스 진입부의 명시적 `hr_admin` 검사
(`FORBIDDEN` / 한국어 문구) — `open`·`reassign` 과 동일한 방어 심층화.

### 쿼리 형태 (N+1 아님)

정확히 **2쿼리**:

1. `evaluationCycle.findUnique({ id })` — 주기 존재 확인. "잘못된 주기"와 "아직 개시 안 함"을
   구분하기 위한 것(없으면 `NOT_FOUND`).
2. `midtermReview.findMany({ where: { cycleId }, select: { …, evaluatee: { …, department }, firstReviewer, finalReviewer } })`
   — 주기 전건을 필요한 join 과 함께 한 번에.

평가자는 **개시 시점에 리뷰 행에 스냅샷**(`firstReviewerId`/`finalReviewerId`)돼 있으므로 join 으로
충분하다. `open()` 이 하는 사람별 `resolveMidtermReviewers` 루프(= 120명이면 수백 쿼리)는 쓰지 않았다.
단계별 인원수도 별도 `groupBy` 없이 같은 결과 집합에서 메모리 집계한다(행 ~120개).

### 웹

| 파일 | 역할 |
|---|---|
| `apps/web/features/eval-midterm/api-progress.ts` (신규) | 생성 클라이언트 `midtermControllerGetSummary` 호출 → 봉투 1회 unwrap → contracts `ApiError` → `@/lib/api` `ApiError` 변환(`api.ts` 의 `translateErrors` 와 동일 규약). 동시 편집 회피를 위해 `api.ts` 는 건드리지 않음 |
| `apps/web/features/eval-midterm/ui/MidtermProgressPanel.tsx` (신규) | 카드 헤더 + 새로고침 + 단계 타일 5개 + 상태 분기 |
| `apps/web/features/eval-midterm/ui/MidtermProgressLists.tsx` (신규) | 미착수자 3목록(평가자 대기 묶음 / 본인 대기 / 평가자 미배정). 200줄 상한을 지키려 분리 |
| `apps/web/features/admin-cycle/ui/CycleOpsView.tsx` | 기존 `MidtermOpenPanel` 바로 아래에 렌더(같은 `mid_review` 게이트) |

상태 분기를 4가지로 **서로 다르게** 처리: 로딩(스켈레톤) / 오류(`ErrorState` + 다시 시도) /
응답은 왔지만 값 없음(별도 `ErrorState` — 성공으로 오인해 "0명"으로 보이지 않게) /
진짜 빈 상태(`counts.total === 0` → `EmptyState` "아직 개시된 중간점검이 없어요" + 개시 안내).
추가로 `unfinished === 0` 이면 "모두 마감" 성공 메시지.

색은 시맨틱 토큰만(`text-foreground`·`text-muted-foreground`·`border-border`·`bg-card`·`bg-muted`·
`warning-*`·`success-*`), 라운드는 카드 `rounded-lg`(10px) / 내부 블록 `rounded-md`(8px),
수치는 전부 `tabular-nums`.

## 게이트 결과

| 게이트 | 결과 |
|---|---|
| `pnpm -C apps/api test` | **116 passed / 13 files** (기존 104 → 신규 12건 추가) |
| `pnpm exec tsc --noEmit -p apps/api` | 0 errors |
| `pnpm exec tsc --noEmit -p apps/web` | 0 errors |
| `pnpm -C apps/web run build` | ✓ Compiled successfully |
| `pnpm -C apps/api run openapi` | openapi.json 발행 (paths=140, 기존 139 +1) |
| `pnpm -C packages/contracts run generate` | 성공 |
| `pnpm -C packages/contracts run typecheck` | 0 errors |

DB 명령은 실행하지 않았다(`prisma:generate` 만 — DB 미접속).

신규 테스트 12건: `resolveWaitingOn` 9건(pending/commented/returned/revised 각 대기 주체·경과 기준,
closed+레거시 4상태 null, **1/1 압축 체인**(같은 사람이 두 자리 겸직 — pending·revised 양쪽),
평가자 미배정, 전이 시각 null 폴백, 미래 타임스탬프 음수 방지) +
`groupWaitingByReviewer` 3건(정렬·겸직 자리 분리·본인/미배정 제외).

## 우려·메모

- **generated 아티팩트 커밋 범위**: orval 재생성이 Windows 에서 200여 파일에 줄바꿈(CRLF) 변경만
  남겼다. 실제 내용이 바뀐 4개(`openapi.json`, `generated/midterm/midterm.ts`,
  `generated/model/index.ts`, 신규 `midtermControllerGetSummary*.ts` 3개)만 남기고 나머지는
  되돌렸다 — 병합 충돌 면적을 줄이기 위해서. 병합 시 어차피 codegen 을 한 번 다시 돌리므로 무해.
- **컨트롤러 충돌 예상**: 병렬 작업(초안 저장 엔드포인트)과 `midterm.controller.ts` 한 줄씩,
  그리고 codegen 산출물이 겹친다. 병합 후 `openapi` → `generate` 재실행 필요.
- **응답 봉투**: 기존 2단계 흐름 엔드포인트(open·reassign 등)와 같이 `ApiOkLooseEnvelope`
  (`data: object`)로 발행했다. 형태는 프론트 `api-progress.ts` 인터페이스가 좁힌다.
  타입까지 계약으로 굳히려면 별도 응답 DTO 클래스가 필요한데, 그러면
  `dto/midterm-response.dto.ts` 를 크게 건드려 병렬 작업과의 충돌 면적이 커져 보류했다.
- **경과일 기준**: 전이 시각 컬럼(`firstCommentedAt` 등)이 비어 있는 행(레거시가 개시로 초기화된
  경우 등)은 `updatedAt` 으로 떨어진다. 다른 이유로 행이 갱신되면 경과일이 짧게 보일 수 있다 —
  집계는 참고용이고 정확한 전이 시각은 `MidtermTrail` 에 남는다.
- 스키마 변경 없음(기존 컬럼만 읽음).
