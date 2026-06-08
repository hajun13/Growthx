# 프론트엔드 구현 노트 — 6월 중간평가 · 피드백 보완 조치 (설계 ①②③)

> 작성 2026-06-08 · frontend-engineer · 범위 ①②③ (④ 목표 재조정 제외)
> 데이터 SSOT = `_workspace/02_contract/contract-midterm.md`. 백엔드 실구현(midterm/action-items 모듈)과 대조 완료.

## 1. 신규/변경 파일

### 신규 — 타입·훅
- `apps/web/lib/types.ts` (추가) — 계약 1:1 타입: `ProgressSignal`·`ProgressTrend`·`KpiProgress`·`OrgProgress`·`MidtermProgress`·`MidtermReviewStatus`·`MidtermReview`·`ActionItemStatus`·`ActionItem` + 요청 페이로드(Submit/Confirm/Create/Update/Transition).
- `apps/web/lib/ui.ts` (추가) — `progressSignalLabel`·`actionItemStatusLabel` 한글 매핑.
- `apps/web/hooks/useMidterm.ts` (신규) — `useMidtermProgress`(단건)·`useMidtermReviews`(목록)·`useActionItems`(목록) + `midtermReviewCommands`(submitSelf/confirm)·`actionItemCommands`(create/update/transition). 전부 기존 `apiGet`/`apiGetList`/`apiPost`/`apiPatch` 봉투 unwrap 재사용.

### 신규 — 컴포넌트 (component-spec 7+2)
- `MidtermSignalBadge.tsx` — 신호 배지(순항/주의/위험). 사각·색+라벨·dot·aria-label.
- `TrendIndicator.tsx` — 추세(▲▼–). 백엔드 enum `trend`만 받으므로 enum 기반 표시 + (delta 옵션 지원). tabular-nums·aria.
- `ActionItemStatusBadge.tsx` — 계획/진행중/완료/취소.
- `MidtermProgressTable.tsx` — KPI 진척 표(self/review/result variant). measureType별 셀, 정성 칩, 빈/정성 안내, 반응형 가로 스크롤.
- `ActionItemRow.tsx` — assignee/owner/readonly 모드. 상태 토글은 계약 §4 전이표를 프론트에서 미리 강제(허용 전이만 클릭), assignee는 canceled 비활성+툴팁, done 시 완료 메모, 마감 경과 표시.
- `ActionItemFormModal.tsx` — Modal+TextField+UserCombobox+Select 조립. 제목·담당·마감 필수 검증, 연결 KPI "연결 안 함" 옵션, 편집/등록 겸용.
- `MidtermResultSummary.tsx` — RES 블록① 조립(비구속 배너 + 다크요약 "점검중" 플레이스홀더 + 진척 요약 + 부서장 피드백).
- `MidtermActionPanel.tsx` — FIN 블록③ 조립(참고용 칩 + info 배너 + readonly 행 + 상태별 카운트 요약).

### 신규 — 페이지
- `app/(main)/eval/midterm/page.tsx` — 역할 인지 셸. cycle.status로 mid_review 여부 판정, 비구속 배너/읽기전용 분기. 역할별 본문 합성.
- `app/(main)/eval/midterm/EmployeeMidterm.tsx` — C-1(내 KPI 진척 + ProgressDonut + 자가점검 제출 + 내 보완조치 상태 갱신).
- `app/(main)/eval/midterm/DeptHeadMidterm.tsx` — C-2(구성원 리스트 → 진척/자가점검 표시 + 부서장 확인(코멘트 필수) + 보완조치 등록·편집·상태관리). 모바일 list↔panel 토글.
- `app/(main)/eval/midterm/OrgProgressCard.tsx` — C-3(MidtermProgress.org 재사용 → MonthlyTrendChart + 요약 통계 + 카테고리 표).

### 변경
- `app/(main)/eval/result/[userId]/page.tsx` — 보고 있는 주기의 status로 선분기.
  - **mid_review** → `useResultDetail`을 cycleId=null로 비활성(게이팅 회피, 수치 fetch 안 함) + `MidtermResultSummary` 렌더.
  - **calibration/closed** → 기존 결과 하단에 `MidtermActionPanel` 추가(본인이면 빈 상태도 노출, 타인은 데이터 있을 때만).
- `app/(main)/eval/page.tsx` — 허브 카드 분기. cycle.status==='mid_review'면 ① 캘린더 mid_review 카드 카피·CTA·route를 "중간 점검하기"→`/eval/midterm`로, ② "내 할 일" 본인평가 카드 → "중간 점검" 카드, ③ 부서장에게 "부서장 중간 확인" 카드 추가. 그 외 단계는 기존 동작 유지.

## 2. 계약 vs 디자인 스펙 불일치 — 처리 내역 (계약 우선)

| # | 불일치 | 디자인 스펙 | 계약/백엔드 | 처리 |
|---|--------|------------|------------|------|
| 1 | 신호 enum | `MidtermSignal = on_track\|caution\|at_risk` | `ProgressSignal = on_track\|at_risk\|off_track` | **계약 채택**. 라벨 순항/주의/위험 동일하게 유지(색 토큰도 success/warning/danger 그대로). |
| 2 | 대상 식별자 | ActionItem.`userId` | `evaluateeId` (+ `evaluateeName`) | **계약 채택**. 컴포넌트·훅 모두 evaluateeId. |
| 3 | 진척 엔티티 | `MidtermProgressItem` (currentValue/achievementRate/prevRate/trendDelta) | `KpiProgress` (cumulativeActual/cumulativeRate/trend(enum)/quarters) | **계약 채택**. 추세는 백엔드가 enum `trend`만 제공(델타 수치 없음) → TrendIndicator를 enum 기반으로 구현(delta 옵션은 미래 확장 대비 유지). |
| 4 | 자가점검/확인 경로 | `POST /midterm/self-check`·`/midterm/confirm` (A4) | `POST /midterm/reviews`(upsert)·`PATCH /midterm/reviews/:id/confirm` | **계약 채택**. confirm은 review.id 필요 → 부서장 화면은 reviews 목록에서 해당 evaluatee review.id를 찾아 호출. |
| 5 | dueDate nullable | 스펙 `dueDate: string`(필수) | 백엔드 toDto `r.dueDate`(Prisma nullable) → `string\|null` | **계약/백엔드 채택**(nullable). ActionItemRow·패널 모두 null 안전 처리. |
| 6 | 진척 trend 키 | trend/delta 분리 | `trend` enum + `quarters[]` | quarters 길이로 "입력 완료율"(ProgressDonut) 산출, trend는 그대로 표시. |

## 3. 가정·결정 (계약 모호 지점)

- **G1 (단계≠mid_review):** 중간 점검 화면은 다른 단계에서 **읽기전용**(진척 조회만, 입력·등록·확인 버튼 숨김). `readOnly` prop으로 전 컴포넌트 전파.
- **G2/A8 (부서장 구성원 목록):** C-2 구성원 = `useEvaluations(type='downward', evaluatorId=본인)` 대상 = downward 평가 대상과 동일 범위. (별도 구성원 API 없음 — 계약 가정과 일치.)
- **G3 (mid_review 수치 회피):** 결과 페이지는 `cycle.status`로 **선분기**해 mid_review에서 `/results/:id`를 호출하지 않음(400 게이팅 회피). cycleId=null로 훅 비활성화.
- **G4 (FIN 빈 패널):** 본인 결과면 `showWhenEmpty=true`(빈 상태 카드), 타인이면 items 0일 때 패널 미렌더.
- **G5 (hr_admin):** C-2 등록 권한 없음(백엔드도 상위 장만 허용) → hr_admin은 조직 진척(C-3)만. employee 블록도 hr_admin엔 비표시(자기 KPI 평가 맥락 아님).
- **부서장 본인 KPI:** 페이지는 hr_admin 외 전 역할에 `EmployeeMidterm`(C-1) 노출 → 팀장/본부장도 본인 KPI 진척·자가점검 가능(가시성 매트릭스 G표 ✓와 일치). 본인 KPI 0건이면 표는 빈 상태로 graceful.
- **조직 진척 범위 셀렉터:** 와이어프레임의 ScopeSelect(group/division)는 백엔드 progress.org가 사용자 소속 그룹으로 자동 스코프 → 셀렉터 미구현, 그룹명 캡션으로 대체(추측 파라미터 전송 금지).

## 4. 경계면 규율 준수

- 응답은 전부 봉투에서 unwrap: 단건 `apiGet`(MidtermProgress), 목록 `apiGetList`(reviews/action-items, `{data,meta}`). 배열 가정 없음.
- 프론트 타입 camelCase로 백엔드 toDto와 1:1. 추측 캐스트 없음(`targetsToUsers`만 UserCombobox 후보용 최소 User 합성 — 외부 응답 캐스팅 아님).
- 모든 라우팅은 실재 경로: `/eval/midterm`(신규 page.tsx), `/eval/self`·`/eval/dept-head`·`/eval/result/[userId]`(기존). route group `(main)`은 URL에서 제거됨 확인.
- 계산 표시만: 달성률·신호·추세·등급 전부 백엔드 산정값. FIN 패널 이행 카운트만 표시용 집계(등급 미반영).

## 5. 검증
- `npm run typecheck` (tsc --noEmit) — **통과**.
- `npm run build` (next build) — **통과**. `/eval/midterm` 라우트 정상 생성, `/eval/result/[userId]` 갱신 반영.

## 6. 미구현/후속
- 와이어프레임 ScopeSelect(C-3 범위 토글)는 계약 미지원으로 보류 — 백엔드가 progress.org에 범위 파라미터를 추가하면 연동.
- TrendIndicator delta 수치 표기는 백엔드가 trendDelta를 제공하면 활성(현재 enum 방향만).
- ④ 목표 재조정(re-baseline)은 본 노트 §④에서 구현 완료(아래).

---

# ④ 중간 KPI 목표 재조정(re-baseline) + 변경 이력 〔append · 2026-06-08〕

> 범위 = 설계 ④. 데이터 SSOT = `contract-midterm.md` **§7**(백엔드 실구현 계약). 디자이너 가정(`wireframes/component-spec ④`)과 충돌 시 계약 우선으로 처리.

## ④-1. 신규/변경 파일

### 신규 — 타입·훅
- `apps/web/lib/types.ts` (추가) — 계약 §7 1:1 타입: `RebaselineField`·`RebaselineFieldChange`·`RebaselineKpiChange`·`RebaselineKpi`·`RebaselineRequest`·`RebaselineResult`·`RebaselineHistoryEntry`. camelCase 1:1, 추측 캐스팅 없음.
- `apps/web/hooks/useMidterm.ts` (추가) — `useRebaselineHistory`(목록 봉투, `GET /midterm/rebaseline/history`) + `rebaselineCommands.apply`(`POST /midterm/rebaseline`, 단건 봉투). 기존 `apiGetList`/`apiPost` 재사용.

### 신규 — 컴포넌트(component-spec ④ 6종)
- `components/RebaselineChangedCell.tsx` — 변경 셀 강조(좌 3px primary 바 + primary-50 bg + 우상단 점, `aria-label="변경됨"`+`data-changed`).
- `components/WeightSummaryBar.tsx` — 가중치 합/정성 검증 표시. 합=100 하드(인라인 danger), 정성≤30 소프트(warning). `compact` 모드(저장 바). `role=status aria-live`.
- `components/RebaselineDiffRow.tsx` — diff 한 줄(`before →(primary) after`). 측정방식별 값 포맷(`fmtAmount`/`fmtPercent`/건). 색=primary-600(after)/neutral-500(before), 등급색 분리.
- `components/RebaselineHistoryItem.tsx` — 이력 1건(시각·변경자·사유 + diff). `<button aria-expanded>` 접힘/펼침, "되돌릴 수 없음" 칩.
- `components/RebaselineHistory.tsx` — 이력 패널(조립). `useRebaselineHistory` 소비. userId 없음/0건/로딩/에러(조용한 폴백+재시도) 처리.
- `components/RebaselineTable.tsx` — 편집 표 + `RebaselineRow` 타입·`isRowChanged` 헬퍼 export. 정량=숫자 input(단위 suffix·억 미리보기), 정성=Textarea(targetText). 변경 행만 사유 활성. readOnly 지원.

### 신규 — 라우트
- `app/(main)/admin/midterm/rebaseline/page.tsx` — 디자이너 권장 진입점. 피평가자 선택(UserCombobox) → 편집 표 + WeightSummaryBar + 전체 사유 + sticky 저장 바 + ConfirmDialog(Modal) + 우측 이력 패널. role/단계 가드.

### 변경
- `app/(main)/admin/cycle/page.tsx` — 재오픈 사유 모달 본문에 보조 링크 "KPI 목표를 조정하려면 → 목표 재조정 화면"(`/admin/midterm/rebaseline`) 추가. (한 모달에 합치지 않음 — 디자이너 권고 분리.)
- `lib/nav.ts` — nav 항목 `midterm-rebaseline`(인사평가 그룹, roles hr_admin·division_head·team_lead) + `activeKeyForPath` 매핑 추가.

## ④-2. 계약 ↔ 디자인 불일치 처리내역 (계약 우선)

| 디자이너 가정(wireframe/spec ④) | 백엔드 실제 계약(§7) | 처리 |
|---|---|---|
| `PATCH /midterm/rebaseline` 단건/일괄(`changes[]`) | **`POST /midterm/rebaseline` 일괄**(`items[]`) | 계약대로 `apiPost` + `items`. `targetValue?/targetText?/weight?` undefined=변경 안 함 의미 그대로 — 변경된 필드만 전송. |
| 이력 = 제네릭 `useKpiSnapshots`+`useKpiSnapshotDiff`, 메타에 reason/createdBy **보강 필요**(A④-2) | **전용 `GET /midterm/rebaseline/history`** 가 diff+reason+createdBy+createdAt 직접 반환 | 제네릭 스냅샷 훅 **사용 안 함**. `useRebaselineHistory` 신설. 메타 보강 가정 불필요(엔드포인트가 이미 포함). 지연 diff 로드도 불필요(`entry.changed` 즉시 렌더). |
| 행별 사유(`lineReason`) 백엔드 지원 가정(V4) | 계약 §7 `items[]`에 lineReason **없음**(전체 `reason`만) | 행별 사유 입력칸은 **UX 보조**로 표시(변경 행 식별·메모)하되 전송 페이로드엔 미포함. 하드 필수는 전체 `reason`(V3)만. lineReason은 백엔드 미전송. |
| 정성 ≤30 검증 강도 | 계약 §7: 합=100 하드 / 정성캡은 옵트인 | 정성≤30은 **소프트(경고만, 저장 허용)** — 기존 KPI 정책과 일관. |
| 응답 노옵 처리 미명시 | `snapshotId:null`·`changed:[]`(변경 없음) | 노옵 응답이면 info 토스트("변경된 내용이 없어 저장하지 않았어요"). 단 프론트는 V5(변경 0건)로 저장 자체를 disable. |

## ④-3. 단계·권한·검증 가드

- **단계 게이팅:** `cycle.status === 'mid_review'` 에서만 편집. 그 외 → InfoBanner(info) "중간 점검 단계에서만…" + 표/사유/저장 readOnly·disabled, **이력은 항상 조회**. 프론트가 선분기해 400 호출 회피(저장 시 백엔드도 400 방어).
- **RBAC:** `hr_admin`(전체 활성 사용자 후보) + 부서장(`canEvaluateDownward && !hr_admin`, downward 평가 대상만 후보). employee → `Forbidden`. 기존 `isHrAdmin`/`canEvaluateDownward` 가드 재사용.
- **저장 검증(④-D, 프론트 즉시 + 백엔드 최종):** V1 합=100 하드, V3 전체 사유 필수 하드, V5 변경 0건 하드, V7 정량 목표≥0 하드 → 미충족 시 저장 버튼 disabled + 사유 툴팁. V2 정성≤30 소프트(경고).

## ④-4. 경계면 규율 준수

- 봉투 unwrap: 단건 `apiPost`→`RebaselineResult`(`res.data`), 목록 `apiGetList`→`RebaselineHistoryEntry[]`(`res.data`+`meta`). 배열 가정 없음.
- 타입 camelCase로 §7 응답과 1:1. `RebaselineRow`는 프론트 로컬 편집 상태(계약 타입 아님)로 분리 명시.
- 라우팅 실재 경로: `/admin/midterm/rebaseline`(신규 page, route group `(main)` URL 제거 확인), `/admin/cycle` 링크. 빌드 시 `/admin/midterm/rebaseline` 라우트 생성 확인(9.84 kB).
- 계산 표시만: diff·갱신 KPI는 백엔드 응답 표시. 가중치 합/정성 합은 **프론트 즉시 피드백용 합산**(저장 차단은 표시, 최종 검증은 백엔드 400).
- 토큰: 사각(radius 0), primary `#3182f6`/`#1b64da`, 변경 강조 `#EBF3FE`, 색+텍스트 병기.

## ④-5. 검증
- `npm run typecheck` (tsc --noEmit) — **통과**.
- `npm run build` (next build) — **통과**. `/admin/midterm/rebaseline` 정적 라우트 생성.

## ④-6. 미구현/가정
- **행별 사유(lineReason) 전송 보류:** 계약 §7 `items[]`에 필드 없음 → UI 보조 표시만, 페이로드 미포함. 백엔드가 행별 사유를 추가하면 `RebaselineRequest.items[].lineReason`로 정렬(타입·전송 한 줄 추가).
- **저장 후 이력 갱신:** `RebaselineHistory`를 nonce 키로 remount해 재조회(낙관적 항목 삽입 대신 단순 재조회 — 응답에 history entry shape 미포함이라 서버 truth 재조회가 안전).
- **rowErrors(셀 단위 에러):** 훅·prop은 배선했으나 현재 백엔드 400은 전체 사유/합 위주 → 채워 넣지 않음(서버가 details로 kpiId별 에러 주면 매핑 가능).
- **measureType per diff:** 이력 diff의 목표값 단위는 `measureTypeByKpiId` 맵 주입 시에만 정밀 표기(현재 page에서 history엔 미주입 → 목표값은 thousands-separator plain 표기, 가중치는 % 정확). 필요 시 갱신 KPI(`RebaselineResult.kpis`)에서 맵을 만들어 주입하면 정밀화됨.

---

# ⑤ 재조정 워크플로우 전환 + 중간평가 UX 재구성 〔append · 2026-06-08〕

> 범위: 재조정 즉시-적용 → **본인 제안·부서장 검토·승인 반영** 워크플로우 전환 + 중간평가 전체 UX 개선.
> SSOT = `contract-midterm.md §7 재설계 2026-06-08`. 상태값: `submitted|approved|rejected`.

## ⑤-1. 변경/신규 파일

### 타입 (`lib/types.ts` 추가)
- `RebaselineRequestStatus` — `'submitted'|'approved'|'rejected'`
- `RebaselineItem`, `RebaselineCurrentKpi`, `RebaselineProposedChange`
- `RebaselineRequestView` — 목록 shape (id·cycleId·evaluateeId·evaluateeName·reason·status·itemCount·reviewer*·reviewComment·reviewedAt·appliedSnapshotId·createdAt·updatedAt)
- `RebaselineRequestDetail extends RebaselineRequestView` — 상세 shape (items·currentKpis·proposedChanges·projectedWeightSum·weightValid)
- `CreateRebaselineRequestBody`, `UpdateRebaselineRequestBody`, `ReviewRebaselineRequestBody`

### 훅 (`hooks/useMidterm.ts` 재작성)
- 구 `rebaselineCommands.apply`(`POST /midterm/rebaseline`) **제거**
- 신규: `useRebaselineRequests`(목록, forReview=true 부서장 큐 지원)
- 신규: `useRebaselineRequestDetail`(상세, proposedChanges·weightValid 포함)
- 신규: `rebaselineRequestCommands.create/update/review`
- `useRebaselineHistory` 유지(승인 반영 이력, 변경자=부서장)

### 신규 컴포넌트
- `components/RebaselineStatusBadge.tsx` — submitted(검토대기·회색/파랑)/approved(반영완료·초록)/rejected(반려·빨강). 기존 StatusBadge 패턴 재사용.

### 신규 페이지 컴포넌트
- `app/(main)/eval/midterm/RebaselineRequestSection.tsx` — **본인 제안 섹션**. 흐름: confirmed KPI 로드 → RebaselineTable(편집) + 사유 + WeightSummaryBar → 제출 확인 모달. 반려 시 반려 코멘트 표시 + 수정·재제출. 승인 시 읽기전용 결과. 이력 패널(RebaselineHistory) 통합. 미결 1건 중복 시 안내 토스트.
- `app/(main)/eval/midterm/RebaselineReviewQueue.tsx` — **부서장 검토 큐**. kpi/review 패턴(좌 목록·우 상세 + 모달) 완전 재사용. forReview=true 목록 → 상세(proposedChanges·currentKpis·weightValid·가중치 경고) → 승인/반려 모달(comment 선택). 승인 시 weightValid 검증 표시 및 버튼 disabled.

### 변경
- `app/(main)/eval/midterm/EmployeeMidterm.tsx` — 하단에 `<RebaselineRequestSection>` 통합 (본인 제안 흐름).
- `app/(main)/eval/midterm/DeptHeadMidterm.tsx` — `<RebaselineReviewQueue>` Fragment 형제 노드로 추가 (검토 큐 통합).
- `app/(main)/admin/midterm/rebaseline/page.tsx` — **폐기 → `redirect('/eval/midterm')`** (구 즉시-적용 페이지 제거).
- `lib/nav.ts` — `midterm-rebaseline` 항목을 `midterm`(→`/eval/midterm`, 전 역할)으로 교체. `activeKeyForPath` 매핑 갱신.

## ⑤-2. 재사용 컴포넌트 (새 UI 발명 없음)
| 재사용 | 원본 | 변형 |
|--------|------|------|
| 부서장 검토 큐 패턴 (좌목록+우상세+모달) | `kpi/review/page.tsx` | 그대로 |
| 현재 vs 제안 diff 표 | `RebaselineTable.tsx` | readOnly=true / readOnly=false 모두 |
| 가중치 합 표시 | `WeightSummaryBar.tsx` | compact + 전체 모드 |
| 상태 배지 패턴 | `StatusBadge.tsx` + `kpiStatusStyle` | `RebaselineStatusBadge`로 분리 신규 |
| 반려 코멘트 | `ReviewHistory` kpi/review 내 | 동일 UI 패턴(borderLeft+bg) |
| 이력 패널 | `RebaselineHistory.tsx` | 그대로(승인 시 스냅샷 캡처됨) |

## ⑤-3. 계약 준수 사항
- 상태값: `submitted`(검토대기) / `approved`(반영완료) / `rejected`(반려) — `pending_review` 등 추측 값 없음.
- `evaluateeId` body 불포함(서버 강제). `forReview=true` 쿼리로 부서장 큐 정확 분리.
- `proposedChanges`·`currentKpis`·`projectedWeightSum`·`weightValid` — 상세 응답에서 직접 표시. 프론트 재계산 없음.
- 미결 1건 제약: `POST 400` 발생 시 안내 토스트로 처리.

## ⑤-4. 검증
- `npm run typecheck` — **통과 (0 errors)**
- `npm run build` — **통과**. `/admin/midterm/rebaseline` 147B(리다이렉트), `/eval/midterm` 15.3kB 정상 빌드.

## ④-7. QA 결함 수정 〔append · 2026-06-08 · qa-report-midterm.md ④〕
> 리더 확정: MAJOR-1 = 백엔드에서 가중치 검증 모집단을 confirmed 로 통일 → 프론트 무변경(이미 confirmed 만 로드). MINOR-1·MINOR-3 = 프론트 수정.

- **[MAJOR-1 재확인 · 프론트 무변경]** 편집 KPI 로드는 `useKpis({ ..., status: 'confirmed' })`(page) 그대로, 가중치 합계 바(`totalWeight`/`sumOk`)도 confirmed 행 집합 기준 그대로. 리더 확정대로 백엔드가 검증 모집단을 confirmed 로 통일하므로 양측 모집단 일치. 프론트 변경 없음(현 상태가 정합).
- **[MINOR-1 수정] 이력 변경자 표시명.** 백엔드 `GET /midterm/rebaseline/history` 엔트리에 `createdByName`(실행자 표시명) 추가됨. `lib/types.ts` `RebaselineHistoryEntry`에 `createdByName: string` 추가. `RebaselineHistoryItem`이 raw userId/피평가자 후보 맵 해석 대신 `entry.createdByName` 직접 표시(폴백: createdBy → '(알 수 없음)'). 이에 따라 `nameById` prop 체인 전체 제거 — `RebaselineHistoryItem`·`RebaselineHistory`의 `nameById` prop 삭제, page의 `nameMapFromUsers` 헬퍼 및 prop 전달 삭제(피평가자 후보 맵으로 실행자를 잘못 해석하던 dead path 제거).
- **[MINOR-3 수정] 행별 사유(lineReason) dead UI 제거.** 전송·저장되지 않던 행별 "사유 *" 입력칸을 표에서 제거(전체 reason 입력만 필수 유지). `RebaselineRow.lineReason` 필드, RebaselineTable의 사유 컬럼(헤더+셀)·`Textarea` 행사유 입력, page의 `toRow` lineReason 초기화 삭제. 미사용 `rowErrors` state/prop도 정리 — 다만 백엔드가 향후 `details`로 kpiId별 에러를 줄 여지를 주석으로 `RebaselineTableProps`에 남겨 재배선 지점 표시.
- **검증:** `npm run typecheck` 통과 · `npm run build` 통과(`/admin/midterm/rebaseline` 9.63 kB 정적 라우트 생성). ①②③·④ 기존 동작 회귀 없음(편집/저장/이력 경로 그대로, 제거분은 미전송 UI 한정).
