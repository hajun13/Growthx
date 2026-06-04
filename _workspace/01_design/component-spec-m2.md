# 컴포넌트 스펙 M2 — 인사평가 솔루션 (신규/확장 컴포넌트)

> **디자인 SSOT:** `DESIGN.md`. 신규 토큰·색·radius·폰트 **0건** — 기존 토큰만 사용.
> **소비자:** frontend-engineer. props는 TS 표기. 컴포넌트명은 확정값(그대로 구현).
> **재사용 우선:** 아래 표의 기존 공용 컴포넌트를 먼저 쓰고, 신규는 정말 필요한 것만.
> **공통:** 대비 AA, 키보드 포커스(`focus-visible:ring`), `aria-*`, "~해요" 라이팅.

## 0. 기존 컴포넌트 재사용 매핑 (신규 화면별)

| 화면 | 재사용(그대로) | 신규 컴포넌트 |
|------|----------------|----------------|
| D1 대시보드 `/dashboard` | `AppShell`·`PageHeader`·`ProgressDonut`·`DistributionBarChart`·`ResultTable`·`StatusBadge`·`InfoBanner`·`Card`·`Button`·`States` | `WidgetCard` |
| D2 알림 (벨/센터) | `AppShell`(벨 슬롯)·`Card`·`Tabs`·`Button`·`States`·`ScrollArea`·`DropdownMenu` | `NotificationBell`·`NotificationItem` |
| D3 감사 로그 `/admin/audit` | `PageHeader`·`Card`·`ResultTable`·`Modal`·`Select`·`TextField`·`StatusBadge`·`Button`·`States` | `AuditFilterBar`·`DiffViewer` |
| D4 엑셀 임포트/익스포트 | `Modal`·`ResultTable`·`InfoBanner`·`Button`·`States` | `FileDropzone`·`ExportButton` |
| D5a 규칙 편집 | `Card`·`TextField`·`Tabs`·`InfoBanner`·`Modal`·`Button` | `RuleSetEditor`(=GradeScaleEditor·GradingScaleEditor·PoolRatioMatrix 묶음) |
| D5b KPI 양식 | `Card`·`Tabs`·`Select`·`TextField`·`WeightField`(로직)·`Modal`·`Button`·`States` | `TemplateEditor`·`TemplateRow` |
| D5c 일정·대상자 | `Card`·`TextField`·`Select`·`Checkbox`·`InfoBanner`·`Button` | `ScheduleEditor` |

> 기존 컴포넌트 props는 `component-spec.md`(M1 v2) 참조. 본 문서는 **신규/변경분만** 정의.

## 공통 타입 (M2 추가)

```ts
type NotificationType =
  | 'deadline' | 'kpi_rejected' | 'result_confirmed' | 'appeal_answered' | 'generic';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;            // "본인평가 마감 D-3예요"
  body?: string;            // 보조 설명
  contextLabel?: string;    // "2026 정기평가"
  href?: string;            // 클릭 시 이동
  read: boolean;
  createdAt: string;        // ISO
}

type AuditAction =
  | 'grade_override' | 'evaluation_submit' | 'kpi_approve' | 'kpi_reject'
  | 'pool_adjust' | 'ruleset_update' | 'settings_update' | 'appeal_decision';

interface AuditLog {
  id: string;
  actorName: string;
  action: AuditAction;
  entityType: string;       // 'Evaluation' | 'Kpi' | 'RuleSet' | ...
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
  ip?: string;
}

type JobLevel = 'division_head' | 'team_lead' | 'senior_plus' | 'senior_minus';

interface KpiTemplateItem {
  id: string;
  jobLevel: JobLevel;
  category: KpiCategory;        // 기존 타입
  group: KpiGroup;             // 기존 타입
  defaultMeasureType: MeasureType;
  defaultWeight: number;       // %
}

interface SchedulePhaseConfig {
  key: 'prepare' | 'self' | 'downward_1' | 'downward_2' | 'result';
  label: string;
  startDate: string; endDate: string;     // YYYY-MM-DD
  reminders: { d7: boolean; d3: boolean; d1: boolean };
}
```

---

## 1. WidgetCard — 대시보드 위젯 (신규)

대시보드 그리드 셀. `Card` 위에 라벨·대표 수치·보조·드릴다운 링크를 표준 배치. **시각은 기존 Card(rounded-xl·shadow-sm) 그대로**, 내부 조립만 표준화.

```ts
interface WidgetCardProps {
  title: string;                       // "단계별 진행률"
  tone?: 'neutral' | 'danger' | 'success' | 'info';  // 강조 톤(미제출=danger 등)
  children: React.ReactNode;           // 대표 시각물(ProgressDonut·big number·DistributionBarChart 등)
  footnote?: string;                   // "78/126 제출"
  href?: string;                       // 있으면 우하단 "상세 →" 링크
  hrefLabel?: string;                  // 기본 "상세 보기"
  span?: 1 | 2;                        // 그리드 col-span (등급분포=2)
}
```
- **레이아웃:** 헤더(title `text-[15px] font-bold`) → 본문 slot → footnote(`text-xs text-muted-foreground`) → href 링크(우하단, `text-primary` 텍스트 링크). `span=2`는 `lg:col-span-2`.
- **tone:** 대표 수치 색만 변경(`danger`→`text-danger-600`, `success`→`text-foreground` + success 보조칩). 단일 액센트 원칙 — 카드 배경/보더는 톤과 무관하게 기본 유지(시맨틱 색은 수치/뱃지에만).
- **big number:** `text-3xl font-extrabold tabular-nums`(예: "+3.1%", "12명").
- **반응형:** 그리드 부모가 `grid gap-6 lg:grid-cols-3 md:grid-cols-2 grid-cols-1`. `span=2`는 md↑에서만 2열 점유.
- **접근성:** 헤더 `<h2>`(또는 카드 title) + href는 실제 `<Link>`. 수치는 텍스트로 읽힘.

---

## 2. NotificationBell — 상단 벨 + 드롭다운 (신규, AppShell 통합)

AppShell 기존 벨 버튼을 대체. 미읽음 뱃지 + `DropdownMenu` 패널(미리보기 목록 + 모두읽음 + 전체보기).

```ts
interface NotificationBellProps {
  unreadCount: number;
  items: Notification[];               // 최근 N개(미리보기, 예 8개)
  loading?: boolean;
  onRead: (id: string) => void;        // 항목 클릭 → 읽음 + href 이동
  onReadAll: () => void;
  onOpenChange?: (open: boolean) => void;  // 열릴 때 fetch 트리거
}
```
- **트리거:** 기존 벨 버튼 스타일 유지(`variant="ghost" size="icon"`, `aria-label="알림 N건"`). 뱃지 = 기존 `absolute … bg-danger-500` 점 뱃지 재사용. unread 0이면 뱃지 숨김.
- **패널:** `DropdownMenuContent align="end"` 폭 360. 헤더(제목 + [모두 읽음] 텍스트 버튼) · `ScrollArea`(max-h 420)에 `NotificationItem` 리스트 · 푸터 "전체 보기 →"(→`/notifications`).
- **상태:** loading→스켈레톤 3행 · 빈→"새 알림이 없어요." · 항목 클릭→`onRead`+이동·드롭다운 닫힘.
- **접근성:** `role="menu"`, 항목 `role="menuitem"`. 뱃지 수는 `aria-label`에 포함.

## 3. NotificationItem — 알림 한 줄 (신규, 드롭다운/센터 공용)

```ts
interface NotificationItemProps {
  data: Notification;
  onClick?: () => void;                // 읽음 + 이동
  dense?: boolean;                     // 드롭다운=dense, 센터=일반
}
```
- **레이아웃:** 좌 타입 아이콘 타일(7×7, `rounded-md`, 연배경+컬러 — InfoBanner 팔레트 재사용) · 중 title(`font-medium`, unread면 `font-semibold`) + body/contextLabel(`text-xs text-muted-foreground`) · 우 상대시각(`text-xs`) + chevron.
- **type별 아이콘/톤(고정):**
  - `deadline`→Clock · `#EBF3FE`/`#1B64DA`
  - `kpi_rejected`→XCircle · `#FDECEC`/`#D6303D`
  - `result_confirmed`→CheckCircle2 · `#E7F8EF`/`#0F9457`
  - `appeal_answered`→MessageSquare · `#FEF8EA`/`#C2670E`
  - `generic`→Bell · `#F2F4F6`/`#4E5968`
- **unread 표시(3중):** 좌측 점(`bg-primary` 6px) + title 굵기 + 행 배경 `bg-primary/[0.04]`. 색 단독 의존 금지.
- **접근성:** `<button>` 또는 `<Link>`. unread는 `aria-label`에 "안읽음" 포함.

---

## 4. AuditFilterBar — 감사 로그 필터 (신규)

```ts
interface AuditFilterValue {
  actorId?: string; action?: AuditAction | 'all';
  entityType?: string; from?: string; to?: string; q?: string;
}
interface AuditFilterBarProps {
  value: AuditFilterValue;
  actors: { id: string; name: string }[];
  onChange: (v: AuditFilterValue) => void;
  onApply: () => void;
  onReset: () => void;
}
```
- **레이아웃:** `Card padding="sm"` 안 가로 flex-wrap. `Select`(행위자·액션·대상) + 날짜 `<input type="date">` 2개 + 검색 `TextField` + [초기화](ghost)·[적용](primary sm). `md`↓ 2열 그리드 래핑.
- **액션 옵션 라벨:** AuditAction 한글 매핑(wireframes-m2 D3 표).
- **접근성:** 각 컨트롤 라벨 연결. 날짜 `from>to`면 `<TextField error>` 캡션.

## 5. DiffViewer — before/after 변경 비교 (신규, Modal 내)

```ts
interface DiffViewerProps {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  fieldLabels?: Record<string, string>;   // 키→한글 라벨
}
```
- **레이아웃:** 3열 그리드(필드 | 이전 | 이후). before∪after 키 합집합 순회. 값 변경된 행만 강조(이후 셀 `bg-success-50 text-success-700`, 이전 셀 `bg-muted text-muted-foreground line-through 톤`), 동일 행은 muted. 생성(before=null)·삭제(after=null)는 한쪽만.
- **값 렌더:** Grade 값은 `GradeChip` 재사용, boolean→"예/아니오", 객체→`<pre>` 축약. null→"—".
- **반응형:** `md`↓ 카드 스택(필드명 위, 이전→이후 세로).
- **접근성:** `<table>` 시맨틱. 변경 행 `aria-label="변경됨"`. 색+취소선+라벨 병기.

---

## 6. FileDropzone — 엑셀 업로드 드롭존 (신규)

```ts
interface ImportRowError { row: number; field?: string; value?: string; message: string; }
interface ImportResult { validCount: number; errorCount: number; errors: ImportRowError[]; }

interface FileDropzoneProps {
  accept?: string;                     // 기본 ".xlsx"
  maxSizeMB?: number;                  // 기본 5
  templateHref?: string;               // 양식 다운로드 URL
  templateLabel?: string;              // "KPI 양식 템플릿"
  uploading?: boolean;
  result?: ImportResult | null;        // 검증 결과(서버 응답)
  onSelect: (file: File) => void;      // 검증 요청 트리거
  onCommit?: () => void;               // "유효 N행 등록"
  onClear?: () => void;
}
```
- **상태/변형:** idle(점선 보더 `rounded-lg` + 업로드 아이콘 + [파일 선택]) · drag-over(`border-primary bg-primary/[0.04]`) · uploading(`<Spinner>` 또는 진행) · validated(요약 "유효 N · 오류 M" + 오류만 `ResultTable`) · 형식/용량 오류(`<InfoBanner tone="warning">`).
- **양식 다운로드:** `templateHref` 있으면 상단 `<Button variant="secondary" leftIcon={Download}>{templateLabel} 템플릿</Button>`.
- **커밋:** result.errorCount 무관 유효행만 등록 가능 → [유효한 N행 등록](primary, validCount=0이면 비활성).
- **오류표:** `ResultTable` 재사용(columns: 행·필드·값·오류). 색 의존 금지(텍스트 메시지).
- **접근성:** `<input type="file">` 시각 숨김 + 라벨/버튼 연결, 드롭존 키보드 포커스 가능. 검증 결과 `aria-live="polite"`.

## 7. ExportButton — 엑셀 내보내기 버튼 (신규, 경량 래퍼)

```ts
interface ExportButtonProps {
  href: string;                        // GET /export/... 스트림
  label?: string;                      // 기본 "엑셀 내보내기"
  filename?: string;
  disabled?: boolean;
}
```
- `<Button variant="secondary" leftIcon={Download}>`. 클릭 시 인증 헤더 포함 fetch→blob 다운로드(또는 토큰 쿼리). 로딩 중 `loading` 표시. `PageHeader.right`에 배치.
- **접근성:** `aria-label="엑셀로 내보내기"`. 다운로드 시작 토스트(info) 선택.

---

## 8. RuleSetEditor — 규칙 전 필드 편집 (신규 묶음)

규칙 탭 전체. 하위 3개 편집 블록 + 기존 인상률·가중치 입력을 한 폼으로. 단일 `onChange(draft)` + 상위 검증.

```ts
interface RuleSetDraft {
  gradeScale: { grade: Grade; min: number; max: number }[];
  gradingScales: Record<'amount'|'rate'|'count', { grade: Grade; min: number; max: number }[]>;
  poolRatios: Record<PoolTier, Record<Grade, number>>;   // % (행 합 100)
  raiseRates: Record<Grade, number>;                     // %
  weightPolicy: { totalMustEqual: number; qualitativeMaxPercent: number };
}
interface RuleSetEditorProps {
  value: RuleSetDraft;
  onChange: (v: RuleSetDraft) => void;
  errors?: Partial<Record<keyof RuleSetDraft, string>>;  // 블록별 에러 요약
  onPreview?: () => void;
  onSave: () => void;
  saving?: boolean;
}
```
하위 프레젠테이션(같은 파일 내 서브컴포넌트로 둬도 됨):
- **GradeScaleEditor:** 등급별 min/max `TextField type=number`. 검증: 단조 비겹침(`A.max+1==S.min` 류 연속성, 겹침/역전 시 해당 행 `error`).
- **GradingScaleEditor:** MeasureType 서브탭(`Tabs`: amount/rate/count). amount·rate=하한/상한 밴드, count=임계 안내(읽기 가이드 텍스트). 밴드 단조 검증.
- **PoolRatioMatrix:** tier×Grade 그리드 입력. 각 tier 행 합계 표시(=100 ✓ / ≠100 빨강). `WeightField` 합계 패턴 차용.
- **인상률·가중치:** 기존 settings 입력 그대로(인상률 5칸, 정성 상한). 합계 고정 100 읽기.
- **저장 가드:** 모든 블록 검증 통과 시에만 [설정 저장] 활성. [변경 미리보기]는 재산정 영향 요약 Modal(선택).
- **저장 후:** 성공 토스트 + reload. 활성 주기면 상단 `InfoBanner(warning)` 재산정 경고 상시 표시.
- **접근성:** 각 입력 라벨·`aria-invalid`·`aria-describedby`(에러 캡션). 매트릭스는 `<table>` + 셀 header 연결.

## 9. TemplateEditor / TemplateRow — KPI 양식 편집 (신규)

```ts
interface TemplateEditorProps {
  jobLevel: JobLevel;
  onJobLevelChange: (j: JobLevel) => void;
  items: KpiTemplateItem[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<KpiTemplateItem>) => void;
  onRemove: (id: string) => void;
  onSave: () => void;
  saving?: boolean;
}
interface TemplateRowProps {
  item: KpiTemplateItem;
  onChange: (patch: Partial<KpiTemplateItem>) => void;
  onRemove: () => void;
}
```
- **jobLevel 탭:** `Tabs`(division_head/team_lead/senior_plus/senior_minus, 한글 라벨).
- **행:** `Select`(category·group·defaultMeasureType) + `TextField type=number`(defaultWeight, suffix `%`) + [삭제](ghost danger). [+ 항목 추가] 푸터.
- **가중치 합계:** 행들의 weight 합 실시간(`WeightField` 검증 로직 재사용) — 100% ✓, 성과중심/협업·성장 그룹 비율 충족 캡션, 정성 ≤상한. 위반 시 저장 비활성.
- **상태:** 빈 `<EmptyState action=[항목 추가]>` · 삭제 `<Modal>` 확인 · 저장 토스트.
- **엑셀 일괄 등록:** 헤더에 [엑셀로 일괄 등록] → `FileDropzone` `Modal`(D4-b).

## 10. ScheduleEditor — 일정·대상자·알림 (신규)

```ts
interface ScheduleEditorProps {
  phases: SchedulePhaseConfig[];
  onPhaseChange: (key: SchedulePhaseConfig['key'], patch: Partial<SchedulePhaseConfig>) => void;
  audience: { scope: 'company' | 'division' | 'team'; divisionIds?: string[]; total: number };
  onAudienceChange: (a: ScheduleEditorProps['audience']) => void;
  channels: { inApp: boolean; email: boolean };
  onChannelsChange: (c: ScheduleEditorProps['channels']) => void;
  onSave: () => void;
  saving?: boolean;
}
```
- **단계 테이블:** 단계별 start/end `<input type=date>` + 알림 트리거 `Checkbox` 3개(D-7/D-3/D-1). 검증: start≤end, 단계 순서 단조(역전 시 인라인 경고).
- **대상자:** 범위 `Select`(전사/본부/팀) + 본부 다중 선택 `Checkbox` + 대상 인원 수 표시.
- **알림 채널:** 인앱/이메일 토글(`Checkbox` 또는 스위치). 이메일 보조 캡션 "SMTP 미설정 시 콘솔/DB 폴백이에요."
- **저장:** 우하단 고정 [일정 저장] Primary. 토스트.
- **접근성:** 날짜·체크박스 라벨, 경고 `aria-describedby`.

---

## 변경: AppShell (벨 슬롯 확장)

기존 `AppShellProps`에 알림 데이터 연동을 위한 슬롯 추가(상단바 벨을 `NotificationBell`로 교체). **레이아웃·스타일 불변.**

```ts
// 추가 props (선택)
interface AppShellProps {
  // ...기존...
  notifications?: {
    unreadCount: number;
    items: Notification[];
    loading?: boolean;
    onRead: (id: string) => void;
    onReadAll: () => void;
    onOpen?: () => void;
  };
}
```
- `notifications` 있으면 기존 벨 버튼 자리에 `<NotificationBell>` 렌더. 없으면 기존 카운트 뱃지 벨 유지(하위 호환).
- nav.ts에 `dashboard`·`audit` 항목 추가(roles: `['hr_admin']`), 아이콘/틴트 매핑 보강(`dashboard`→LayoutDashboard, `audit`→ScrollText). hr_admin 기본 랜딩 `/dashboard`.

## 토큰 준수 체크 (DESIGN.md)
- 색: Action Blue `#0066cc`(text-primary·ring) 단일 액센트. 시맨틱은 기존 `grade-*`·`status-*`·`danger/warning/success`(연배경+짙은 텍스트)만 — 신규 색 0.
- radius: 카드 `rounded-xl`, 드롭존/패널 `rounded-lg`, 칩/뱃지 기존. **신규 radius 0.**
- 그림자: 기존 `shadow-sm`(카드)·`shadow-md`(우하단 바)만. 신규 그림자 0.
- 폰트: Pretendard. big number `tabular-nums`. 본문 위계 기존 유지.
- 라이팅: 전부 "~해요" 체. 등급/상태 색+라벨 병기.
