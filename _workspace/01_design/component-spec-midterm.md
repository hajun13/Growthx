# 컴포넌트 스펙 — 6월 중간평가 · 피드백 보완 조치 (설계 ①②③)

> **소비자:** frontend-engineer(`nextjs-frontend`). **화면 조립:** `wireframes-midterm.md`. **토큰:** `design-tokens.md` + `DESIGN.md`(Toss). **시각 기준:** Primary `#3182f6`, Dark `#191f28`, border-radius **0**(사각), 컴팩트 고밀도, 글꼴 Pretendard.
> **원칙:** 기존 컴포넌트 **최대 재사용**. 신규는 7개(+조립 2). 기존 `apps/web/components`의 인라인 스타일/`T` 토큰 패턴과 일관. 컴포넌트명은 **확정값**(frontend가 그대로 사용). 공통: 대비 AA, 색+라벨 병기, 키보드 포커스, `prefers-reduced-motion` 존중.
> **API 가정:** `contract-midterm.md` 미존재 → §7 가정 표 기준. 타입은 계약 확정 시 정렬.

---

## 0. 공통 타입 (신규/확장)

```ts
// 기존(재사용): Grade, KpiGroup, MeasureType, EvalStatus, Role, KpiStatus ...

// ── 보완 조치 (설계안 §2③ ActionItem) ──
type ActionItemStatus = 'planned' | 'in_progress' | 'done' | 'canceled';

interface ActionItem {
  id: string;
  cycleId: string;
  kpiId?: string | null;          // 연결 KPI(선택)
  kpiTitle?: string | null;       // 표시용(비정규화). 없으면 백엔드 join
  userId: string;                 // 대상 구성원
  source: 'midterm_review';
  title: string;
  detail?: string | null;
  assigneeId: string;             // 담당(보통 본인)
  assigneeName?: string | null;   // 표시용
  dueDate: string;                // ISO date
  status: ActionItemStatus;
  createdById: string;            // 부서장
  createdAt: string;
  completedAt?: string | null;
  completionNote?: string | null; // done/canceled 메모(취소 사유 포함)
}

// ── 진척 점검 (설계안 §2②) — Achievement Q1·Q2 누적 + 추세 + 신호 ──
type MidtermSignal = 'on_track' | 'caution' | 'at_risk';  // 순항/주의/위험

interface MidtermProgressItem {
  kpiId: string;
  title: string;
  group: KpiGroup;
  measureType: MeasureType;
  targetValue?: number | null;    // 정성이면 null
  targetText?: string | null;     // 정성 목표 서술
  unit?: string | null;           // 억/건/% 등
  currentValue?: number | null;   // 현재 누적 실적
  currentCount?: number | null;   // count 방식
  achievementRate?: number | null;// % (amount/rate, 백엔드 산정). 정성=null
  prevRate?: number | null;       // 직전 기준 누적률(추세 계산용)
  trendDelta?: number | null;     // 변화량(+8 = +8%p, count면 +건). 백엔드 산정 권장
  signal: MidtermSignal | null;   // 신호(백엔드 산정). 정성/미산정 시 null
}

// 자가 점검 / 부서장 확인
interface MidtermReview {
  selfNote?: string | null;            // 본인 자가 점검 본문
  selfSubmittedAt?: string | null;
  reviewerNote?: string | null;        // 부서장 중간 피드백
  reviewerName?: string | null;
  confirmedAt?: string | null;         // 부서장 확인 완료 시각
}
```

> **계산 책임 = 백엔드.** 달성률·추세 델타·신호는 모두 서버 산정값을 **표시만** 한다(프론트 재계산 금지). 신호 임계값은 `RuleSet` 정책(설정 가능) — 프론트는 enum만 받음.

---

## 1. MidtermSignalBadge — 진척 신호 배지 (신규)

진척 표의 "신호" 셀. **순항/주의/위험**을 색+라벨로. (등급 색과 충돌 회피 위해 등급용 grade-* 토큰 미사용.)

```ts
interface MidtermSignalBadgeProps {
  signal: MidtermSignal | null;   // null = 산정 불가(정성/미입력)
  size?: 'sm' | 'md';
}
```

**토큰 매핑 (DESIGN.md / design-tokens.md):**

| signal | 라벨 | 배경 토큰 | 텍스트 토큰 | HEX(bg / fg) | 비고 |
|--------|------|-----------|-------------|--------------|------|
| `on_track` | 순항 | `success-50` | `success-700` | `#E7F8EF` / `#0B7544` | 완료/긍정 톤 |
| `caution` | 주의 | `warning-50` | `warning-700` | `#FEF6E6` / `#A66800` | 앰버, 경고 |
| `at_risk` | 위험 | `danger-50` | `danger-700` | `#FDECEC` / `#AE222E` | 레드 |
| `null` | — | `neutral-100` | `neutral-500` | `#F2F4F6` / `#8B95A1` | "—" 표시 |

- 형태: 사각(radius 0), `px-2 py-0.5`, `text-xs`(11px) `font-medium`. 좌측 8×8 점(`bg`보다 진한 톤) 옵션.
- **접근성:** `aria-label`(예: "신호: 위험"). 색만 의존 금지 — 한글 라벨 항상 병기.

---

## 2. TrendIndicator — 추세 표시 (신규)

직전 대비 누적 달성률/건수 변화. ▲▼– + 값.

```ts
interface TrendIndicatorProps {
  delta: number | null;           // +8(=+8%p) / -3 / 0. null=표시 안 함
  unit?: '%p' | '건' | '';        // 기본 '%p'
}
```

| delta | 아이콘 | 색(텍스트) | 토큰 |
|-------|--------|-----------|------|
| > 0 | ▲ (ArrowUp) | 상승 | `success-600` `#0F9457` |
| < 0 | ▼ (ArrowDown) | 하락 | `danger-600` `#D6303D` |
| = 0 | – (Minus) | 보합 | `neutral-500` `#8B95A1` |
| null | (빈) | — | "—" `neutral-400` |

- 표기: `▲ +8%p` / `▼ -3건` — 부호·수치·단위 텍스트 병기(색만 의존 금지). `tabular-nums`.
- **접근성:** `aria-label`("추세 상승 8퍼센트포인트").

---

## 3. MidtermProgressTable — KPI 진척 표 (신규)

C-1(본인)·C-2 상세(구성원 읽기전용)·RES 진척 요약 공용. **계산 없이 표시만.**

```ts
interface MidtermProgressTableProps {
  items: MidtermProgressItem[];
  /** 'self' = 본인 편집맥락(읽기전용 표, 입력은 별도 카드), 'review' = 부서장 읽기, 'result' = 결과요약(추세 생략 가능) */
  variant?: 'self' | 'review' | 'result';
  showTrend?: boolean;            // 기본 true. result에선 false 가능
}
```

**컬럼(좌→우):** 과제명(+group 칩) / 목표 / 현재실적 / 누적달성률 / 추세(`TrendIndicator`) / 신호(`MidtermSignalBadge`).

- **measureType별 셀:**
  - `amount`/`rate`: 목표·현재 = `fmtAmount`/숫자+단위, 달성률 = `fmtPercent`(`tabular-nums`).
  - `count`: 목표·현재 = "N건", 달성률 = % 또는 "14/20".
  - `qualitative`: 목표=`targetText`(말줄임), 현재·달성률 = `–`, 신호는 백엔드값(없으면 "—"). 행 끝에 작은 `정성` 칩(warning 톤, 기존 KpiCard 패턴).
- **스타일:** 표 헤더 `bg neutral-50`(`#F9FAFB`) `text-xs` `font-semibold` `neutral-600`. 행 보더 `neutral-200`(`#e5e8eb`), hover `neutral-50`. radius 0. 숫자 우정렬 `tabular-nums`. group 칩은 기존 `groupChip` 토큰(`lib/toss`).
- **상태:** items 0 → `EmptyState`("표시할 KPI 진척이 없어요."). 정성 전용 데이터셋도 정상 렌더.
- **반응형:** `lg`↑ 테이블(가로 스크롤 허용 `min-w`). `md`↓ 과제별 카드 리스트(라벨:값) — 기존 `ResultTable` 반응형 패턴 차용.
- **접근성:** `<table>` 시맨틱, 수치 셀 라벨. 달성률·신호·추세 모두 텍스트 병기.

---

## 4. ActionItemStatusBadge — 보완 조치 상태 배지 (신규)

planned/in_progress/done/canceled. **요청 지정 색** 사용.

```ts
interface ActionItemStatusBadgeProps {
  status: ActionItemStatus;
}
```

**토큰 매핑 (요청 명세 그대로 → DESIGN.md 토큰명):**

| status | 라벨 | 색 의도 | 배경 토큰 | 텍스트 토큰 | HEX(bg / fg) |
|--------|------|---------|-----------|-------------|--------------|
| `planned` | 계획 | 중립 회색 | `neutral-100` | `neutral-600` | `#F2F4F6` / `#6B7684` |
| `in_progress` | 진행중 | Primary Blue | `primary-50` | `primary-600` | `#EBF3FE` / `#1B64DA` |
| `done` | 완료 | 초록 | `success-50` | `success-700` | `#E7F8EF` / `#0B7544` |
| `canceled` | 취소 | 흐린 회색 | `neutral-50` | `neutral-400` | `#F9FAFB` / `#B0B8C1` |

- 형태: 사각(radius 0) `px-2 py-0.5` `text-xs`(11px) `font-medium`. (기존 `eval/page.tsx` statusBadge 사각 패턴과 일관.)
- `canceled`는 흐린 톤(저강조) — 연결 텍스트도 `line-through` 권장(배지 자체는 취소선 없음).
- **접근성:** `aria-label`("보완 조치 상태: 진행중").

> in_progress가 Primary Blue 솔리드가 아닌 `primary-50` 배경 + `primary-600` 텍스트인 이유: 표/리스트에 다수 배지가 깔리는 컴팩트 UI에서 솔리드 블루는 과도. 솔리드가 필요한 강조(예: 단일 헤더 칩)에선 `primary-500` bg + 흰 텍스트 변형 허용.

---

## 5. ActionItemRow — 보완 조치 행 (신규)

C-1(본인 갱신)·C-2(부서장 관리)·FIN(읽기전용 패널) 공용.

```ts
interface ActionItemRowProps {
  item: ActionItem;
  /** 'assignee'=담당 본인(상태 planned↔in_progress↔done 갱신, canceled 불가),
   *  'owner'=부서장(전체 상태·편집·취소),
   *  'readonly'=조회만(FIN 패널·타인) */
  mode: 'assignee' | 'owner' | 'readonly';
  onChangeStatus?: (id: string, next: ActionItemStatus, note?: string) => void;
  onEdit?: (item: ActionItem) => void;     // owner 편집
}
```

**레이아웃(한 행):**
```
[ActionItemStatusBadge]  제목(굵게)            · 마감 9/30 · 연결: 매출액
  상세 본문(neutral-700, 말줄임 2줄, 펼침 가능)
  ─ 상태 토글(mode!='readonly'):  [계획][진행중][완료]   ([취소] owner만)
  ─ done 선택 시: 완료 메모 TextField(선택)  ─ canceled(owner): 사유 TextField(필수)
  ─ readonly: done→"완료 9/28"  canceled→사유 + 제목 line-through
```

- **상태 토글:** segmented(`radio` 시맨틱)로 현재 상태 강조(`primary-50`+`primary-500` 보더). `assignee`는 `canceled` 칸 비활성+툴팁("취소는 부서장이 처리해요"). `owner`는 전 상태.
- **연결 KPI:** `item.kpiTitle` 있으면 "연결: {title}" 작은 칩(`neutral-100`). 없으면 생략.
- **마감 임박/경과:** dueDate가 지났고 status≠done/canceled면 마감 라벨 `danger-600` + "지남" 텍스트.
- **스타일:** 카드 보더 `neutral-200`, padding 14, radius 0. 행 간 `space-2`. 컴팩트.
- **상태/변형:** 갱신 중 토글 `loading`(비활성). 낙관적 갱신 실패 시 `Toast(danger)` + 롤백.
- **접근성:** 토글 `role="radiogroup"`/`radio` + `aria-checked`. 제목 `<h4>`. 마감 경과 `aria-label`에 "마감 지남" 포함.

---

## 6. ActionItemFormModal — 보완 조치 등록/편집 (신규 조립, `Modal` 재사용)

C-2 부서장 등록·편집. 기존 `Modal`(size md) + `TextField` + `UserCombobox` + `Select`.

```ts
interface ActionItemFormValue {
  title: string;
  detail?: string;
  assigneeId: string | null;
  kpiId?: string | null;
  dueDate: string;              // ISO date
}
interface ActionItemFormModalProps {
  open: boolean;
  onClose: () => void;
  initial?: Partial<ActionItemFormValue>;   // 편집 시 기존값. 등록 시 assignee=구성원 본인 기본
  memberUsers: { id: string; name: string; position?: string; email: string }[]; // UserCombobox용
  kpiOptions: { value: string; label: string }[];  // 구성원 KPI(연결용, 선택)
  onSubmit: (v: ActionItemFormValue) => void | Promise<void>;
  submitting?: boolean;
}
```

- **필드:** 제목*(TextField) / 상세(TextField multiline rows 3) / 담당*(UserCombobox, 기본=대상 구성원) / 연결 KPI(Select, "연결 안 함" 옵션 포함) / 마감일*(TextField type=date 또는 date input).
- **검증(프론트 즉시, 최종 책임 백엔드):** 제목·담당·마감 필수. 미충족 시 primary 버튼 비활성 + 필드 `error`. 마감일은 오늘 이후 권장(과거 입력 시 `warning` 캡션, 차단은 아님).
- **액션:** primary "등록"(편집 시 "저장") `loading=submitting`, secondary "취소".
- **반응형:** `md`↓ 하단 시트 full-width(기존 Modal 동작).
- **접근성:** `role="dialog" aria-modal`, 포커스 트랩, ESC, 라벨-필드 연결.

---

## 7. MidtermResultSummary — RES(mid_review) 분기 본문 (신규 조립)

블록① — 결과 페이지가 mid_review일 때 등급/보상 숨기고 진척 요약으로 대체.

```ts
interface MidtermResultSummaryProps {
  userName: string;
  departmentName: string;
  progress: MidtermProgressItem[];
  review?: MidtermReview | null;   // 부서장 중간 피드백(있으면 읽기전용 표시)
}
```

- **구성(조립):**
  1. `InfoBanner(tip)` "중간 점검 결과예요 (비구속) — 등급·보상은 12월 최종평가에서 확정돼요."
  2. 다크 요약 카드(기존 `summary-dark` 스타일 재사용) — 등급 박스 자리에 **"점검중"/`–`** 플레이스홀더 3개(종합·성과중심·협업·성장). 하단 캡션 "등급·보상은 최종평가 완료 후 공개돼요."
  3. `Card "상반기 진척 요약"` > `MidtermProgressTable variant="result"`(등급 컬럼 없음).
  4. `review.reviewerNote` 있으면 `Card "부서장 중간 피드백"` > `CommentThread`(읽기전용).
- **숨김(렌더 안 함):** `finalGrade`·`finalScore`·`byGroup` 점수·`percentile`·`companyAvg`·`ComparisonBar`·`EvaluatorFlow`·이의제기 CTA·`ResultExportButton`.
- **접근성:** 등급 플레이스홀더 `aria-label`("종합 등급: 점검 중, 아직 산정되지 않음").

---

## 8. MidtermActionPanel — FIN(calibration/closed) 보완 조치 참고 패널 (신규 조립)

블록③ §2 — 최종 결과 화면 하단 참고 패널.

```ts
interface MidtermActionPanelProps {
  items: ActionItem[];
  /** 본인 결과면 빈 상태도 노출, 타인이면 items 0일 때 패널 자체 숨김 */
  showWhenEmpty?: boolean;
}
```

- **구성:** `Card title="중간 보완 조치 이행 현황"` + 헤더 우측 칩 **"참고용 · 등급 미반영"**(중립 회색 `neutral-100`/`neutral-600`).
  - 카드 본문 상단 `InfoBanner(info)` "6월 중간 점검에서 합의한 보완 조치예요. 이행 현황은 참고용이며 등급·보상에 직접 반영되지 않아요."
  - `ActionItemRow mode="readonly"` × N.
  - 하단 요약 라인: "완료 N · 진행중 N · 계획 N · 취소 N (총 N건)" — 상태별 카운트 텍스트.
- **빈:** `showWhenEmpty` true → `EmptyState`("6월 중간 점검에서 등록된 보완 조치가 없어요."). false → 패널 미렌더.
- **노출 조건(부모 페이지):** `cycle.status ∈ {calibration, closed}`.
- **접근성:** "참고용" 칩 `aria-label`("참고용, 등급에 반영되지 않음").

---

## 9. 재사용 컴포넌트 (변경 없이 그대로 사용)

| 컴포넌트 | 위치 | MT/RES/FIN 사용 | 비고 |
|----------|------|------------------|------|
| `AppShell` / `PageContainer` / `PageHeader` / `Breadcrumb` | components/ | 전체 | 헤더에 `CycleTypeBadge`(중간/최종) + 주기 셀렉터 |
| `InfoBanner` | components/InfoBanner | 안내·비구속 톤 | tone `tip`(비구속)·`info`(참고용)·`warning`(위험 강조) |
| `Card` | components/Card | 전체 | 헤더 15px/700, 보더, radius 0 |
| `Button` / `TextField` / `Select` / `Modal` / `Toast` | components/ | 폼·액션·피드백 | |
| `StatusBadge` | components/StatusBadge | 자가점검(submitted)·부서장확인(finalized 톤) | 기존 eval/kpi 상태 매핑 |
| `ProgressDonut` | components/ProgressDonut | C-1 입력 완료율(N/총 KPI) | |
| `MonthlyTrendChart` | components/MonthlyTrendChart | C-3 조직 월별 누적 추세 | `MonthlyPerformance` 데이터 |
| `ScopeSelect` | components/ScopeSelect | C-3 group/division 범위 | |
| `UserCombobox` | components/UserCombobox | C-2 구성원·담당 선택 | |
| `CommentThread` | components/CommentThread | C-2 부서장 확인·RES 피드백 | `required` 톤으로 확인 전 코멘트 강제 |
| `EmptyState`/`ErrorState`/`Skeleton`/`Forbidden` | components/States | 상태 | |
| `groupChip` / `T` / `gradeChipColor` / `fmtPercent`·`fmtAmount`·`fmtScore` | lib/toss·lib/ui | 칩·수치 포맷 | |

---

## 10. 토큰 매핑 요약 (신규 배지 한눈에)

| 의미 | 라벨 | bg HEX | fg HEX | DESIGN.md 토큰 |
|------|------|--------|--------|----------------|
| 진척 순항 | 순항 | `#E7F8EF` | `#0B7544` | success-50 / success-700 |
| 진척 주의 | 주의 | `#FEF6E6` | `#A66800` | warning-50 / warning-700 |
| 진척 위험 | 위험 | `#FDECEC` | `#AE222E` | danger-50 / danger-700 |
| 진척 미산정 | — | `#F2F4F6` | `#8B95A1` | neutral-100 / neutral-500 |
| 보완 계획 | 계획 | `#F2F4F6` | `#6B7684` | neutral-100 / neutral-600 |
| 보완 진행중 | 진행중 | `#EBF3FE` | `#1B64DA` | primary-50 / primary-600 |
| 보완 완료 | 완료 | `#E7F8EF` | `#0B7544` | success-50 / success-700 |
| 보완 취소 | 취소 | `#F9FAFB` | `#B0B8C1` | neutral-50 / neutral-400 |
| 추세 상승/하락/보합 | ▲/▼/– | (텍스트) | `#0F9457`/`#D6303D`/`#8B95A1` | success-600/danger-600/neutral-500 |
| 참고용 칩(등급 미반영) | 참고용 | `#F2F4F6` | `#6B7684` | neutral-100 / neutral-600 |

> 모든 신규 배지는 **사각(radius 0)** · 색+한글 라벨 병기 · 대비 AA. 등급(S~D) 색 토큰과는 의도적으로 분리(혼동 방지).

---

## 11. API 데이터 shape 가정 (contract-midterm.md 미존재 → 명시)

| # | 가정 | 근거/대체 |
|---|------|----------|
| A1 | `GET /midterm/progress?cycleId&userId` → `MidtermProgressItem[]`(달성률·trendDelta·signal **서버 산정**) | 설계안 ②: `Achievement` Q1·Q2 재사용. 프론트 재계산 금지 |
| A2 | 신호 임계값은 `RuleSet` 정책 → 프론트는 enum만 수신 | business-rules 설정 가능 원칙 |
| A3 | `GET /midterm/review?cycleId&userId` → `MidtermReview` (self/reviewer note + 확인시각) | `Review`/`reviewerNote` 재사용 |
| A4 | `POST /midterm/self-check` / `POST /midterm/confirm`(부서장) | 신규. 확인 시 코멘트 필수 |
| A5 | `GET /action-items?cycleId&userId` → `ActionItem[]` ; `POST`/`PATCH /:id`(상태·필드) | 설계안 ③ 신규 엔티티 |
| A6 | 상태 전이 권한: 생성/취소/마감판단=부서장(owner), planned↔in_progress↔done=담당(assignee)+부서장 | 설계안 ③ RBAC |
| A7 | 결과 mid_review 가드: 집계/보상 API가 `cycle.status∉{calibration,closed}`면 400 | 설계안 ①. 프론트는 `cycle.status`로 선분기(수치 fetch 회피) |
| A8 | C-2 구성원 목록 = 부서장 downward 평가 대상과 동일 범위 | wireframe G2 |

> 계약(`contract-midterm.md`) 확정 시 위 경로/필드명을 1:1로 맞추면 됨. shape 자체는 위 타입(§0)을 기준으로 함.

---
---

# ④ 중간 KPI 목표 재조정(re-baseline) + 변경 이력 컴포넌트 〔append〕

> **소비자:** frontend-engineer. **화면 조립:** `wireframes-midterm.md` ④ 섹션. **시각 기준 동일**(Toss: Primary `#3182f6`, Dark `#191f28`, radius 0, 컴팩트, Pretendard).
> **원칙:** ①②③과 **일관**. 신규 6개. 이력 diff·검증은 기존 자산 재사용 — `KpiSnapshotDiff`/`KpiDiffItem`/`KpiDiffField`([types.ts:803-822](../../apps/web/lib/types.ts#L803)), `useKpiSnapshots`/`useKpiSnapshotDiff` 훅, 가중치 합 검증 패턴(`kpi/page.tsx`·`kpi-import/page.tsx`), `WeightField` 피드백 톤. 컴포넌트명 확정값.
> **변경/추가/제거 색 = success/danger/primary 계열 재사용(등급색 grade-* 분리).** 요청 명세 그대로.

---

## ④-0. 공통 타입 (신규/재사용)

```ts
// 재사용(types.ts): KpiSnapshotMeta, KpiSnapshotDiff, KpiDiffItem, KpiDiffField{field,before,after}
//                   KpiGroup, MeasureType, Grade

// ── 재조정 편집 행(현재 확정 KPI + 새 값) ──
interface RebaselineRow {
  kpiId: string;
  title: string;
  group: KpiGroup;                 // performance_core | collaboration_growth
  measureType: MeasureType;        // amount | rate | count | qualitative
  isQualitative: boolean;
  unit?: string | null;            // 억/건/% 등(표시)
  // 현재(확정) 값 = 원본
  currentTargetValue: number | null;
  currentTargetText: string | null;
  currentWeight: number;
  // 편집 중인 새 값(초기 = 현재값 복사)
  nextTargetValue: number | null;
  nextTargetText: string | null;
  nextWeight: number;
  lineReason?: string;             // 행별 사유(변경된 행만 필수, 백엔드 지원 시)
}

// 변경 여부 판정(프론트 헬퍼)
function isRowChanged(r: RebaselineRow): boolean {
  return r.nextTargetValue !== r.currentTargetValue
    || r.nextTargetText !== r.currentTargetText
    || r.nextWeight !== r.currentWeight;
}

// 저장 payload(④-G A④-1)
interface RebaselineSubmit {
  cycleId: string;
  evaluateeId: string;
  reason: string;                  // 전체 사유(필수)
  changes: Array<{
    kpiId: string;
    targetValue?: number | null;
    targetText?: string | null;
    weight?: number;
    lineReason?: string;
  }>;
}

// 이력 1건(스냅샷 메타 + 변경자/사유 보강 가정 A④-2)
interface RebaselineHistoryEntry {
  snapshotId: string;
  label: string;                   // "중간 조정 전 · 2026-06-08"
  createdAt: string;               // ISO
  createdByName?: string | null;   // 변경자(메타 보강 필요)
  reason?: string | null;          // 재조정 사유(메타 보강 필요)
  diff?: KpiSnapshotDiff | null;   // useKpiSnapshotDiff 로 지연 로드
}
```

> **계산·검증 최종 책임 = 백엔드.** 프론트 합산·변경판정은 즉시 피드백용 표시. 저장 시 합≠100/단계≠mid_review는 서버 400 방어.

---

## ④-1. RebaselineChangedCell — 변경 셀 강조 래퍼 (신규)

표 셀(목표/가중치 입력) 래핑. 새 값이 원본과 다르면 강조.

```ts
interface RebaselineChangedCellProps {
  changed: boolean;
  children: React.ReactNode;       // 내부 입력(TextField/숫자 input)
}
```

**토큰 매핑 (변경 = Primary 계열):**

| 상태 | 좌측 바 | 배경 | 표식 | HEX |
|------|---------|------|------|-----|
| `changed` | 4px 좌측 바 `primary-500` | `primary-50` | 우상단 4×4 점 `primary-500` | bar/dot `#3182f6` · bg `#EBF3FE` |
| 미변경 | 없음 | 투명(표 기본) | 없음 | — |

- 형태: `position relative`, 좌측 `border-l-[3px]`(또는 `box-shadow inset 3px`), `bg primary-50` 시 텍스트 대비 유지. radius 0.
- **접근성:** 변경 셀 `aria-label`에 "변경됨" 포함 또는 시각장애 사용자용 입력에 `data-changed` + 행 단위 "변경된 항목" 텍스트 표식. 색만 의존 금지 — 변경 행 사유 칸 활성화가 보조 신호.
- 되돌리면(원본과 동일해지면) `changed=false` → 강조 자동 해제.

---

## ④-2. WeightSummaryBar — 가중치 합/정성 검증 표시 (신규, 요청 핵심)

재조정 표 우측 슬롯 + sticky 저장 바 공용. 실시간 합산(프론트 표시), 검증 강도는 ④-D 규칙.

```ts
interface WeightSummaryBarProps {
  totalWeight: number;             // 모든 KPI 새 가중치 합
  qualitativeWeight: number;       // 정성 KPI 새 가중치 합
  byGroup?: { performance_core: number; collaboration_growth: number };
  compact?: boolean;               // 저장 바용 1줄 압축
}
```

**검증 표시 (기존 WeightField 톤 재사용):**

| 조건 | 강도 | 표시 | 토큰(텍스트) |
|------|------|------|--------------|
| 합 = 100 | — | "가중치 합 100% ✔" | `success-600` `#0F9457` |
| 합 ≠ 100 | **하드** | "합이 100%가 되어야 저장할 수 있어요 (현재 {n}%)" | `danger-600` `#D6303D` |
| 정성 ≤ 30 | — | "정성 KPI 합 {n}% ✔" | `neutral-600` `#6B7684` |
| 정성 > 30 | 소프트 | "정성 KPI 합이 30%를 넘었어요 ({n}%)" | `warning-700` `#A66800` |

- 막대: 0~100 트랙(`neutral-200` bg), 채움 = 합. 100 기준선 점선. 합 ≠100이면 채움 색 `danger-400`, =100이면 `success-500`. radius 0.
- `compact`(저장 바): 막대 생략, "합 100% · 정성 30%" 텍스트 + 상태 색만.
- 숫자 `tabular-nums`. **접근성:** `role="status" aria-live="polite"`(합 변경 시 안내), 색+텍스트 병기.

> **정성 ≤30 = 소프트(경고만, 저장 허용)** — 기존 `kpi/page.tsx`·`WeightField` 정책 일관(§④-G G④-3). 하드 전환 필요 시 `qualHard?: boolean` prop 추가만 하면 됨.

---

## ④-3. RebaselineDiffRow — diff 한 줄 (신규, 요청: 추가/제거/변경 색 정의)

이력 항목 내부 한 KPI의 전/후. `before → after`.

```ts
type DiffKind = 'changed' | 'added' | 'removed';

interface RebaselineDiffRowProps {
  kind: DiffKind;
  title: string;                   // KPI 과제명
  fields: { label: string; before: string; after: string }[];  // 목표/가중치 등
}
```

**색 매핑 (요청: success/danger/primary 재사용 · 등급색 grade-* 분리):**

| kind | 의도 | 표식 | after 값 색 | before 값 색 | 토큰 |
|------|------|------|-------------|--------------|------|
| `changed` | 변경(대부분) | 화살표 `→` | `primary-600` `#1B64DA` | `neutral-500` `#8B95A1`(약한 톤) | primary-600 / neutral-500 |
| `added` | 신규 KPI 추가 | `+` 칩 | `success-700` `#0B7544` | — | success-50 bg / success-700 |
| `removed` | KPI 제거 | `−` 칩 + line-through | — (`neutral-400` 취소선) | `neutral-500` | neutral / danger-600 라벨 |

- 표기: `매출액 달성  목표 120억 →(primary) 100억   가중치 40% →(primary) 35%`. before는 저강조(약한 회색), after는 primary 강조 + `font-medium`. **취소선은 removed에만**(changed의 before는 회색 톤만 — 가독성).
- 정성 목표(targetText)는 말줄임 + hover 전체. 수치는 `fmtAmount`/`fmtPercent`.
- **접근성:** `aria-label`("매출액 달성 목표 120억에서 100억으로 변경"). 화살표·색 외에 "→ {after}" 텍스트가 자체 신호.

---

## ④-4. RebaselineHistoryItem — 이력 1건 (신규)

재조정 1회(=스냅샷 1개). 사유·변경자·시각 + diff(`RebaselineDiffRow` × N).

```ts
interface RebaselineHistoryItemProps {
  entry: RebaselineHistoryEntry;
  defaultOpen?: boolean;           // 최신은 true
  onLoadDiff?: (snapshotId: string) => void;  // 펼칠 때 useKpiSnapshotDiff 지연 로드
}
```

**레이아웃:**
```
● {createdAt 포맷}  ·  {createdByName} ({role})            [되돌릴 수 없음]
  사유: "{reason}"                                  ← 없으면 "(사유 미기록)" neutral-400
  ┌─ diff ──────────────────────────────────┐
  │ RebaselineDiffRow × (changed/added/removed) │
  └──────────────────────────────────────────┘
  변경 없는 KPI {unchangedCount}개
```

- 헤더 시각 점(`●`) `primary-500`(타임라인 느낌). "되돌릴 수 없음" 칩 = `neutral-100`/`neutral-600`(append-only 안내).
- 펼침/접힘: `defaultOpen`(최신 true). 접힘 시 헤더+사유 1줄만. 펼칠 때 `onLoadDiff`로 diff 지연 로드(`useKpiSnapshotDiff`) — 로딩 중 `Skeleton` 작은 골격.
- diff 비었으면(변경 0 — 이론상 없음, V5로 차단) "변경 항목 없음".
- **접근성:** `<details>`/`<summary>` 또는 `aria-expanded` 버튼, 사유 `<blockquote>` 시맨틱.

---

## ④-5. RebaselineHistory — 이력 패널 (신규 조립)

```ts
interface RebaselineHistoryProps {
  cycleId: string;
  userId: string | null;           // 선택된 피평가자(없으면 안내)
}
```

- **데이터:** `useKpiSnapshots(cycleId, { userId })`(메타 목록) → label이 "중간 조정 전 …"인 항목 필터(또는 백엔드가 source로 구분). 각 항목 펼침 시 `useKpiSnapshotDiff(cycleId, snapshotId)`.
- **구성:** `Card title="재조정 이력"` + 헤더 우측 "{N}건" + `RebaselineHistoryItem` × N(최신순).
- **상태:**
  - userId 없음 → `EmptyState`("구성원을 선택하면 이력이 보여요.")
  - 이력 0 → `EmptyState`("아직 재조정 이력이 없어요.")
  - 로딩 → `Skeleton`(이력 골격). KPI 표와 **독립 로딩**.
  - 에러/404(백엔드 미배포) → 조용한 폴백 안내("이력을 불러오지 못했어요") — 편집은 계속 가능(기존 useKpiSnapshots 404 폴백 패턴).
- **노출:** 단계 무관 **항상 조회 가능**(편집은 mid_review만, 이력은 언제나).
- **반응형:** lg↑ RB 우측 360 고정, md↓ 표·사유 하단 stacked.

---

## ④-6. RebaselineTable — 재조정 편집 표 (신규)

확정 KPI를 [현재 목표 / 현재 가중치 / → 새 목표 / 새 가중치 / 사유] 로 편집.

```ts
interface RebaselineTableProps {
  rows: RebaselineRow[];
  onChange: (kpiId: string, patch: Partial<RebaselineRow>) => void;
  readOnly?: boolean;              // 단계 ≠ mid_review 또는 권한
}
```

**컬럼:** 과제명(+group 칩, 정성 칩) / 현재 목표 / 현재 가중치 / → 새 목표(입력) / 새 가중치(입력) / 사유(변경 행만 활성).

- **셀 동작:**
  - 현재 목표·현재 가중치: 읽기전용 텍스트(`neutral-500` 약강조 — 비교 기준).
  - 새 목표: `amount/rate/count` = 숫자 input + 단위 suffix(`fmtAmount` 미리보기), `qualitative` = TextField(multiline 1~2줄, `targetText`). **`RebaselineChangedCell`로 래핑**(④-1).
  - 새 가중치: 숫자 input(0~100, %suffix) + `RebaselineChangedCell`. `WeightField` 톤 차용(개별 셀은 합 검증 메시지 없이 입력만 — 합 검증은 WeightSummaryBar 집계).
  - 사유: 행 변경 시 활성 + `*` 필수 표시(error 시 빨강 보더). 미변경 행 = 비활성 회색 "—".
- **편집 불가:** 과제명·group·measureType·정성토글(KPI 정체성). readOnly 시 새 값 열 disabled.
- **스타일:** 헤더 `bg neutral-50` `text-xs` `font-semibold` `neutral-600`. 행 보더 `neutral-200`, radius 0. 숫자 우정렬 `tabular-nums`. 변경 행 살짝 강조(셀 단위는 ④-1).
- **상태:** rows 0 → `EmptyState`("이 구성원의 확정 KPI가 없어요.").
- **반응형:** lg↑ 7열 테이블(`min-w` 가로 스크롤). md↓ 과제별 카드(현재값 라벨 → 새값 입력 세로, 사유 하단). 기존 `ResultTable`/`kpi-import` 반응형 차용.
- **접근성:** `<table>` 시맨틱, 입력 라벨 연결, 변경 셀 "변경됨" 표식, 사유 필수 `aria-required`.

---

## ④-7. ConfirmDialog (Modal 조립 · 저장 확인) — 재사용/경량 조립

기존 `Modal` + `Button`으로 조립(신규 컴포넌트 아님 — 패턴만 명시).

- 트리거: "조정 전 스냅샷 캡처 후 저장" 클릭(검증 통과 시).
- 본문: "재조정을 저장할까요? 변경 {n}개 KPI · 가중치 합 100%. 저장하면 조정 전 값이 '중간 조정 전' 스냅샷으로 보관되고, 이력에 사유·변경자·시각이 기록돼요."
- 액션: secondary "취소" / primary "저장"(`loading=submitting`).
- 접근성: `role="dialog" aria-modal`, 포커스 트랩, ESC.

---

## ④-8. 재사용 컴포넌트 (변경 없이)

| 컴포넌트/훅 | 위치 | ④ 사용 |
|------------|------|--------|
| `AppShell`/`PageContainer`/`PageHeader`/`Breadcrumb` | components/ | RB 셸 |
| `InfoBanner` | components/InfoBanner | 단계 가드·스냅샷 안내(tip/info) |
| `Card`/`Button`/`TextField`/`Modal`/`Toast` | components/ | 표·사유·저장·확인 |
| `UserCombobox` | components/UserCombobox | 피평가자 선택 |
| `EmptyState`/`ErrorState`/`Skeleton`/`Forbidden` | components/States | 상태 |
| `WeightField`(톤 참조) | components/WeightField | 가중치 셀 입력 피드백 차용 |
| `useKpiSnapshots`/`useKpiSnapshotDiff` | hooks/useKpiSnapshots | 이력 목록·diff(재사용) |
| `KpiSnapshotDiff`/`KpiDiffItem`/`KpiDiffField`/`KpiSnapshotMeta` | lib/types | diff 타입(재사용, 메타에 reason/createdByName 보강 가정) |
| `groupChip`/`T`/`fmtAmount`/`fmtPercent`/`kpiGroupLabel` | lib/toss·lib/ui | 칩·포맷 |

---

## ④-9. 토큰 매핑 요약 (④ 신규 한눈에)

| 의미 | 라벨/표식 | bg HEX | fg HEX | DESIGN.md 토큰 |
|------|-----------|--------|--------|----------------|
| 변경 셀 강조 | (좌 바 + 점) | `#EBF3FE` | bar/dot `#3182f6` | primary-50 / primary-500 |
| diff 변경(after) | `→ {값}` | — | `#1B64DA` | primary-600 |
| diff before(기준) | (약한 톤) | — | `#8B95A1` | neutral-500 |
| diff 추가(added) | `+` | `#E7F8EF` | `#0B7544` | success-50 / success-700 |
| diff 제거(removed) | `−` 취소선 | — | `#B0B8C1`(취소선) / 라벨 `#D6303D` | neutral-400 / danger-600 |
| 가중치 합 OK | "100% ✔" | — | `#0F9457` | success-600 |
| 가중치 합 위반 | "100% 필요" | 막대 `#F2A0A6` | `#D6303D` | danger-400 / danger-600 |
| 정성 초과(소프트) | "30% 초과" | — | `#A66800` | warning-700 |
| "되돌릴 수 없음" 칩 | 칩 | `#F2F4F6` | `#6B7684` | neutral-100 / neutral-600 |

> 모든 ④ 강조는 **사각(radius 0)** · 색+텍스트 병기 · 대비 AA. **추가/제거/변경 = success/danger/primary 재사용, 등급(S~D) grade-* 색과 의도적 분리**(요청 명세 준수).

---
---

# 재설계 2026-06-08 — 루틴 가이드형 흐름 · 디자인 정렬 · 사이드바 아이콘

> **목적:** 사용자 불만 3건 해결. ①"단계가 보이는 가이드형 흐름 부재" ②"다른 평가 페이지 디자인 언어 불일치" ③"사이드바 아이콘 누락(`midterm` 키)".
> **범위:** 프론트 화면(page + 서브 컴포넌트)만 변경. 계약·API·백엔드 미변경.
> **소비자:** frontend-engineer(`nextjs-frontend` 스킬).

---

## R0. 핵심 결정 요약

| 결정 | 내용 |
|------|------|
| 단계 모델 | **역할별 5단계(employee) / 4단계(dept_head)** — 상단 고정 Stepper로 진행 상태 노출 |
| 단계 상태 도출 | `MidtermReview.status` + `ActionItem` 존재 여부 + `RebaselineRequest.status` 로 **현재 위치** 결정 |
| 사이드바 아이콘 | `Milestone` (lucide-react) — 중간 경유지 의미, 미사용 확인됨 |
| 디자인 정렬 | `GROUP_CFG` 색(성과중심 `#1B64DA` / 협업·성장 `#029359`), 상태 배지 패턴, `PageHeader` + 주기 셀렉터를 `eval/self` · `kpi/page` 와 동일하게 적용 |
| 신규 컴포넌트 | `MidtermStepper` 경량 1개만 추가. 나머지는 기존 재사용 |

---

## R1. 사이드바 아이콘 지정

**파일:** `apps/web/components/AppShell.tsx`

**변경 내용 — import 추가 + NAV_ICONS 매핑:**

```ts
// import 목록에 추가 (기존 import 블록 끝에 이어서)
import {
  // … 기존 아이콘 …
  Milestone,           // ← 추가
} from 'lucide-react';

// NAV_ICONS 객체에 추가
const NAV_ICONS: Record<string, LucideIcon> = {
  // … 기존 항목 …
  midterm: Milestone,  // ← 추가
};
```

**선택 근거:** `Milestone`은 여정 중간 기준점(마일스톤) 의미로 "상반기 중간 체크포인트" 개념과 정확히 일치. 현재 NAV_ICONS에 미등록 확인(ClipboardList·FileText·CheckSquare·UserCheck·Users·BarChart3·TrendingUp·CalendarDays·Calendar·PieChart·Brain·ClipboardCheck·FileCheck·FileUp·Table2 등 기존 사용 아이콘과 중복 없음).

---

## R2. 단계 모델 정의

### R2-A. Employee(구성원/부서장 본인) — 5단계

| 번호 | 단계명 | 상태 도출 규칙 | 완료 조건 |
|------|--------|---------------|-----------|
| 1 | KPI 진척 확인 | `progress.kpis` 로드 성공 | 항상 "완료"(정보 노출 시점이 곧 확인) |
| 2 | 자가 점검 제출 | `myReview.status` | `status ∈ {self_done, confirmed}` |
| 3 | 부서장 피드백 확인 | `myReview.status` | `status === 'confirmed'` |
| 4 | 보완 조치 수행 | `actionItems.filter(assignee=me)` | 전체 `status ∈ {done, canceled}` OR 빈 리스트 |
| 5 | 목표 재조정 요청 | `latestRebaselineReq?.status` | `status === 'approved'` OR 없음(미요청=완료 간주) |

**현재 활성 단계 결정:**
```ts
function employeeStep(myReview, myItems, rebaselineReq): 1|2|3|4|5 {
  if (!myReview || myReview.status === 'pending') return 2;        // 자가 점검 미제출
  if (myReview.status === 'self_done') return 3;                   // 부서장 피드백 대기
  // confirmed 이후
  const actionsDone = myItems.length === 0 ||
    myItems.every(i => i.status === 'done' || i.status === 'canceled');
  if (!actionsDone) return 4;                                      // 보완 조치 수행 중
  if (rebaselineReq?.status === 'submitted') return 5;            // 재조정 검토 대기
  return 5;                                                        // 모두 완료
}
```

### R2-B. DeptHead(부서장) — 4단계

| 번호 | 단계명 | 상태 도출 규칙 | 완료 조건 |
|------|--------|---------------|-----------|
| 1 | 구성원 진척 검토 | 항상 완료 간주(진입 = 검토 시작) | 항상 완료 |
| 2 | 자가점검 확인·피드백 | `confirmedCount` vs `totalTargets` | `confirmedCount === totalTargets` |
| 3 | 보완 조치 등록 | `allActionItems.length > 0` | 1건 이상 등록 |
| 4 | 재조정 요청 검토 | `pendingRebaselineCount` | `pendingRebaselineCount === 0` |

**현재 활성 단계 결정:**
```ts
function deptHeadStep(confirmedCount, total, itemCount, pendingRbl): 1|2|3|4 {
  if (confirmedCount < total) return 2;                            // 미확인 구성원 존재
  if (itemCount === 0) return 3;                                   // 보완 조치 미등록
  if (pendingRbl > 0) return 4;                                   // 재조정 검토 대기
  return 4;                                                        // 모두 완료
}
```

### R2-C. 단계 상태 enum

```ts
type StepStatus = 'done' | 'active' | 'pending';
```

- `done`: 완료 조건 충족
- `active`: 현재 수행 중(현재 활성 단계)
- `pending`: 아직 시작 전(비활성)

---

## R3. MidtermStepper — 신규 경량 컴포넌트

> 기존 Stepper 컴포넌트 부재 확인. Toss 토큰만 사용하는 경량 신규 컴포넌트.

**파일:** `apps/web/components/MidtermStepper.tsx` (신규 생성)

### Props

```ts
interface StepDef {
  label: string;           // "자가 점검 제출"
  status: StepStatus;      // done | active | pending
  activeLabel?: string;    // active 시 부제목 (예: "지금 하세요")
  doneLabel?: string;      // done 시 부제목 (예: "완료")
}

interface MidtermStepperProps {
  steps: StepDef[];
  /** 현재 활성 스텝 인덱스 (0-based). steps[i].status 로도 도출 가능하지만
   *  명시적 prop으로 받아 단일 진실 유지 */
  activeIndex: number;
}
```

### 레이아웃 스펙

```
┌──────────────────────────────────────────────────────────────────┐
│  ●──────────●──────────●──────────●──────────●                  │
│ [1]KPI확인 [2]자가점검 [3]피드백확인 [4]보완조치 [5]재조정요청  │
│ 완료        지금 하세요  부서장 피드백 대기      -        -       │
└──────────────────────────────────────────────────────────────────┘
```

**상태별 시각 토큰:**

| status | 원 배경 | 원 테두리 | 번호 색 | 라벨 색 | 연결선 색 |
|--------|---------|-----------|---------|---------|-----------|
| `done` | `#3182f6` (blue500) | 없음 | `#fff` | `#191f28` (grey900) | `#3182f6` |
| `active` | `#fff` | `2px solid #3182f6` | `#3182f6` | `#191f28` fontWeight 700 | `#e5e8eb` (grey200) |
| `pending` | `#f2f4f6` (grey100) | `1px solid #e5e8eb` | `#b0b8c1` (grey400) | `#8b95a1` (grey500) | `#e5e8eb` |

**치수:** 원 지름 24px, 라벨 폰트 11px(sm), activeLabel/doneLabel 10px(xs) neutral-500. 스텝 간 연결선 높이 1px, 위치 원 중앙(12px from top).

**반응형:**
- `lg`↑: 가로 일렬(flex-row) — 위 레이아웃.
- `md`↓: 세로 타임라인(flex-col) — 원이 왼쪽, 라벨 오른쪽. 연결선은 왼쪽 수직선.

**접근성:**
```tsx
<ol aria-label="중간 점검 진행 단계">
  {steps.map((s, i) => (
    <li key={i} aria-current={s.status === 'active' ? 'step' : undefined}>
      …
    </li>
  ))}
</ol>
```
- `done` 단계에는 체크 아이콘(CheckCircle2 size=14 흰색) 번호 대신 표시.
- `aria-label`에 "완료됨" / "현재 단계" / "대기 중" 포함.

---

## R4. 화면 레이아웃 재구성

### R4-A. page.tsx 섹션 순서 (변경 지시)

```
PageContainer
  └── PageHeader (title="중간 점검", subtitle, cycles 셀렉터)   ← 기존 유지
  └── InfoBanner (비구속 안내)                                   ← 기존 유지
  └── [신규] MidtermStepper                                      ← 추가
        · employee/부서장 본인이면 employeeStep 5단계
        · isDeptHead이면 deptHeadStep 4단계
        · isHr이면 Stepper 없음(HR은 조직 모니터링만)
  └── [기존] DeptHeadMidterm (isDeptHead)
  └── [기존] EmployeeMidterm (!isHr)
  └── [기존] OrgProgressCard (isHr || isDeptHead)
```

**Stepper 데이터 연결(page.tsx에서 내려보낼 props):**

```ts
// page.tsx 에서 Stepper 상태 계산 — 필요 hook 추가
// employee 관점: myReview, myActionItems, myRebaselineReq 필요
//   → 현재 EmployeeMidterm 내부 훅을 page로 끌어올리거나
//   → EmployeeMidterm에 onStepChange 콜백으로 currentStep을 부모에 전달.
//   권장: EmployeeMidterm에 stepStatus prop (StepStatus[]) 반환 콜백 추가.
//         DeptHeadMidterm도 동일하게 deptHeadStepStatus 반환.
// page.tsx가 두 역할 Stepper를 각각 렌더.
```

> 구현 간결화 옵션: page.tsx에서 Stepper 전용 훅(`useMidtermStepStatus`)을 별도 정의해 useAuth/useCurrentCycle과 함께 마운트. EmployeeMidterm·DeptHeadMidterm 내부 훅과 동일 파라미터 호출 — 리소스 중복 허용(두 번 fetch가 부담이면 컨텍스트로 공유).

### R4-B. EmployeeMidterm.tsx 변경 지시

**현재:** Card 4개(KPI진척 / 자가점검 / 보완조치 / 목표재조정)를 단순 세로 스택.

**변경:**
1. 각 Card 헤더 좌측에 **단계 번호 칩** 추가 — 소형 사각형 칩(14×14, fontSize 10, fontWeight 700).
   - 색 = 해당 단계 status에 따라 done:`#3182f6` bg + `#fff` / active:`#EBF3FE` bg + `#1B64DA` fg / pending:`#F2F4F6` bg + `#B0B8C1` fg.
2. **자가 점검 Card**: 현재 `<Card title="자가 점검">` → `<Card title="② 자가 점검 제출">` 로 변경. Card 테두리 `active` 시 `border-color: #3182f6 1px`.
3. **보완 조치 Card**: `<Card title="④ 보완 조치 수행">` 빈 상태 텍스트 = "부서장이 보완 조치를 등록하면 여기서 진행 상태를 갱신할 수 있어요." (기존 "아직 배정된 보완 조치가 없어요."보다 상황 설명).
4. **KPI 진척 Card 그룹 헤더**: `eval/self` 동일 `GROUP_CFG` 색 바(4px 좌측 라인)를 `MidtermProgressTable` 내부 그룹 섹션 헤더에 적용(성과중심 `#1B64DA` / 협업·성장 `#029359`). `MidtermProgressTable` 컴포넌트의 `variant="self"` 에 그룹 섹션 헤더 추가.

### R4-C. DeptHeadMidterm.tsx 변경 지시

1. **구성원 리스트 사이드 패널**: 현재 `Card title="구성원 점검"` → `Card title="① 구성원 진척 검토 · ② 자가점검 확인"` 로 단계 의미 명시. 단계 번호 칩 불필요(부서장 Stepper가 상단에서 전체 진행 표시).
2. **MemberDetail 내 Subsection 순서**: KPI진척 → 구성원자가점검 → 부서장확인 → 보완조치 (기존 순서 동일 — 변경 없음).
3. **부서장 확인 Subsection**: 자가점검 미제출(`!selfSubmitted`) 상태 안내 텍스트 강화:
   - 현재: "구성원 자가 점검 제출 후 확인할 수 있어요." (작은 회색 span)
   - 변경: `InfoBanner tone="info"` (기존 inline span → 배너로 격상) "구성원이 자가 점검을 제출하면 피드백을 작성하고 확인할 수 있어요."

### R4-D. OrgProgressCard.tsx — 변경 없음

HR/부서장 조직 진척 요약 카드. 현재 디자인 유지.

---

## R5. 디자인 정렬 — eval/self · kpi/page 기준 매핑

아래 항목을 현재 midterm 화면의 동일 위치에 적용한다.

| 요소 | eval/self 기준값 | midterm 적용 위치 |
|------|----------------|------------------|
| 그룹 헤더 좌측 바 | `width:4px height:15px background:cfg.bg` | MidtermProgressTable 그룹 섹션 헤더 |
| 그룹 라벨 색 | 성과중심 `#1B64DA` / 협업·성장 `#029359` | MidtermProgressTable group 칩 + 헤더 |
| 상태 배지 패턴 | `px-3 py-1.5 text-white fontSize:11 fontWeight:600` | ReviewBadge (DeptHeadMidterm) |
| 카드 테두리 | `border: 1px solid ${T.grey200}` | 모든 Card — 기존 유지 |
| PageHeader right 슬롯 | 상태 배지 + 임시저장 + 제출 버튼 | page.tsx right 슬롯에 "중간 점검 기간" 뱃지 표시 |
| 빈 상태 카드 구조 | `px-5 py-10 text-center` + primary CTA | EmployeeMidterm 빈 상태 통일 |
| 하단 액션 바 | `border px-4 py-3 flex items-center justify-between` | EmployeeMidterm 자가점검 카드 하단 |
| InfoBanner 위치 | 본문 최상단 | page.tsx 비구속 안내 — 기존 위치 유지 |

**상태 배지(page.tsx right 슬롯):**

```ts
// isMidReview 시 "점검 기간" 배지, 아니면 cycleStatusLabel 배지.
const midtermBadge = {
  label: isMidReview ? '점검 기간' : cycleStatusLabel[current.status],
  bg: isMidReview ? T.blue500 : T.grey500,
};
// PageHeader right 슬롯:
<span
  className="px-3 py-1.5 text-white"
  style={{ fontSize: 11, fontWeight: 600, background: midtermBadge.bg }}
>
  {midtermBadge.label}
</span>
```

---

## R6. 파일별 변경 지시 (frontend 구현 단위)

| 파일 | 변경 유형 | 핵심 변경 내용 |
|------|-----------|---------------|
| `apps/web/components/AppShell.tsx` | 수정 | `Milestone` import 추가, `NAV_ICONS.midterm = Milestone` 추가 |
| `apps/web/components/MidtermStepper.tsx` | **신규 생성** | §R3 스펙 전체 구현 |
| `apps/web/app/(main)/eval/midterm/page.tsx` | 수정 | ① Stepper 추가(역할 분기), ② PageHeader right 슬롯에 상태 배지, ③ `useMidtermStepStatus` 훅 또는 인라인 상태 계산 |
| `apps/web/app/(main)/eval/midterm/EmployeeMidterm.tsx` | 수정 | ① Card 제목에 단계 번호 포함, ② 빈 상태 텍스트 개선, ③ active 카드 테두리 강조 |
| `apps/web/app/(main)/eval/midterm/DeptHeadMidterm.tsx` | 수정 | ① Card 제목 단계 의미 명시, ② 부서장 확인 Subsection의 미제출 안내를 InfoBanner로 격상 |
| `apps/web/components/MidtermProgressTable.tsx` | 수정 | 그룹 섹션 헤더(4px 좌측 바 + 그룹 라벨) 추가, GROUP_CFG 색 적용 |

---

## R7. MidtermStepper 구현 참고 코드 (경량)

```tsx
// apps/web/components/MidtermStepper.tsx
'use client';

import { CheckCircle2 } from 'lucide-react';
import { T } from '@/lib/toss';

export type StepStatus = 'done' | 'active' | 'pending';

export interface StepDef {
  label: string;
  subLabel?: string;  // done이면 "완료", active이면 "지금 하세요" 등
  status: StepStatus;
}

const STEP_TOKEN = {
  done:    { circleBg: T.blue500,  circleBorder: 'none',              numColor: '#fff',          labelColor: T.grey900, labelWeight: 600 },
  active:  { circleBg: '#fff',     circleBorder: `2px solid ${T.blue500}`, numColor: T.blue500,  labelColor: T.grey900, labelWeight: 700 },
  pending: { circleBg: T.grey100,  circleBorder: `1px solid ${T.grey200}`, numColor: T.grey400,  labelColor: T.grey500, labelWeight: 400 },
} satisfies Record<StepStatus, object>;

export function MidtermStepper({ steps }: { steps: StepDef[] }) {
  return (
    <ol
      aria-label="중간 점검 진행 단계"
      className="flex flex-col gap-3 md:flex-row md:items-start md:gap-0"
      style={{ padding: '12px 16px', background: '#fff', border: `1px solid ${T.grey200}` }}
    >
      {steps.map((step, i) => {
        const tk = STEP_TOKEN[step.status];
        const isLast = i === steps.length - 1;
        return (
          <li
            key={i}
            aria-current={step.status === 'active' ? 'step' : undefined}
            className="flex flex-1 flex-row items-center gap-2 md:flex-col md:items-center"
          >
            {/* 원 + 번호/체크 */}
            <span
              style={{
                width: 24, height: 24, borderRadius: '50%',
                background: tk.circleBg,
                border: tk.circleBorder,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              {step.status === 'done' ? (
                <CheckCircle2 size={14} color="#fff" />
              ) : (
                <span style={{ fontSize: 10, fontWeight: 700, color: tk.numColor }}>{i + 1}</span>
              )}
            </span>

            {/* 라벨 */}
            <span className="flex flex-col md:items-center">
              <span style={{ fontSize: 11, fontWeight: tk.labelWeight, color: tk.labelColor }}>
                {step.label}
              </span>
              {step.subLabel && (
                <span style={{ fontSize: 10, color: T.grey500, marginTop: 1 }}>{step.subLabel}</span>
              )}
            </span>

            {/* 연결선 (마지막 제외) — lg에서만 표시 */}
            {!isLast && (
              <span
                aria-hidden="true"
                className="hidden flex-1 md:block"
                style={{ height: 1, background: step.status === 'done' ? T.blue500 : T.grey200, marginTop: -16 /* 원 중앙 정렬 보정 */ }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
```

> **연결선 레이아웃 주의:** 가로 레이아웃에서 `<li>` 사이 연결선을 각 `<li>` 내부 끝 요소로 삽입하면 Flex 배치가 자연스럽다. 정확한 중앙 정렬은 구현 시 `relative/absolute` + top 보정으로 확인.

---

## R8. 비구속 안내 · CTA 개선 (UX)

### 구성원 관점 — "지금 뭘 하면 되는지" CTA

Stepper의 `active` 단계 `subLabel`에 행동 지시를 노출한다.

| 활성 단계 | subLabel | 카드 CTA |
|-----------|----------|---------|
| 2 (자가 점검) | "작성 후 제출하세요" | 자가 점검 Card를 Stepper 바로 아래로 스크롤 또는 Card 테두리 강조 |
| 3 (피드백 확인) | "부서장 피드백 대기 중" | 피드백 Card에 대기 안내 `InfoBanner` |
| 4 (보완 조치) | "진행 상태를 갱신하세요" | ActionItemRow 상태 토글 강조 |
| 5 (재조정) | "필요 시 요청하세요" | 재조정 Card CTA 버튼 primary |

### 부서장 관점

| 활성 단계 | subLabel |
|-----------|----------|
| 2 (확인·피드백) | "N명 미확인" |
| 3 (보완 조치) | "조치를 등록하세요" |
| 4 (재조정 검토) | "N건 검토 대기" |

### 비구속 안내 배너 개선

기존: `InfoBanner tone="tip"` 텍스트가 단순 설명.

변경 후 구조:
```tsx
<InfoBanner tone="tip" title="중간평가는 점검·코칭 단계예요">
  등급·연봉에 반영되지 않아요. 아래 단계를 따라 진척을 점검하고 하반기 방향을 잡아요.
</InfoBanner>
```

`isMidReview === false` 시:
```tsx
<InfoBanner tone="info" title={`지금은 점검 기간이 아니에요 (${cycleStatusLabel[current.status]})`}>
  현재 단계에서는 조회만 할 수 있어요. 입력·제출·확인은 mid_review 기간에 열려요.
</InfoBanner>
```

---

## R9. 토큰 정리 (Stepper 신규)

| 의미 | 토큰 | HEX |
|------|------|-----|
| 스텝 done 원 배경 | `blue500` | `#3182f6` |
| 스텝 active 테두리 | `blue500` | `#3182f6` |
| 스텝 active 번호 색 | `blue500` | `#3182f6` |
| 스텝 active 라벨 | `grey900` fontWeight 700 | `#191f28` |
| 스텝 pending 원 배경 | `grey100` | `#f2f4f6` |
| 스텝 pending 번호 색 | `grey400` | `#b0b8c1` |
| 스텝 pending 라벨 | `grey500` | `#8b95a1` |
| done 연결선 | `blue500` | `#3182f6` |
| pending 연결선 | `grey200` | `#e5e8eb` |
| active 카드 테두리 강조 | `blue500` 1px | `#3182f6` |

> 모든 Stepper 요소 **색+라벨 병기** (done=체크 아이콘+번호, active=테두리 강조+subLabel 텍스트, pending=회색). `aria-current="step"` 접근성 준수.

