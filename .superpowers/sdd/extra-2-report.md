# extra-2 — 중간점검 검토자 큐: 상태 필터 + 제출 후 자동 이동

설계 §7.1 의 미구현 항목 2건(상태 필터 · 제출 후 다음 미제출 대상 자동 이동)을
`ReviewerQueue` 에 구현했다. 백엔드·계약·타입 변경 없음(웹 전용).

## 구현한 것

### 1. 상태 필터 (전체 / 내 차례 / 진행 중 / 완료)

- 좌측 목록 위에 공용 `FilterChipBar` 단일선택 칩 — 부서장 평가(`DeptHeadEvalView`)·
  역량평가(`CompetencyEvalView`)와 동일한 배치(칩 바 → 목록 패널, `space-y-2.5 self-start`).
- **내 차례** = `isReviewerTurn(review, meId)` — `pending` + `firstReviewerId === meId`
  또는 `revised` + `finalReviewerId === meId`. **배정 필드만** 본다(`user.role` 미사용).
  패널 라우팅(`panelFor`)의 조건과 문자 그대로 동일하게 두어, 필터로 고른 건이 자기 자리와
  다른 쓰기 패널로 열리는 경로가 생길 수 없다.
- **완료** = `closed`(현행) + `confirmed`(레거시 아카이브 행). **진행 중** = 완료도 아니고
  내 차례도 아닌 건(= 다른 사람 처리 대기). 세 갈래가 서로 겹치지 않아 같은 건이 두 번 세지지 않는다.
- **내 차례 칩에 건수 표시**(`FilterChipOption.count`, `tabular-nums`) — 필터를 걸지 않아도
  검토자가 자기 업무량을 본다.
- 필터 상태는 화면-로컬 `useState` — URL·localStorage 에 남기지 않는다(요구사항).
- 빈 목록 문구를 상황별로 분기: 검색 중 → "검색 결과가 없어요.",
  내 차례 필터 → "지금 내 차례인 점검이 없어요.", 그 밖 → "해당하는 구성원이 없어요."

### 2. 액션 성공 후 자동 이동 + 대기열 소진 표시

- `handlePanelDone`(코멘트 제출·승인·반려 성공 시 패널이 호출)에서 현재 건 **다음 위치부터
  순환 탐색**해 `isReviewerTurn` 을 통과하는 다음 대상으로 이동(`DeptHeadEvalView.confirmSubmit`
  ·`CompetencyEvalView.advanceToNext` 와 동일한 순환 탐색 관용구).
- 방금 처리한 건은 목록 재조회 전이라 `rows` 에 **아직 이전 상태(= 내 차례)로 남아 있어**
  후보에서 명시적으로 제외한다(`r.id !== current.id`). 제외하지 않으면 제자리를 맴돈다.
- 이동/소진 모두 토스트로 알린다: "처리했어요. 다음 대상(이름)으로 이동했어요." /
  "처리했어요. 지금 내 차례인 점검이 모두 끝났어요."
- 토스트는 사라지므로 **대기열이 비었다는 사실은 목록 위 상시 안내로도** 남긴다 —
  `myTurnCount === 0` 일 때 "지금 내 차례인 점검이 없어요 — 처리할 건이 생기면 여기에 표시돼요."
  (내 차례 칩의 `0` 과 함께 이중으로 읽힌다.)

## `EvaluationSubjectPanel` 재사용 여부 — 재사용했다

이 화면은 **이미** `EvaluationSubjectPanel` 을 쓰고 있었고 그대로 유지했다. 필터 칩은 이
컴포넌트의 책임 밖(두 레퍼런스 화면도 칩 바를 패널 **바깥 위쪽**에 둔다)이라, 공용 컴포넌트를
건드리지 않고 동일한 배치로 감쌌다. 자동 이동도 레퍼런스와 같은 관용구를 그대로 따랐다.
즉 상호작용 규약을 새로 만든 곳은 없다.

## 파일 상한(architecture.md ~200줄) 대응

필터·목록 파생을 `ReviewerQueue` 안에 두면 234줄이 되어, 좌측 레일을 **표시 전용** 형제
컴포넌트 `ReviewerQueueList.tsx`(91줄)로 분리했다. 선택은 "요청"으로 상위에 올려보내
(`onSelect={requestSelect}`) 미저장 가드가 계속 `ReviewerQueue` 한 곳에만 있게 했다.

## 변경 파일

- `apps/web/features/eval-midterm/ui/ReviewerQueue.tsx` (수정, 165 → 187줄)
- `apps/web/features/eval-midterm/ui/ReviewerQueueList.tsx` (신규, 91줄)
- `apps/web/features/eval-midterm/ui/midtermFlowHelpers.tsx` (수정, +41줄 —
  `ReviewerQueueFilter` · `isReviewerTurn` · `matchesQueueFilter`)

범위 밖 파일(`MidtermView` · `MemberRevisionPanel` · `FirstReviewPanel` · `FinalReviewPanel` ·
`lib/types.ts` · `apps/api` · `packages/contracts`)은 **읽기만** 했고 수정하지 않았다.
`git status` = 위 3개 파일뿐.

## 게이트 결과

```
$ pnpm exec tsc --noEmit -p apps/web
(출력 없음 — 오류 0건)

$ pnpm -C apps/web run build
✓ Compiled successfully
✓ Generating static pages (36/36)
├ ○ /eval/midterm                        16.7 kB         193 kB
```

(이 워크트리에는 `node_modules` 가 없어 `pnpm install --frozen-lockfile --ignore-scripts`
를 먼저 수행했다. 커밋에는 포함되지 않는다.)

## 미저장 가드 검증(코드 경로 추적)

프리뷰 검증 금지 정책(memory: no-preview-verification)에 따라 실기동 대신 상태 전이 경로를
따라 검증했다. 근거:

1. **수동 전환은 그대로 막힌다.** 목록 항목의 `onSelect` 는 `ReviewerQueueList` 를 거쳐
   여전히 `requestSelect(id)` 로만 들어온다(`onSelect={requestSelect}`). `requestSelect` 는
   `dirty && id !== selected?.id` 이면 `setPendingId` 만 하고 즉시 반환 — 확인 모달 경로가
   손대지 않은 채 그대로다. 필터·검색은 `items` 배열만 좁힐 뿐 `selected` 를 바꾸지 않으므로
   (선택 상태는 필터가 아니라 `selectedId`/`rows[0]` 폴백에서 나온다 — `DeptHeadEvalView` 의
   `activeEval` 과 동일), **필터를 바꿔도 패널이 갈아치워져 입력이 날아가는 일이 없다.**
   이 때문에 `selected` 를 "필터된 첫 항목"으로 바꾸고 싶은 유혹을 의도적으로 피했다.
2. **자동 이동에서는 가드가 뜨지 않는다.** `handlePanelDone` 은 `requestSelect` 가 아니라
   `selectNow`(무조건 전환)를 호출하고, 그 직전에 `setDirty(false)` 를 한다. 두 호출이 같은
   이벤트 핸들러 안이라 배치되어, 모달을 여는 유일한 경로(`requestSelect`)를 아예 지나지 않는다.
3. **자동 이동 후 dirty 가 되살아나지 않는다.** 이동 시 `selectedId` 와 `refreshKey` 가 모두
   바뀌어 패널 `key` 가 달라지므로 새 패널이 마운트되고, `FirstReviewPanel`/`FinalReviewPanel`
   의 `onDirtyChange` effect 가 새 입력값 기준으로 다시 통지한다(빈 입력 → `false`).
   `handlePanelDone` 의 `setDirty(false)` 와 방향이 같다.
4. **라우팅 불변.** `panelFor` 는 한 글자도 바꾸지 않았다(`isMidReview` + 배정 + 상태).
   자동 이동 후보 판정(`isReviewerTurn`)이 그 조건의 부분집합이라, 1차 검토자가 판정 패널에,
   2차 검토자가 코멘트 패널에 도달하는 조합은 만들어지지 않는다. 쓰기 패널은 여전히
   `isMidReview` 에서만 렌더된다.

## 남는 우려

1. **`isReviewerTurn` 에 `isMidReview` 를 넣지 않았다.** 사양 문구("`pending` when the viewer
   is the 1st reviewer, `revised` when the viewer is the 2nd reviewer")를 그대로 따랐다.
   중간점검 기간 밖에서는 화면 전체가 읽기 전용이라 "내 차례 n건" 칩이 뜨지만 눌러도 읽기 전용
   패널이 열린다(기간 안내 배너는 `MidtermView` 상단에 이미 있다). 기간 밖에서 0으로 보이는
   편이 낫다는 판단이면 한 줄로 바꿀 수 있다.
2. **레거시(이전 방식) 행의 분류.** `self_done` · `revision_requested` · `rejected` 는 현행
   흐름에 정의가 없어 "진행 중"으로 떨어진다(`confirmed` 만 완료로 넣었다). 아카이브 행이라
   실무 영향은 작다고 봤으나, `rejected` 를 완료로 볼지는 정책 판단이 필요하면 바꿀 수 있다.
3. **필터가 걸린 상태에서 자동 이동**하면 다음 대상이 현재 필터(예: "완료")에 안 잡혀 목록에서
   강조되지 않을 수 있다. 자동 이동은 필터가 아니라 "내 차례" 전체를 훑는 편이 사양에 맞다고
   보아 그대로 뒀다(부서장 평가도 같은 동작).

---

## 후속 수정 (Fable5 적대 검토 지적 반영, 2026-07-23)

검토자가 **우려 #1 을 실제 결함으로 확정**했다(#2·#3 은 비이슈 판정 — 레거시 행은 검토자 id 를
갖지 않아 이 화면에 오지 않고, 자동 이동 범위는 두 레퍼런스 화면과 동일). 중간점검 기간이
지났는데 미처리 `pending`/`revised` 행이 남아 있는 상태(대기열은 저절로 비지 않는다)에서
화면이 자기모순에 빠졌다: 칩은 "내 차례 N", 상시 안내는 `myTurnCount !== 0` 이라 숨겨지고,
정작 그 행을 누르면 읽기 전용 패널이 1차 검토자에게 "1차 검토자(부서장)의 코멘트를 기다리고
있어요"라고 말한다 — 처리할 게 N건 있다고 주장하면서 처리할 방법을 주지 않는다.

### 수정 내용

1. **기간(`isMidReview`)을 "내 차례" 판정에 편입.** `isReviewerTurn(review, meId, isMidReview)`
   가 기간 밖이면 무조건 `false`("지금 처리할 수 있는가"라는 사양 정의에 기간이 포함된다).
   파생 효과 ①칩 건수가 기간 밖에서 0 ②대기열 소진 상시 안내가 다시 보임 ③`mine` 필터가 비고,
   미처리 행은 `inprog`(진행 중)로 모여 상태가 있는 그대로 보인다.
   `matchesQueueFilter` 도 같은 인자를 받아 세 갈래가 계속 서로 겹치지 않는다. 상시 안내 문구도
   기간 밖에서는 "지금은 중간점검 기간이 아니라 처리할 점검이 없어요 — 진행 상황만 볼 수
   있어요."로 바뀐다.
   `panelFor`(라우팅)와 자동 이동 로직은 변경 없음 — 자동 이동은 쓰기 패널의 액션 성공에서만
   발화하고 쓰기 패널은 이미 `mid_review` 에서만 렌더되므로, 호출부에 `isMidReview` 를 그대로
   넘겨 판정 조건을 한 함수로 통일하기만 했다.
2. **빈 목록 사유 판정 순서 정정.** 검색어보다 **필터를 먼저** 본다. `matched`(필터 결과)가
   비었으면 원인은 필터이므로 "검색 결과가 없어요" 를 쓰지 않는다.
3. **같은 문장 이중 노출 제거.** `mine` 0건일 때 상단 상시 안내가 이미 "내 차례인 점검이
   없어요"를 말하므로, 목록 안 문구는 다음 행동 안내("전체 필터에서 다른 구성원의 진행 상황을
   볼 수 있어요.")로 바꿨다.

### 게이트 (재실행)

```
$ pnpm exec tsc --noEmit -p apps/web
(출력 없음 — 오류 0건)

$ pnpm -C apps/web run build
✓ Compiled successfully
✓ Generating static pages (36/36)
├ ○ /eval/midterm                        16.7 kB         193 kB
```

### 변경 파일 (후속)

- `apps/web/features/eval-midterm/ui/midtermFlowHelpers.tsx` — `isReviewerTurn` ·
  `matchesQueueFilter` 에 `isMidReview` 인자 추가
- `apps/web/features/eval-midterm/ui/ReviewerQueueList.tsx` — `isMidReview` prop, 건수·필터
  전달, 빈 문구 판정 순서·중복 제거, 기간 밖 안내 문구
- `apps/web/features/eval-midterm/ui/ReviewerQueue.tsx` — prop 전달, 자동 이동 판정 인자
