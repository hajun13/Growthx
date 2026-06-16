# 공용 컴포넌트 치트시트 (shared-components)

> 페이지 리팩토링 에이전트 참조용. 인라인 hex 금지 — 토큰 클래스만 사용.
> 신설일: 2026-06-16 | 기준 파일: `apps/web/components/`

---

## 1. StatCard

**import:** `import { StatCard } from '@/components/StatCard';`

**props:**
```ts
{
  label: string;
  value: React.ReactNode;          // 34px 굵은 수치 — 백엔드 산정값만
  sub?: React.ReactNode;           // 보조 설명 (예: "3명 미제출")
  icon?: React.ReactNode;          // lucide-react 아이콘 권장
  tone?: 'default'|'primary'|'success'|'warning'|'danger'|'info';
  className?: string;
}
```

**1줄 예시:**
```tsx
<StatCard label="제출률" value="87%" sub="3명 미제출" tone="success" icon={<CheckCircle />} />
```

**ScoreCard 와 구분:** `ScoreCard`는 KPI 점수·달성률·등급 표시 도메인 특화. `StatCard`는 범용 통계 수치 카드.

---

## 2. SearchInput

**import:** `import { SearchInput } from '@/components/SearchInput';`

**props:**
```ts
{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;           // 기본 "검색"
  className?: string;
  ariaLabel?: string;             // placeholder와 다를 때만 지정
}
```

**1줄 예시:**
```tsx
<SearchInput value={q} onChange={setQ} placeholder="이름·이메일 검색" className="w-64" />
```

**특이사항:** pill 형(`rounded-pill`), 값 있으면 X 지우기 버튼 자동 표시. raw `<input>` 외부 노출 없음.

---

## 3. FilterChipBar

**import:** `import { FilterChipBar } from '@/components/FilterChipBar';`

**props (단일 선택):**
```ts
{
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (v: string) => void;
  multiple?: false;
  className?: string;
}
```

**props (다중 선택):**
```ts
{
  options: { value: string; label: string; count?: number }[];
  value: string[];
  onChange: (v: string[]) => void;
  multiple: true;
  className?: string;
}
```

**1줄 예시 (단일):**
```tsx
<FilterChipBar options={[{value:'all',label:'전체'},{value:'submitted',label:'제출',count:12}]} value={status} onChange={setStatus} />
```

**1줄 예시 (다중):**
```tsx
<FilterChipBar options={groupOpts} value={selectedGroups} onChange={setSelectedGroups} multiple />
```

---

## 4. SegmentedControl

**import:** `import { SegmentedControl } from '@/components/SegmentedControl';`

**props:**
```ts
{
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'md';            // 기본 'md'
  className?: string;
  ariaLabel?: string;             // 기본 "옵션 선택"
}
```

**1줄 예시:**
```tsx
<SegmentedControl options={[{value:'list',label:'목록'},{value:'card',label:'카드'}]} value={view} onChange={setView} />
```

**Tabs 와 구분:** `Tabs`(언더라인 탭 — 큰 페이지 구획), `SegmentedControl`(박스형 — 정렬/보기 전환 등 소규모 토글).

---

## 5. DataTable

**import:** `import { DataTable } from '@/components/DataTable';`

**props:**
```ts
{
  columns: {
    key: string;
    header: React.ReactNode;
    align?: 'left' | 'right' | 'center';
    width?: string;
    className?: string;            // 숫자열은 'tabular-nums' 권장
    render?: (row: T) => React.ReactNode;
  }[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
  empty?: React.ReactNode;         // 기본 EmptyState
  className?: string;
  wrapperClassName?: string;
}
```

**1줄 예시:**
```tsx
<DataTable
  columns={[
    { key: 'name', header: '이름' },
    { key: 'score', header: '점수', align: 'right', className: 'tabular-nums' },
    { key: 'grade', header: '등급', render: (r) => <GradeChip grade={r.grade} /> },
  ]}
  rows={users}
  rowKey={(r) => r.id}
  onRowClick={(r) => router.push(`/users/${r.id}`)}
  stickyHeader
/>
```

**기반:** `components/ui/table.tsx`. 빈 rows → `EmptyState` 자동 표시.

---

## 6. SectionHeader

**import:** `import { SectionHeader } from '@/components/SectionHeader';`

**props:**
```ts
{
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;       // 우측 버튼·링크
  icon?: React.ReactNode;          // 제목 좌측 아이콘
  className?: string;
}
```

**1줄 예시:**
```tsx
<SectionHeader title="KPI 성과 요약" description="이번 분기 기준" actions={<Button size="sm">편집</Button>} icon={<BarChart2 />} />
```

**PageHeader 와 구분:** `PageHeader`(페이지 최상위 h1, cycle 선택기). `SectionHeader`(카드/구획 내 서브제목, 더 작은 위계).

---

## 7. Pagination

**import:** `import { Pagination } from '@/components/Pagination';`

**props:**
```ts
{
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  className?: string;
  maxVisible?: number;             // 최대 표시 번호 수 (기본 7)
}
```

**1줄 예시:**
```tsx
<Pagination page={page} totalPages={Math.ceil(total / pageSize)} onChange={setPage} />
```

**특이사항:** `totalPages <= 1` 이면 렌더링 없음(null). 7개 초과 시 `…` 생략. `components/ui/button` 기반.

---

## 공통 규칙

| 규칙 | 내용 |
|------|------|
| 인라인 hex 금지 | `bg-primary`, `text-muted-foreground`, `border-border` 등 토큰 클래스만 |
| 계산 금지 | 수치는 백엔드 응답값 표시만, 프론트 재계산 없음 |
| 접근성 | 모든 컴포넌트 `aria-label`, `role`, `aria-checked`/`aria-current` 기본 탑재 |
| 파일 상한 | ~200줄 (architecture.md §3) — 현재 전 파일 준수 |

## 기존 컴포넌트 재사용 가이드

| 필요 | 사용할 컴포넌트 |
|------|----------------|
| 평가 점수·달성률 카드 | `ScoreCard` (도메인 특화) |
| 범용 수치 통계 | `StatCard` (신설) |
| 페이지 제목 + 주기 선택 | `PageHeader` |
| 카드/섹션 내 소제목 | `SectionHeader` (신설) |
| 언더라인 탭 전환 | `Tabs` |
| 박스형 소규모 토글 | `SegmentedControl` (신설) |
| 필터 pill 칩 | `FilterChipBar` (신설) |
| 검색창 pill | `SearchInput` (신설) |
| 데이터 표 | `DataTable` (신설) |
| 페이지 이동 | `Pagination` (신설) |
| 로딩/빈 상태/에러 | `Spinner`, `EmptyState`, `ErrorState` (States.tsx) |
| 대시보드 위젯 | `WidgetCard` |
| 상태 배지 | `StatusBadge` |
| 등급 칩 | `GradeChip` |
