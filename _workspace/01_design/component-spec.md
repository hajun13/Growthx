# 컴포넌트 스펙 — 인사평가 솔루션 (도메인 대정정 반영 · v2)

> **소비자:** frontend-engineer 구현 명세. **토큰:** `design-tokens.md` 키 사용. **화면 조립:** `wireframes.md`.
> **컴포넌트명은 확정값**(frontend가 그대로 사용). props 타입은 TS 표기. 공통: 대비 AA, 키보드 포커스(`shadow-focus`), `prefers-reduced-motion` 존중.

## ⚠️ v2 변경 요약
- **제거:** `RadarChart`(역량 레이더), `ScatterPlot`(산점도), 역량 차원(`Dimension`) 타입, 다면 유형(peer/upward).
- **재정의:** `GradeRadio` → **부서장 평가의 등급 부여 전용**(본인평가 역량용 아님). `Tabs`는 KPI **group**(성과중심/협업·성장) 탭.
- **추가:** `KpiCard`, `AchievementField`, `DistributionBarChart`, `PoolGauge`, `ResultTable`.

## 공통 타입 (도메인 정정)

```ts
type Grade = 'S' | 'A' | 'B' | 'C' | 'D';
type KpiGroup = 'performance_core' | 'collaboration_growth';
type KpiCategory = 'revenue' | 'construction' | 'orders' | 'collaboration' | 'development';
type MeasureType = 'amount' | 'rate' | 'count' | 'qualitative';
type EvalType = 'self' | 'downward';            // peer/upward 없음
type EvalStatus = 'not_started' | 'in_progress' | 'submitted' | 'finalized';
type KpiStatus = 'draft' | 'submitted' | 'approved' | 'confirmed' | 'rejected' | 'revision_requested';
type AppealStatus = 'submitted' | 'under_review' | 'answered' | 'closed';
type Role = 'hr_admin' | 'division_head' | 'team_lead' | 'employee';
type Position = 'ceo' | 'division_head' | 'team_lead' | 'chief' | 'senior' | 'pro';
type PoolTier = 'excellent' | 'standard' | 'poor';
```

> **`Dimension` 타입 삭제.** 평가는 KPI 성과(`KpiScore`)로만 구성. 역량 차원 enum 없음.

---

## 1. AppShell

전역 레이아웃(상단탭 + 역할별 사이드바 + 본문 슬롯 + 우하단 고정 액션).

```ts
interface AppShellProps {
  role: Role;
  user: { name: string; positionLabel: string; departmentName: string };
  activeMenu: string;            // 현재 라우트 키
  notificationCount?: number;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };
  children: React.ReactNode;
}
```
- **상태/변형:** 사이드바 메뉴는 `role`로 필터(`wireframes.md` G 가시성 표). hr_admin 전용 메뉴(그룹풀·보상·설정)는 비-hr 역할에 렌더 안 함. 우하단 액션은 `primaryAction` 있을 때만(`shadow-lg` 바).
- **반응형:** `lg`↑ 사이드바 고정(240). `lg` 미만 → 햄버거 + 드로어(`overlay`). `md`↓ 우하단 액션은 하단 full-width 고정 바.
- **접근성:** `<nav aria-label="주 메뉴">`, 활성 메뉴 `aria-current="page"`. 드로어 포커스 트랩. 종 버튼 `aria-label="알림 N건"`.

## 2. WeekScheduleCalendar

주차별 7열 평가 일정. 단계 기간 바 + 상태 배지. **다면 단계 없음.**

```ts
interface SchedulePhase {
  key: 'prepare' | 'self' | 'downward_1' | 'downward_2' | 'result';
  label: string;
  startDate: string; endDate: string;     // ISO
  status: 'done' | 'active' | 'upcoming' | 'locked';
  badge?: string;                          // 예: "3명 미완료"
}
interface WeekScheduleCalendarProps {
  weeks: { weekLabel: string; days: string[] }[]; // days 길이 7 (일~토)
  phases: SchedulePhase[];
  onPhaseClick?: (key: SchedulePhase['key']) => void;
}
```
- **상태/변형:** 바 색 — `active`=`primary-500`(채움), `done`=`success-500`(연), `upcoming`=`neutral-200`, `locked`=`neutral-100`+자물쇠. 각 바에 `StatusBadge`.
- **반응형:** `lg`↑ 7열 그리드. `md`↓ 주차별 세로 리스트.
- **접근성:** `role="grid"`, 바에 `aria-label`("본인평가, 6월3주, 진행중"). 색+텍스트 병기.

## 3. ProcessFlow

평가 프로세스 단계 흐름(가로 화살표). 단계 = 평가준비→본인평가→1차 팀장→2차 본부장→결과.

```ts
interface FlowStep { key: 'prepare'|'self'|'downward_1'|'downward_2'|'result'; label: string; state: 'done' | 'current' | 'upcoming' | 'locked'; }
interface ProcessFlowProps { steps: FlowStep[]; }
```
- **변형:** current=`primary-500`(채움 원+굵게), done=`success-500` 체크, upcoming=`neutral-300`, locked=흐림+자물쇠. 화살표 연결.
- **반응형:** `md`↓ 세로 스텝퍼.
- **접근성:** `<ol>` 시맨틱, current `aria-current="step"`. 상태 텍스트 병기.

## 4. KpiCard

KPI(과제) 카드 — 작성(K1)·검토(K2)·본인평가(S3) 공용. category·group·measureType 뱃지.

```ts
interface KpiCardData {
  id: string;
  category: KpiCategory; group: KpiGroup; measureType: MeasureType;
  coreStrategy: string;        // 핵심전략
  title: string;               // 과제명
  csf?: string; measureMethod?: string;
  targetValue?: number; unit?: string;   // 목표값·단위(억/건/%)
  weight: number;              // %
  isQualitative: boolean;
  parentKpiTitle?: string;     // 상위연계 표시
  status?: KpiStatus;
}
interface KpiCardProps {
  data: KpiCardData;
  mode: 'edit' | 'review' | 'self';    // 작성/검토/본인평가
  onChange?: (patch: Partial<KpiCardData>) => void;
  onRemove?: () => void;
  children?: React.ReactNode;          // self 모드: AchievementField 등 슬롯
}
```
- **뱃지:** group(`성과중심`=primary 톤·`협업·성장`=success 톤) + category 한글 칩 + measureType 칩. 정성이면 `정성` 칩(warning 톤).
- **상태/변형:** `edit`=입력 필드(Select·TextField·WeightField). `review`=읽기 + 상위연계 체크. `self`=핵심전략·측정방식 읽기 + 슬롯(실적/점수). `status` 있으면 `StatusBadge`.
- **반응형:** `md`↓ 1열 스택.
- **접근성:** 카드 헤더 `aria-label`(과제명+그룹+카테고리). 뱃지 색+텍스트 병기.

## 5. AchievementField

실적 입력 → 달성률/건수 → 등급 자동 표시(본인평가 S3). **계산은 백엔드, 표시만.**

```ts
interface AchievementFieldProps {
  measureType: MeasureType;
  targetValue?: number; unit?: string;
  actualValue?: number;                // 입력값
  achievementRate?: number;            // % (amount/rate, 백엔드 산정)
  count?: number;                      // count 방식 실적 건수
  autoGrade?: Grade | null;            // 자동 산출 등급(백엔드)
  qualitativeNote?: string;            // qualitative: 서술
  onChange?: (v: { actualValue?: number; count?: number; qualitativeNote?: string }) => void;
  readOnly?: boolean;
}
```
- **변형(measureType별):**
  - `amount`/`rate`: 목표/실적 입력 → "달성률 105% → A" 자동 표시(`GradeChip` soft).
  - `count`: 목표/실적 건수 → 임계값 기준 "18건 → A" 표시.
  - `qualitative`: 정성 서술 textarea. **등급은 자동 산출 안 함**(부서장 평가에서 부여) — "정성 평가는 부서장이 등급을 부여해요" 안내.
- **상태:** 미입력(빈, autoGrade null) / 입력완료(등급 표시) / readOnly(제출 후).
- **접근성:** 입력 라벨, 자동 등급은 `aria-live="polite"`로 변경 안내. 색만 의존 금지.

## 6. GradeRadio — 부서장 평가 등급 부여 전용

S/A/B/C/D 단일 선택. **부서장 평가(S6)에서 평가자가 종합 등급을 부여**할 때만 사용. (본인평가 역량용 아님 — 역량 평가 폐기.)

```ts
interface GradeRadioProps {
  name: string;
  value?: Grade | null;        // null = 미부여
  onChange?: (g: Grade) => void;
  readOnly?: boolean;          // 제출 후
  disabled?: boolean;
  disabledGrades?: Grade[];    // 그룹 풀 상한 소진 등급(선택 차단)
  options?: Grade[];           // 기본 ['S','A','B','C','D']
}
```
- **상태/변형:** 미부여(전부 비선택, 보더 `neutral-300`) / 선택(선택 칸 `primary-50`+`primary-500` 보더+등급 라벨) / `disabledGrades`(풀 소진 → 흐림+자물쇠 툴팁 "풀 상한이 소진됐어요") / readOnly(선택값만 강조). 라벨(S~D) 텍스트 필수.
- **반응형:** 가로 5칸. `sm` 폭 부족 시 균등 축소(min 44px 터치 타깃).
- **접근성:** `role="radiogroup"` + 각 `role="radio"`, `aria-checked`, disabled 옵션 `aria-disabled`. 화살표 키 이동.

## 7. GradeChip

등급 표시 칩(읽기 전용). `KpiScore`·`AchievementField`·`ComparisonBar`·결과 공용.

```ts
interface GradeChipProps {
  grade: Grade;
  size?: 'sm' | 'md';
  variant?: 'solid' | 'soft';  // solid=grade-*-solid+흰텍스트, soft=grade-*-bg+grade-*-fg
  showScore?: number;          // "B 88.0"
}
```
- **변형:** C는 solid 대비 경계 → 기본 `soft`. 막대 내부에선 solid 허용. 항상 등급 문자 표시.
- **접근성:** `aria-label="등급 B, 88점"`. `radius-full`, `text-xs`/`sm`.

## 8. WeightField

가중치 입력 + 합계 100 검증 + 정성 ≤30% + 그룹 비율 표시.

```ts
interface WeightFieldProps {
  value: number;               // 0~100
  onChange?: (v: number) => void;
  groupTotal: number;          // 같은 group 합계(부모 계산)
  group?: KpiGroup;            // 성과중심/협업·성장 (비율 표시용)
  readOnly?: boolean;
  isQualitative?: boolean;     // 정성 ≤30% 정책 표시
}
```
- **상태/변형:** 전체 합 `=100` 정상 / `≠100` → `danger-500` 보더+캡션 "가중치 합이 100%가 되어야 해요". 정성 합 `>30%` → `warning-500` 주의. `group` 비율(성과중심 70/80·협업성장 20/30) 충족 여부 캡션. **검증 최종 책임은 백엔드**, 프론트는 즉시 피드백.
- **접근성:** `<input type="number">` + 라벨, 에러 `aria-invalid`+`aria-describedby`.

## 9. ScoreCard

과제/종합 최종 점수 + 달성률/건수 요약.

```ts
interface ScoreCardProps {
  score: number;               // 92.00
  measureType?: MeasureType;
  achievementRate?: number;    // amount/rate
  count?: number;              // count
  grade?: Grade;               // GradeChip 병기
  weight?: number;
  label?: string;              // "과제 최종점수"
}
```
- **변형:** 점수 `text-3xl tabular-nums`. measureType에 따라 달성률(%) 또는 건수 보조 행. `grade` 있으면 우상단 `GradeChip`.
- **접근성:** 수치 라벨 명시. 등급 매핑은 표시만(백엔드 산정).

## 10. ProgressDonut

완료율 도넛(본인평가 진행률·모니터링).

```ts
interface ProgressDonutProps {
  done: number; total: number;
  size?: number;               // px, 기본 64
  label?: string;
}
```
- **변형:** 채움 `primary-500`, 트랙 `neutral-200`, 0%면 트랙만. 중앙 "3/5" 또는 "60%".
- **접근성:** `role="img" aria-label="완료 3/5, 60%"`. 색+텍스트 병기.

## 11. DistributionBarChart — 그룹 등급 풀 분포 + 상한 마커

S~D 등급 분포 막대 + 그룹 풀 **상한 마커**. 부서장 평가(S6)·그룹풀(M1)·모니터링(M2).

```ts
interface DistributionBarChartProps {
  counts: Record<Grade, number>;       // 현재 배정 인원
  caps?: Record<Grade, number>;        // 그룹 풀 상한(인원). 초과 시 danger
  tier?: PoolTier;                     // 그룹 tier 라벨
  total: number;
  avg?: number;                        // 평균 점수(옵션)
}
```
- **변형:** 각 등급 막대 `grade-*-solid`. `caps` 있으면 상한 위치에 점선 마커(`pool-cap-marker`). `counts > caps`면 해당 막대 `danger-500` + "풀 초과" 라벨. tier 배지(excellent/standard/poor).
- **반응형:** `md`↓ 가로 막대 리스트로 전환.
- **접근성:** `role="img"` 전체 `aria-label`(등급별 인원/상한). 각 막대 텍스트 수치 병기. 초과는 색+"초과" 텍스트.

## 12. PoolGauge — 풀 잔여

등급별 풀 잔여(상한 − 배정)를 게이지로 표시. 부서장 평가에서 등급 부여 가능 여부 안내.

```ts
interface PoolGaugeProps {
  grade: Grade;
  used: number; cap: number;   // 배정/상한
}
```
- **변형:** 잔여 `cap-used`. 잔여 0이면 `danger` "소진", 잔여 ≤1 `warning`. 게이지 채움 `grade-*-solid`.
- **접근성:** `aria-label="S등급 풀 1/2 사용, 잔여 1"`. 색+텍스트.

## 13. ComparisonBar — self/d1/d2 비교 + 전사평균

평가 유형별 가로 막대 비교. **3행: self / downward1(팀장) / downward2(본부장).** peer/upward 없음.

```ts
interface ComparisonRow {
  type: EvalType; round?: 1 | 2;
  label: string;               // "1차 팀장" / "2차 본부장"
  score: number; grade: Grade;
}
interface ComparisonBarProps {
  rows: ComparisonRow[];       // self, downward r1, downward r2
  companyAvg: number;          // 전사 평균(세로 마커)
  max?: number;                // 기본 100
}
```
- **변형:** 막대 색 — self=`chart-self`, downward1=`chart-downward-1`, downward2=`chart-downward-2`. 막대 끝에 `GradeChip`(soft)+점수. 전사평균 `chart-company-avg` 점선 세로 마커+라벨.
- **반응형:** `md`↓ 막대 폭 축소, 라벨 위로.
- **접근성:** 각 막대 `aria-label`("2차 본부장 평가, B등급 88점, 전사평균 88점"). 색만 의존 금지.

## 14. ResultTable — 결과 테이블 (직책 체계)

평가 결과 표. 모니터링(M2)·결과 과제별(S7)·보상(M4) 공용. 직책(position) 컬럼.

```ts
interface ResultTableColumn { key: string; label: string; align?: 'left'|'right'|'center'; }
interface ResultTableProps {
  columns: ResultTableColumn[];
  rows: Record<string, React.ReactNode>[];  // 셀 값(GradeChip·StatusBadge 등 노드 허용)
  onRowClick?: (row: Record<string, React.ReactNode>) => void;  // 개인 리포트 진입
  sortable?: boolean;
}
```
- **변형:** 헤더 `neutral-50` 배경. 등급 셀은 `GradeChip`, 상태 셀은 `StatusBadge`. 직책은 한글 라벨(대표이사·본부장·팀장·책임·선임·프로). 행 hover `neutral-50`, 클릭 시 리포트 진입.
- **반응형:** `md`↓ 카드 리스트(라벨:값 쌍)로 전환.
- **접근성:** `<table>` 시맨틱, 정렬 헤더 `aria-sort`. 행 클릭은 키보드 가능(`role`/`tabindex` 또는 행 내 링크).

## 15. StatusBadge

평가/KPI/이의제기 상태 배지.

```ts
interface StatusBadgeProps {
  status: EvalStatus | KpiStatus | AppealStatus | PoolTier;
  count?: number;              // "3명 미완료"
}
```
- **변형(전역 시맨틱, `design-tokens.md` §1.6):**
  - `not_started`/`draft` → not-started 톤 · `in_progress`/`approved`/`under_review` → in-progress 톤
  - `submitted` → submitted 톤 · `finalized`/`confirmed`/`closed`/`answered` → finalized 톤
  - `rejected`/`revision_requested` → danger 톤. tier: excellent→success·standard→neutral·poor→warning.
- **접근성:** `radius-full`, `text-xs`. 한글 라벨 + 색. `aria-label` 상태 풀텍스트.

## 16. CommentThread — 코멘트 의무화 가드

평가 코멘트 이력. 부서장 평가(S6)·KPI 검토(K2)·결과(S7)·이의제기(M3). **코멘트 필수 정책 반영.**

```ts
interface CommentItem {
  id: string; authorName: string; authorRole: Role;
  round?: 1 | 2; quarter?: 1 | 2 | 3 | 4; content: string; createdAt: string;
}
interface CommentThreadProps {
  comments: CommentItem[];
  editable?: boolean;          // 평가자 작성 가능
  required?: boolean;          // 미작성 시 제출 차단 표시
  onAdd?: (content: string, round?: number) => void;
}
```
- **변형:** 아바타(이니셜)+작성자(역할/round)+분기 칩. `editable`이면 하단 입력. `required`이고 비었으면 `danger` "코멘트를 작성해야 제출할 수 있어요".
- **상태:** 빈 "아직 코멘트가 없어요." · 읽기전용(작성 영역 숨김).
- **접근성:** 리스트 시맨틱, 입력 라벨.

## 17. EvidenceUpload

증빙 첨부(단일 파일, 10MB). 본인평가(S3).

```ts
interface EvidenceUploadProps {
  value?: { url: string; name: string } | null;
  onUpload?: (file: File) => void;
  onRemove?: () => void;
  maxSizeMB?: number;          // 기본 10
  accept?: string;             // 기본 ".pdf,.png,.jpg,.xlsx,.docx"
  readOnly?: boolean;
}
```
- **상태/변형:** 빈(드롭존) / 업로드중(progress) / 완료(파일명+제거) / 초과·형식오류(`danger` 캡션). readOnly는 다운로드 링크만.
- **접근성:** `<input type="file">` 라벨 연결, 드롭존 키보드 트리거. 에러 `aria-describedby`.

## 18. Tabs

KPI **group** 탭(본인평가: 성과중심/협업·성장) 등. (역량 차원 탭 아님.)

```ts
interface TabItem { key: string; label: string; disabled?: boolean; badge?: string | number; }
interface TabsProps { items: TabItem[]; activeKey: string; onChange: (key: string) => void; }
```
- **변형:** 활성 탭 밑줄 `primary-500`+`font-semibold`, 비활성 `neutral-600`. disabled 흐림. badge 칩(미입력 수 등).
- **반응형:** 넘침 시 가로 스크롤.
- **접근성:** `role="tablist"`/`tab`/`tabpanel`, `aria-selected`, 화살표 키 이동.

## 19. Select

드롭다운(category·group·measureType·상위 KPI·범위·주기).

```ts
interface SelectOption { value: string; label: string; disabled?: boolean; }
interface SelectProps {
  label?: string; value: string; options: SelectOption[];
  onChange: (v: string) => void; placeholder?: string;
  disabled?: boolean; error?: string;
}
```
- **변형:** 닫힘(보더 `neutral-300`)/열림(`primary-500` 링)/disabled/error. 옵션 hover `primary-50`.
- **접근성:** `role="combobox"`/`listbox`, 키보드 탐색, `aria-expanded`.

## 20. Button

```ts
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean; loading?: boolean; disabled?: boolean;
  leftIcon?: ReactNode; onClick?: () => void; children: ReactNode;
}
```
- **변형:** primary=`primary-500`/hover `primary-600` · secondary=`neutral-0`+`neutral-300` 보더 · ghost=투명+`neutral-700` · danger=`danger-500`. disabled=`neutral-200`+`neutral-400`. loading=스피너+라벨 유지+비활성.
- **치수:** sm h32 / md h40 / lg h48, `radius-md`. 우하단 고정 Primary는 화면당 1개.
- **접근성:** `<button>`, loading `aria-busy`. 포커스 `shadow-focus`.

## 21. TextField

```ts
interface TextFieldProps {
  label: string; value: string; onChange: (v: string) => void;
  type?: 'text' | 'email' | 'password' | 'number';
  multiline?: boolean; rows?: number;
  placeholder?: string; required?: boolean;
  error?: string; hint?: string; readOnly?: boolean; disabled?: boolean;
  suffix?: string;             // "%", "억", "건" 등 단위
}
```
- **변형:** 기본 보더 `neutral-300`/포커스 `primary-500` 링 · error `danger-500` 보더+하단 에러 · disabled `neutral-100`. multiline=textarea. suffix 단위.
- **접근성:** `<label htmlFor>`, error `aria-invalid`+`aria-describedby`, required `aria-required`.

## 22. Card

```ts
interface CardProps {
  title?: string; action?: ReactNode; padding?: 'sm' | 'md';
  elevation?: 'sm' | 'md'; children: ReactNode;
}
```
- **변형:** 배경 `neutral-0`, `radius-md`(콘텐츠)·`radius-lg`(패널), `shadow-sm`/`shadow-md`(강조), 보더 `neutral-200`. 헤더(title+action) 옵션.
- **반응형:** 그리드 안에서 `md`↓ 1열 스택.

## 23. Modal

```ts
interface ModalProps {
  open: boolean; onClose: () => void;
  title: string; children: ReactNode;
  primaryAction?: { label: string; onClick: () => void; variant?: 'primary' | 'danger'; loading?: boolean };
  secondaryAction?: { label: string; onClick: () => void };
  size?: 'sm' | 'md' | 'lg';
}
```
- **변형:** `radius-lg`, `shadow-lg`, 딤 `overlay`. 삭제/반려는 `variant='danger'`. size sm 400/md 560/lg 720.
- **반응형:** `md`↓ 하단 시트, full-width.
- **접근성:** `role="dialog" aria-modal`, 포커스 트랩, ESC 닫기, 포커스 복귀, `aria-labelledby`.

## 24. Toast

```ts
interface ToastOptions {
  variant: 'success' | 'danger' | 'info';
  message: string; duration?: number;  // 기본 3000ms
}
// toast.show(options) — 전역 provider
```
- **변형:** success=`success-500`, danger=`danger-500`, info=`primary-500` 좌측 바+아이콘. 하단 중앙/우하단 스택.
- **접근성:** `role="status"`(success/info)/`role="alert"`(danger), `aria-live`. `reduced-motion` 시 페이드만.

---

## 컴포넌트 ↔ 화면 매핑 (구현 점검표)

| 컴포넌트 | 사용 화면 |
|----------|----------|
| AppShell | 전역(0 제외) |
| WeekScheduleCalendar, ProcessFlow | S1 |
| KpiCard | K1, K2, S3 |
| AchievementField | S3 |
| GradeRadio | **S6(부서장 등급 부여)** |
| GradeChip | S3, S6, S7, M2 |
| WeightField | K1, K2, S3(읽기), M5 |
| ScoreCard | S3(우 패널), S6, S7 |
| ProgressDonut | S1, S3, M2 |
| DistributionBarChart | S6, M1, M2, M4 |
| PoolGauge | S6, M1 |
| ComparisonBar | S7 |
| ResultTable | S7(과제별), M2, M4 |
| CommentThread | K2, S6, S7, M3 |
| EvidenceUpload | S3 |
| StatusBadge | S1, K1, K2, S3, S6, S7, M1~M4 |
| Tabs | S3(group), M5(설정) |
| Select | K1, K2, M1, M2, M4, M5 |
| Button, TextField, Card, Modal, Toast | 전 화면 |

> **제거 확정(잔재 0건):** `RadarChart`(역량 레이더)·`ScatterPlot`(산점도)·`Dimension` 타입·peer/upward 유형. 본 25개 컴포넌트로 모든 화면을 조립한다.
</content>
