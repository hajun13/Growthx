# QA 리포트 — 전면 재스킨 통합 검증

> 작성: 2026-06-12 | 검증자: QA-Engineer | 대상: 재스킨 그룹 A~I (9개 에이전트 병렬 작업)

---

## 최종 판정: PASS (결함 2건 수정 완료, 설계 판단 보고 2건)

---

## 1. 타입체크 (검증 항목 1)

```
apps/web$ npx tsc --noEmit
→ 출력 없음 (에러 0건)
```

**결과: PASS**

---

## 2. 프로덕션 빌드 (검증 항목 2)

```
apps/web$ npm run build
→ ✓ Compiled successfully
→ ✓ Generating static pages (35/35)
→ 라우트 오류 0건
```

| 주요 라우트 | 빌드 크기 |
|-----------|---------|
| /dashboard | 10.1 kB |
| /eval/midterm | 20.5 kB |
| /kpi | 12.6 kB |
| /reports/yoy | 16.1 kB |
| /admin/cycle | 17.4 kB |

**결과: PASS — 35개 라우트 전부 정상 빌드**

---

## 3. 기준 화면 불가침 검증 (검증 항목 3)

### 보호 대상 파일 변경 여부

`git diff --name-only HEAD` 기준으로 다음 보호 파일은 변경되지 않았음:

| 보호 파일 | 상태 |
|---------|------|
| `dashboard/page.tsx` | 변경 없음 (이전 세션 커밋 포함, 이번 세션 미변경) |
| `eval/my/page.tsx` | 변경 없음 |
| `kpi/page.tsx` | 변경 없음 |
| `components/PageHeader.tsx` | 변경 없음 |
| `components/PageContainer.tsx` | 변경 없음 |
| `components/Card.tsx` | 변경 없음 |
| `components/Button.tsx` | 변경 없음 |
| `components/Tabs.tsx` | 변경 없음 |
| `components/Modal.tsx` | 변경 없음 |
| `components/StatusBadge.tsx` | 변경 없음 |
| `components/GradeChip.tsx` | 변경 없음 |
| `components/States.tsx` | 변경 없음 |
| `components/InfoBanner.tsx` | 변경 없음 |
| `components/TextField.tsx` | 변경 없음 |
| `components/Select.tsx` | 변경 없음 |
| `components/Toast.tsx` | 변경 없음 |

**예외 인정 파일(이번 세션 이전부터 수정 상태):**
- `apps/web/components/AppShell.tsx` — 예외 인정
- `apps/web/app/(main)/layout.tsx` — 예외 인정
- `eval/midterm/` 4개 파일 — 예외 인정
- `_workspace/04_frontend/progress.md` — 예외 인정
- `.claude/scheduled_tasks.lock`(삭제) — 예외 인정

**결과: PASS — 기준 화면 불가침 위반 없음**

---

## 4. 금지 토큰 잔재 스캔 (#3182f6 Toss 블루) (검증 항목 4)

### 스캔 결과

재스킨 대상 파일에서 `#3182f6` 검색 결과:

| 파일 | 라인 | 분류 |
|-----|------|------|
| `apps/web/app/(main)/eval/my/page.tsx:408` | 아바타 배경색 | **기준 화면(보호 대상) — 수정 금지, 설계 판단 보고** |
| `apps/web/app/(main)/kpi/page.tsx:482` | 링크 텍스트 색 | **기준 화면(보호 대상) — 수정 금지, 설계 판단 보고** |
| `apps/web/components/EvalReport.tsx:34` | 내부 팔레트 상수 | 공용 컴포넌트(보호 목록 외, 단 `eval/my` + `eval/result/[userId]`에서 사용) |

재스킨 대상 페이지(기준 화면 제외)에는 `#3182f6` 잔재 없음.

**결과: PASS (재스킨 대상 범위 클리어)**

**설계 판단 보고 (수정하지 않음):**
- `eval/my/page.tsx:408` — `background: '#3182f6'` 아바타 배경. 기준 화면이므로 재스킨 금지였으나 Toss 블루 잔재가 남아 있음. 다음 재스킨 사이클에서 K.secondary(`#0054ca`)로 교체 권고.
- `kpi/page.tsx:482` — `color: '#3182f6'` 링크 색. 동일 이슈. 다음 사이클에서 K.secondary로 교체 권고.

---

## 5. 등급 색 일관성 검증 (검증 항목 5)

### GRADE_BADGE 정의 비교

| 파일 | S | A | B | C | D | 판정 |
|-----|---|---|---|---|---|------|
| `eval/self/page.tsx` | #3f2c80 | #0054ca | #4CAF50 | #FF9800 | #F44336 | 기준 |
| `eval/dept-head/page.tsx` | #3f2c80 | #0054ca | #4CAF50 | #FF9800 | #F44336 | PASS |
| `admin/group-performance/page.tsx` | #3f2c80 | #0054ca | #4CAF50 | #FF9800 | #F44336 | PASS |
| `reports/page.tsx` | #3f2c80 | #0054ca | #4CAF50 | #FF9800 | #F44336 | PASS |
| `reports/evaluation-summary/page.tsx` | #3f2c80 | #0054ca | #4CAF50 | #FF9800 | #F44336 | PASS |
| `reports/yoy/PersonTimelinePanel.tsx` | #3f2c80 | #0054ca | #4CAF50 | #FF9800 | #F44336 | PASS |
| `reports/yoy/OrgDistributionPanel.tsx` | #3f2c80 | #0054ca | #4CAF50 | #FF9800 | #F44336 | PASS |
| `eval/midterm/EmployeeMidterm.tsx` | #3f2c80 | #0054ca | #4CAF50 | #FF9800 | #F44336 | PASS |
| `components/yoy/DistRatioTable.tsx` | #3f2c80 | #0054ca | #4CAF50 | #FF9800 | #F44336 | PASS |
| `components/yoy/YoyTimelineChart.tsx` | #3f2c80 | #0054ca | #4CAF50 | #FF9800 | #F44336 | PASS |
| `components/yoy/YoyDistributionGroup.tsx` | #3f2c80 | #0054ca | #4CAF50 | #FF9800 | #F44336 | PASS |
| `components/yoy/YearDetailCard.tsx` | #3f2c80 | #0054ca | #4CAF50 | #FF9800 | #F44336 | PASS |
| `components/RuleSetEditor.tsx` | #3f2c80 | #0054ca | ~~#0e9aa0~~ → **#4CAF50** | ~~#fe9800~~ → **#FF9800** | ~~#f04452~~ → **#F44336** | **[FIX] 수정 완료** |
| `admin/monthly-performance/page.tsx` | gradeChipColor 사용(Toss) | 동상 | 동상 | 동상 | 동상 | **[FIX] GRADE_BADGE로 교체 완료** |

**결과: PASS (2건 수정 후)**

### 수정 내역
1. `apps/web/components/RuleSetEditor.tsx:288-294` — B=#0e9aa0, C=#fe9800, D=#f04452을 DESIGN.md 기준(B=#4CAF50, C=#FF9800, D=#F44336)으로 수정
2. `apps/web/app/(main)/admin/monthly-performance/page.tsx:33,363,642` — `gradeChipColor[grade].bg`(Toss S=#1b64da, A=#3182f6)를 `GRADE_BADGE[grade]?.bg`로 교체, import에서 `gradeChipColor` 제거

---

## 6. 공용 컴포넌트 변경 요청 취합 (검증 항목 6)

각 그룹 리포트에서 "공용 컴포넌트 변경 요청" 항목 취합:

| 그룹 | 파일 | 요청 내용 |
|-----|------|---------|
| G (cycle/rules/settings/audit) | — | 없음 |
| H (compensation/group-performance/monthly-performance/kpi-import/competency/items) | — | 없음 |
| F (org/OrgNodeModal/OrgStructureBoard) | — | 없음 |
| I (login/PasswordChangeGate) | `PasswordPolicyChecklist` | "Kinetic 스타일 적용이 필요하다면 별도 그룹 작업 시 admin/settings 담당 에이전트가 공용 컴포넌트 변경 여부를 결정해야 함" (요청 아님, 메모) |
| A (eval/self, eval/dept-head) | — | 없음 (PageHeader, Modal, States, Button 그대로 사용) |
| B (midterm 그룹) | — | 없음 |
| C (eval/result, org, appeals) | `EmptyState action prop` | States.tsx 확인 결과 이미 지원됨 — 변경 불필요 |
| D (kpi/review, appeals, notifications) | — | 없음 (NotificationItem 수정 금지 기록만) |
| E (reports/yoy) | `GradeChip` | 공용 컴포넌트 자체 수정 없음, YearDetailCard에서 import 제거 후 직접 GRADE_BADGE span으로 대체 |

**총 공용 컴포넌트 실제 변경 요청: 없음**
- 모든 그룹이 공용 프리미티브(PageHeader, PageContainer, Card, Button, Tabs, Modal, StatusBadge, GradeChip, States, InfoBanner, TextField, Select, Toast) 를 수정하지 않았음.
- GradeChip의 경우 컴포넌트 자체가 아닌 사용측에서 import 제거 후 직접 구현으로 처리(공용 컴포넌트 불변 원칙 준수).

---

## 7. 데이터 레이어 불변 표본 점검 (검증 항목 7)

표본 4개 파일 diff 분석:

### eval/self/page.tsx
- 훅 사용: `useAuth`, `useCurrentCycle`, `useKpis`, `useEvaluation`, `useToast` — 모두 기존 훅, 시그니처 변경 없음
- API 추가/제거: 없음
- 새 상태 변수: `confirmSubmitOpen`(Modal 상태), `submitting`(기존 패턴 확장) — UI 레이어 전용, 비즈니스 로직 불변

### reports/page.tsx
- 훅 사용: 기존 훅 유지, import 라인 `gradeChipColor` → `GRADE_BADGE` 교체만
- API 추가/제거: 없음
- 데이터 매핑 변경: 없음

### kpi/review/page.tsx
- 훅 사용: `useAuth`, `usePermissions`, `useCurrentCycle`, `useKpis`, `useKpiReviews`, `kpiCommands`, `useRuleSet`, `useUsers` — 모두 기존 훅
- 신규 상태: `batchBusy`, `batchConfirmOpen` — 일괄 승인 UX용 UI 상태만(일괄 승인 실제 로직은 기존 `kpiCommands.approve()` 호출)
- API 추가/제거: 없음

### appeals/page.tsx
- import 추가: `Skeleton, ErrorState, EmptyState`(States.tsx 공용), `InfoBanner` — 기존 공용 컴포넌트 import 추가
- 신규 상태: `reasonError`(폼 검증 인라인 에러), `responseDraft`, `expandedTimeline` — UI 상태만
- API 훅: 기존 훅 유지, 시그니처 변경 없음

**결과: PASS — 4개 표본 모두 데이터 레이어(fetch/api/훅 시그니처) 불변**

---

## 수정 내역 요약

| # | 파일 | 라인 | 결함 유형 | 처리 |
|---|------|------|---------|------|
| 1 | `apps/web/components/RuleSetEditor.tsx` | 288-294 | 등급 색 불일치 — B=#0e9aa0(teal), C=#fe9800, D=#f04452 vs DESIGN.md 기준 | 직접 수정 완료 (B=#4CAF50, C=#FF9800, D=#F44336) |
| 2 | `apps/web/app/(main)/admin/monthly-performance/page.tsx` | 33, 363+8, 642+8 | gradeChipColor(Toss S=#1b64da/A=#3182f6) 미교체 — 재스킨 대상임에도 toss 색 잔존 | 직접 수정 완료 (GRADE_BADGE 상수 추가, gradeChipColor import 제거) |

---

## 설계 판단 보고 (수정 금지 — 보고만)

| # | 파일 | 라인 | 내용 | 권고 |
|---|------|------|------|------|
| 1 | `apps/web/app/(main)/eval/my/page.tsx` | 408 | `background: '#3182f6'` 아바타 배경 — 기준 화면이므로 이번 재스킨 대상 아님, Toss 블루 잔재 | 다음 재스킨 사이클 또는 기준 화면 갱신 시 K.secondary(`#0054ca`)로 교체 권고 |
| 2 | `apps/web/app/(main)/kpi/page.tsx` | 482 | `color: '#3182f6'` 링크 텍스트 색 — 동일 이슈 | 동일 권고 |

---

## 남은 권고

1. **GRADE_BADGE 중앙화 권고**: 현재 12개 이상 파일에 동일한 GRADE_BADGE 상수가 중복 정의되어 있음. `apps/web/lib/ui.ts`에 단일 export로 통합하면 향후 불일치 방지. 단 이번 재스킨 범위 외이므로 별도 작업 권고.

2. **EvalReport.tsx의 `blue: '#3182f6'`**: 내부 팔레트 상수(34라인)에 Toss 블루가 남아 있음. `eval/my/page.tsx`와 `eval/result/[userId]/page.tsx`에서 사용. 실제 렌더에 미치는 영향 범위를 확인 후 수정 권고.

3. **gradeChipColor(lib/toss.ts) 잔존 import**: `dashboard/page.tsx`(기준화면), `KpiGradingDisplay.tsx`, `GradeCriteriaPicker.tsx`, `kpi/page.tsx`(기준화면)에서 여전히 `gradeChipColor` 사용. 기준화면 2개는 다음 재스킨 사이클에서, 공용 컴포넌트 2개(`KpiGradingDisplay`, `GradeCriteriaPicker`)는 보호 목록 외이므로 별도 작업으로 처리 권고.
