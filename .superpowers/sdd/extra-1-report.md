# extra-1 — 중간점검 수정안 임시저장 (`PUT /midterm/reviews/:id/revision`)

설계 §6 의 미구현 항목("수정안 임시저장(제출 아님)")을 구현했다. 기준 커밋 `4232f95` 위에서 작업.

## 무엇을 만들었나

### 백엔드

- **저장 컬럼** `MidtermReview.revisionDraft`(`Json?` → `midterm_reviews.revision_draft JSONB`).
  기존 행은 손대지 않는 nullable 단일 컬럼 추가.
- **`PUT /midterm/reviews/:id/revision`** — `MidtermController.saveRevisionDraft` →
  `MidtermReviewFlowService.saveRevisionDraft`.
  - `@Roles` 없음. 권한은 서비스가 배정(`evaluateeId`)으로 판정한다 — **피평가자 본인만**.
    1차·2차 검토자는 물론 **HR 대리도 거부**한다(다른 전이와 달리 대신 써 줄 성질의 작업이
    아니고, 대신 써 두면 본인이 화면을 열었을 때 자기가 쓰지 않은 값이 복원돼 그대로 제출된다).
  - 전이가 아니다: `status`·`revisionRound` 를 건드리지 않고, KPI 행을 쓰지 않고,
    이력(`MidtermTrail`)·감사·알림도 남기지 않는다(저장 버튼을 누른 횟수만큼 타임라인이
    오염되면 안 된다). 갱신 데이터는 `{ revisionDraft }` 한 키뿐.
  - 제출과 같은 창을 지킨다: `assertMidReviewStage`(mid_review) + 상태 `commented`·`returned`.
    상태 목록은 `midterm-turn.ts` 의 `MIDTERM_REVISABLE_STATUSES`(= 기존 `ALLOWED_STATUS.revise`)
    를 그대로 재사용해, 저장은 되는데 제출은 안 되는 창이 생기지 않게 했다.
  - 검증은 최소한만: KPI 중복·소유(본인·이번 주기) 확인. **확정(confirmed) 여부·가중치 100%
    는 보지 않는다** — 그건 제출 시점의 규칙이고, 작성 도중에 막으면 정작 저장하려던 작업을 잃는다.
  - 에러 코드: `NOT_FOUND` / `FORBIDDEN` / `VALIDATION_ERROR` /
    `INVALID_STATE_TRANSITION`(수정 단계가 아닐 때) — 허용된 4종만 사용.
- **제출 시 초안 삭제**: `submitRevision` 의 상태 전이 트랜잭션 안에서 `revisionDraft = JsonNull`.
  남겨 두면 다음에 화면을 열 때 이미 제출·반영된 값 위로 옛 초안이 되살아난다.
- **상세 응답에 포함**: `detail(id, viewerId?)` 가 초안을 함께 돌려준다. 단 **viewerId 가
  피평가자 본인일 때만** — 초안은 아직 제출하지 않은 개인 작업본이라 1차·2차 검토자·HR 이
  볼 것은 제출된 결과와 이력뿐이다. viewerId 를 생략한 내부 호출은 안전한 쪽("가리기")으로 동작.

### 웹 (`MemberRevisionPanel`)

- 마운트 시 **진척(progress)과 상세(detail)가 모두 도착한 뒤 한 번만** 폼을 채우고, 저장된
  초안이 있으면 진척 값 **위에 덮어쓴다**(마지막으로 본인이 친 값이 진실). 초안 `items` 는
  "바뀐 필드"만 담으므로 들어 있는 필드만 골라 얹는다. 그 사이 확정이 풀린 KPI 는 복원하지 않는다.
- **명시적 [임시저장] 버튼**을 기존 `EvaluationActionPanel` 의 actions 슬롯에 제출 옆으로 추가.
  키 입력 자동 저장은 넣지 않았다(요구사항 + 이 저장소의 다른 폼과 동일한 명시적 저장 규약).
- 마지막 임시저장 시각 표시 + 미저장 가드 정합: 저장에 성공하면 저장본과 내용이 같아지므로
  **다시 입력하기 전까지 `beforeunload` 경고가 뜨지 않는다**. 이미 저장본이 있는 상태에서
  입력을 되돌린 것도 "미저장"으로 본다(그대로 나가면 서버에 옛 초안이 남는다).
- 기존 동작 보존: 단일 `changedItems` 소스(가드·가중치 규칙·제출 공유), 확정 KPI 만 편집·
  미확정은 읽기 전용, 로딩/오류 상태, 변경 0건 + 회신 사유 제출, 제출 실패 시 입력 유지.

## 저장 형태(왜 이렇게)

```json
{ "items": [{ "kpiId": "…", "targetValue": 1, "targetText": "…", "weight": 30 }],
  "memberNote": "작성 중인 회신 사유",
  "savedAt": "2026-07-23T06:12:00.000Z" }
```

- **제출 페이로드(`SubmitMidtermRevisionDto`)와 같은 모양**이다. 저장한 값을 그대로 폼에
  복원하고 이어서 제출까지 하는 흐름이라, 형태를 따로 두면 복원 시점에 서로 어긋난다.
  덕분에 복원은 "그대로 다시 얹기"이고 변환 코드가 없다.
- `savedAt` 을 별도 컬럼이 아니라 blob 안에 둔 이유: 저장·삭제가 **컬럼 하나의 쓰기**로 끝나
  "초안은 있는데 시각이 없는"(또는 그 반대) 상태가 구조적으로 불가능하다.
- 정규화 테이블 대신 JSON 인 이유: 초안은 조회·집계 대상이 아니고 리뷰 1건당 정확히 1벌이며,
  제출되면 통째로 사라진다. 행으로 쪼개면 수명주기만 복잡해진다.

## 게이트 결과

| 게이트 | 결과 |
|---|---|
| `pnpm -C apps/api test` | **115 passed (13 files)** — 기준 104 → 신규 11 |
| `pnpm exec tsc --noEmit -p apps/api` | 0 errors |
| `pnpm exec tsc --noEmit -p apps/web` | 0 errors |
| `pnpm -C apps/web run build` | 성공 (36 pages) |
| `pnpm -C apps/api run openapi` | 성공 — paths 140 |
| `pnpm -C packages/contracts run generate` + `typecheck` | 성공, 0 errors |

DB 명령은 실행하지 않았다(`prisma migrate` 미실행). `prisma:generate` 만 실행.

## 신규 테스트 (`apps/api/src/modules/midterm/midterm-revision-draft.spec.ts`, 11건)

권한 경계 4 — 1차 평가자 `FORBIDDEN`, 2차 검토자 `FORBIDDEN`, **HR 대리 `FORBIDDEN`**,
없는 리뷰 `NOT_FOUND`(전부 update 미호출 확인).
전이 아님 6 — update 데이터 키가 `revisionDraft` 하나뿐(status·revisionRound 불변),
trail/audit 호출 0회, 응답에 초안 포함, 잘못된 단계 `INVALID_STATE_TRANSITION`,
`returned` 에서는 저장 가능, 남의 KPI `VALIDATION_ERROR`.
가시성 1 — `detail()` 이 검토자에게는 초안을 `null` 로 내보내고 본인에게만 실어 준다.
(mock `revision` 서비스의 `validate`/`apply` 는 호출되면 throw 하도록 두어, 임시저장이
KPI 반영 경로를 타지 않음을 구조적으로 보장한다.)

## 마이그레이션

`apps/api/prisma/migrations/20260723140000_midterm_revision_draft/migration.sql`
(수기 작성, 컬럼 1개 추가 + `COMMENT ON COLUMN`. 기존 행 무변경.)

## 변경 파일

- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260723140000_midterm_revision_draft/migration.sql` (신규)
- `apps/api/src/modules/midterm/midterm.controller.ts`, `midterm-review-flow.service.ts`,
  `midterm-turn.ts`, `dto/midterm-flow.dto.ts`, `midterm-revision-draft.spec.ts` (신규)
- `packages/contracts/openapi.json` + `src/generated/**` (재생성)
- `apps/web/lib/types.ts`, `features/eval-midterm/api.ts`,
  `features/eval-midterm/ui/MemberRevisionPanel.tsx`

## 우려·후속

1. **동시 편집(두 탭)** — 마지막 저장이 이긴다. 초안은 본인 1인 소유이고 리뷰당 1벌이라
   낙관적 잠금은 넣지 않았다(YAGNI). 필요해지면 `savedAt` 을 If-Match 로 쓸 수 있다.
2. **초안 가시성을 본인 한정으로 좁힌 것은 명세에 없던 판단**이다. 명세는 "상세에 실어 달라"만
   요구했지만 "개인 작업본"이라는 근거가 함께 주어졌기에, 검토자·HR 응답에서는 `null` 로
   가렸다. 화면 동작에는 영향이 없다(복원하는 쪽은 본인뿐). 되돌리려면 `detail()` 한 줄.
3. **`revisionDraft` 는 `Prisma.JsonNull` 로 비운다** — 기존 `reviewTrail` 초기화와 같은 방식.
   SQL NULL(`DbNull`) 이 아니라 JSON null 이 들어가지만, 읽는 쪽은 둘 다 `null` 이라 동작 동일.
4. **파일 길이** — `midterm-review-flow.service.ts` 가 이미 아키텍처 기준(~200줄)을 넘은 상태에서
   약 130줄 더 늘었다. 초안 저장은 `submitRevision` 의 초안 삭제·`detail()` 의 가시성 규칙과
   한 몸이라 분리하면 오히려 규칙이 흩어져 같은 파일에 두었다. 이 모듈 전체 분할은 별도 작업.
5. **병렬 작업 충돌 예상 지점** — `midterm.controller.ts`(라우트 1개 추가)와 재생성된
   OpenAPI/orval 산출물. 병합 시 컨트롤러 충돌 해소 후 codegen 1회 재실행 필요.
