# 에너지엑스 인사평가 — 표준 페이지 패턴 가이드

> **권위:** 루트 `DESIGN.md` (EnergyX Common Design System 2026) + 핸드오프 번들 `energyx-design-system/project/`  
> **용도:** 프론트 엔지니어가 각 페이지를 리팩토링할 때 참조하는 체크리스트형 규범  
> **작성:** 2026-06-16 | SSOT 정합 기준: DESIGN.md §1~§10, 핸드오프 readme.md + components/\*\*  

---

## 0. 빠른 체크리스트 (리팩토링 전 필독)

리팩토링할 페이지마다 아래 항목을 순서대로 확인한다.

- [ ] 페이지 루트가 `<PageContainer>` 로 감싸져 있는가?
- [ ] 페이지 제목 블록이 `<PageHeader>` 로 구현되어 있는가?
- [ ] 섹션이 `<Card>` 로 구분되고 카드 내부 패딩이 `p-6`(24px)인가?
- [ ] 로컬 색상 상수(`const K = {...}`, `const T = {...}`) 가 제거됐는가?
- [ ] `style={{ background: '#...', borderRadius, boxShadow }}` 인라인 구현이 제거됐는가?
- [ ] raw `<button>`, `<input>`, `<select>`, `<textarea>` 가 DS 컴포넌트로 교체됐는가?
- [ ] 빈 상태 / 로딩 / 에러 / 권한 없음 분기가 `States` 컴포넌트로 처리됐는가?
- [ ] 수치가 `tabular-nums` 클래스를 사용하는가?
- [ ] 등급 표시가 `<GradeChip>` 으로 색+텍스트 라벨을 병기하는가?
- [ ] 그라데이션, hex 리터럴 색, `boxShadow` 직접 설정이 없는가?

---

## 1. 표준 페이지 골격

모든 페이지는 아래 구조를 따른다. 변형이 필요한 경우 이 구조를 기반으로 확장한다.

```
AppShell (sidebar + <main>)
└── <main>  ← px-4 py-6 lg:px-8  ← AppShell이 제공. 페이지 루트에 추가 패딩 금지
    └── PageContainer             ← space-y-5 (섹션 간 20px 간격)
        ├── PageHeader            ← 페이지 대제목 · 부제목 · 우측 1차 액션
        ├── [InfoBanner]          ← 선택. 맥락 안내 (info/success/warning/danger 톤)
        ├── [Tabs]                ← 선택. 화면 내 탭 전환이 필요한 경우
        ├── Card (섹션 A)         ← title + action(우측 버튼) + 내부 콘텐츠
        ├── Card (섹션 B)
        └── Card (섹션 N)
```

### 1-1. PageContainer

```tsx
import { PageContainer } from '@/components/PageContainer';

// 모든 (main) 페이지 루트 래퍼. space-y-5로 섹션 간 20px 간격을 통일한다.
// AppShell <main>이 px-4 py-6 lg:px-8 여백을 제공하므로 페이지 루트에 추가 패딩 금지.
<PageContainer>
  {/* PageHeader + 섹션들 */}
</PageContainer>
```

- `className` prop으로 추가 클래스 가능(최대 폭 조정 등).
- 폰트는 전역 `body`(Pretendard Variable)를 상속 — 인라인 `fontFamily` 금지.

### 1-2. PageHeader

```tsx
import { PageHeader } from '@/components/PageHeader';

<PageHeader
  title="페이지 제목"              // h1, 20px / font-bold / #18181c
  subtitle="설명 문구"             // 선택. 13px / #565660
  right={                         // 선택. 우측 1차 액션 슬롯
    <Button variant="primary" leftIcon={<Plus size={18} />}>등록</Button>
  }
  cycles={cycles}                 // 선택. 평가 주기 셀렉터 표시 시
  selectedId={selectedId}
  onSelectCycle={setSelectedId}
/>
```

- `title`: h1 태그. 20px · Bold · `#18181c`.
- `subtitle`: 13px · `#565660` · marginTop 2px.
- `right` 슬롯: `flex items-center gap-2.5 flex-wrap` — 버튼 1~3개 한도.
- **한 화면에 primary 버튼은 1개만.** 보조 액션은 `secondary`.

### 1-3. Card (섹션 래퍼)

```tsx
import { Card } from '@/components/Card';

// 기본 — 제목 + 내부 콘텐츠
<Card title="섹션 제목">
  {/* 콘텐츠 */}
</Card>

// 우측 액션 포함
<Card title="KPI 목록" action={<Button variant="secondary" size="sm">항목 추가</Button>}>
  {/* 콘텐츠 */}
</Card>

// 고밀도(테이블 포함) — 헤더 패딩 p-4, 테이블 셀 py-3 px-4
<Card title="평가 현황" padding="sm">
  {/* DataTable */}
</Card>
```

- 카드 배경: `#FFFFFF` (surface-card).
- 반경: `rounded-lg` (12px, `--radius-lg`).
- 그림자: `elevation-1` (`0 1px 2px rgba(14,14,20,.06), 0 1px 3px rgba(14,14,20,.08)`).
- 기본 패딩: `p-6` (24px). 고밀도(테이블 포함): `padding="sm"` → `p-4` + 테이블 셀 `py-3 px-4`.
- 카드 제목 텍스트: 15px · Bold · `--text-foreground`.

### 1-4. 섹션 간 간격

| 위치 | 클래스 / 값 | 비고 |
|------|------------|------|
| PageContainer 자식 간 | `space-y-5` (20px) | PageContainer 기본값 |
| 카드 내부 요소 간 | `space-y-4` (16px) / `gap-4` | 복수 블록 |
| 인라인 요소 간 | `gap-2` (8px) / `gap-3` (12px) | 버튼·뱃지 row |
| 섹션 헤더 ↔ 콘텐츠 | `border-b border-border py-4` | Card 내부 자동 적용 |

### 1-5. 컨테이너 최대 폭

- `<main>` 기본: 컨테이너 최대 1440px, 데스크탑 우선.
- 협폭 폼 페이지: `max-w-2xl` 또는 `max-w-3xl` 을 PageContainer에 추가.
- 와이드 테이블: 별도 제약 없음(100% 폭 사용).

---

## 2. DS 컴포넌트 매핑 규칙

"어떤 UI 요소에 어떤 컴포넌트를 쓴다"는 규칙. 매핑에 없는 경우 DS 팀에 문의.

### 2-1. 버튼

| 사용 상황 | 컴포넌트 & variant | 예시 |
|----------|-------------------|------|
| 페이지 1차 액션(저장·등록·제출) | `<Button variant="primary">` | 저장하기, 평가 제출 |
| 보조 액션(취소·내보내기·인쇄) | `<Button variant="secondary">` | 취소, 평가표 인쇄 |
| 최소 시각 액션(링크형·고스트) | `<Button variant="ghost">` | 보기, 상세 |
| 위험 작업(삭제·강제 초기화) | `<Button variant="danger">` | 삭제, 강제 종료 |
| 아이콘 단독 | `<IconButton aria-label="...">` | 필터 열기, 닫기 |

```tsx
import { Button } from '@/components/Button';
import { Plus, Save, Trash2 } from 'lucide-react';

// 1차 액션
<Button variant="primary" leftIcon={<Save size={18} />} loading={saving}>
  규칙 저장
</Button>

// 보조 액션
<Button variant="secondary" size="sm" leftIcon={<FileText size={16} />}>
  평가표 인쇄
</Button>

// 위험 작업 — ConfirmDialog로 한 번 더 확인
<Button variant="danger" onClick={() => setConfirmOpen(true)}>
  평가 삭제
</Button>
```

- `size`: `sm` (32px) / `md` (40px, 기본) / `lg` (48px).
- **한 화면에 `primary` 버튼 1개 원칙.** 복수가 필요하면 나머지를 `secondary`로.
- `loading` 사용 시 스피너 + 자동 비활성화.

### 2-2. 카드 (섹션 컨테이너)

`<Card>` — §1-3 참조. 추가 스타일 재구현 금지.

### 2-3. 통계 수치 카드

수치를 크게 강조하는 KPI/통계 카드는 `<WidgetCard>` 또는 `<StatCard>` 패턴을 따른다.

```tsx
// WidgetCard 패턴 — 아이콘 + 라벨 + 수치
<WidgetCard
  icon={<BarChart2 size={20} />}
  label="평균 점수"
  value="82.4"    // tabular-nums, ~34px
  trend="+3.2"
/>

// 인라인 수치 강조 (카드 내부)
<span className="tabular-nums text-[34px] font-extrabold leading-none text-[#7A37D8]">
  82.4
</span>
<span className="text-[13px] text-muted-foreground">/ 100점</span>
```

- 수치 크기: 대시보드 메인 지표 `text-[34px]`, 보조 수치 `text-[24px]`.
- 항상 `tabular-nums` 적용. 단위는 suffix 분리.

### 2-4. 뱃지

| 사용 상황 | 컴포넌트 | 비고 |
|----------|---------|------|
| 평가/KPI 진행 상태 | `<StatusBadge status={...}>` | not_started/in_progress/submitted/finalized |
| 등급 표시 (S~D) | `<GradeChip grade={...}>` | 색+라벨 자동 병기 |
| 카운트·카테고리 | `<Badge color="..." appearance="soft">` | shadcn ui/badge 래퍼 |

```tsx
import { StatusBadge } from '@/components/StatusBadge';
import { GradeChip } from '@/components/GradeChip';

// 평가 상태
<StatusBadge status="in_progress" />
<StatusBadge status="finalized" count={12} />

// 등급 — soft(기본)/solid 선택, showScore로 점수 병기
<GradeChip grade="A" />
<GradeChip grade="S" variant="solid" showScore={96.5} />

// 미집계 등급 — null 전달하면 "—" 칩으로 자동 처리
<GradeChip grade={null} />
```

### 2-5. 입력 폼

```tsx
import { FormField, Input, Textarea, Select } from '@/components/ui/...';
// 또는 apps/web/components/TextField.tsx, Select.tsx 사용

// FormField로 라벨·에러·힌트 통합
<FormField label="목표치" htmlFor="target" required error={errors.target}>
  <Input id="target" type="number" placeholder="0" />
</FormField>

// Select
<Select options={cycleOptions} value={cycleId} onChange={setCycleId} />

// Textarea
<Textarea placeholder="평가 의견을 입력하세요" maxLength={500} showCount />

// Checkbox / Radio / Switch
<Checkbox checked={agree} onChange={setAgree}>약관 동의</Checkbox>
<Switch checked={enabled} onChange={setEnabled}>알림 받기</Switch>
```

- `Input`/`Select`/`Textarea`: 기본 높이 40px, 반경 8px (`--radius-md`), 1px border-default.
- 포커스: 퍼플 보더 + `--focus-ring` (3px ring).
- 에러: `--status-danger-solid` 보더 + 아래 메시지.
- 비활성: `--surface-sunken` 배경 + opacity 0.6.

### 2-6. 탭

```tsx
import { Tabs } from '@/components/Tabs';

// 라인 탭 — 화면 내 콘텐츠 전환 (기본)
<Tabs
  items={[
    { key: 'all', label: '전체' },
    { key: 'unread', label: '안읽음', badge: unreadCount },
    { key: 'kpi', label: 'KPI' },
  ]}
  activeKey={tab}
  onChange={(k) => setTab(k)}
/>

// Pill 탭 — 2~3개 상호 배타적 전환 (SegmentedControl 용도)
<Tabs variant="pill" items={[...]} activeKey={tab} onChange={setTab} />
```

- 화면 내 콘텐츠 분기: `line` 탭.
- 2~3개 토글(측정방식 선택 등): `pill` 탭 또는 `<SegmentedControl>`.
- 비활성: `--text-muted`. 활성: `--color-primary`. 언더라인 2px 퍼플.
- `role="tablist"` + `aria-selected` 자동 적용.

### 2-7. 데이터 테이블

```tsx
import {
  Table, TableHeader, TableRow, TableHead,
  TableBody, TableCell,
} from '@/components/ui/table';

// 테이블 헤더 sticky
<div className="overflow-x-auto">
  <Table>
    <TableHeader className="sticky top-0 bg-white z-10">
      <TableRow>
        <TableHead>이름</TableHead>
        <TableHead className="text-right tabular-nums">점수</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.map(row => (
        <TableRow key={row.id}>
          <TableCell>{row.name}</TableCell>
          <TableCell className="text-right tabular-nums">{row.score}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

- 수치 컬럼: `text-right tabular-nums`.
- 테이블 포함 카드: `<Card padding="sm">` 사용.
- 테이블 헤더 배경: `bg-muted` 또는 `bg-[#EFEFF2]`, `text-xs font-semibold uppercase`.
- 행 구분선: `divide-y divide-border`.

### 2-8. 검색 / 필터

```tsx
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

// 검색 입력 — pill 반경 사용
<div className="relative">
  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
  <Input
    className="pl-9 rounded-full"   // pill 형태
    placeholder="이름 검색"
    value={query}
    onChange={e => setQuery(e.target.value)}
  />
</div>

// 필터 칩 바
<div className="flex flex-wrap gap-2">
  {filterOptions.map(opt => (
    <button
      key={opt.key}
      onClick={() => setFilter(opt.key)}
      className={cn(
        'rounded-full px-3 py-1 text-sm font-medium transition-colors',
        filter === opt.key
          ? 'bg-[#F4EDFC] text-[#56229F] border border-[#7A37D8]/30'
          : 'bg-[#EFEFF2] text-[#565660] hover:bg-[#E3E3E8]'
      )}
    >
      {opt.label}
    </button>
  ))}
</div>
```

- 검색바: `rounded-full` (pill). 높이 40px. 좌측 Search 아이콘 18px.
- 필터 칩: pill 형태. 선택됨: `--color-primary-subtle` bg + 퍼플 텍스트 + 퍼플 보더.

### 2-9. 페이지네이션

```tsx
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationLink, PaginationPrevious, PaginationNext,
} from '@/components/ui/pagination';

<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious href="#" aria-disabled={page === 1} />
    </PaginationItem>
    {/* 페이지 번호 */}
    <PaginationItem>
      <PaginationNext href="#" aria-disabled={page === totalPages} />
    </PaginationItem>
  </PaginationContent>
</Pagination>
```

- 현재 페이지: `--color-primary` 배경 + 흰 텍스트.
- 비활성 화살표: `--text-disabled` + `cursor: not-allowed`.

### 2-10. 빈 / 로딩 / 에러 / 권한 없음 상태

모든 비동기 데이터 화면은 아래 4가지 상태를 반드시 처리한다.

```tsx
import { EmptyState, ErrorState, Forbidden, Skeleton, Spinner } from '@/components/States';

// 로딩 — 레이아웃 자리를 잡아주는 Skeleton 우선. 전체 화면 로딩은 Spinner
if (loading && items.length === 0) return (
  <PageContainer>
    <Skeleton className="h-10 w-64" />    {/* PageHeader 자리 */}
    <Skeleton className="h-48 w-full" />  {/* 카드 자리 */}
  </PageContainer>
);

// 에러
if (error) return <ErrorState message={error.message} onRetry={reload} />;

// 권한 없음
if (!allowed) return <Forbidden message="이 화면은 HR 관리자만 볼 수 있어요." />;

// 빈 상태 — action으로 CTA 제공
if (items.length === 0) return (
  <EmptyState
    title="등록된 KPI가 없어요."
    description="평가 준비 단계에서 KPI를 먼저 작성해 주세요."
    action={<Button variant="primary">KPI 작성하기</Button>}
  />
);
```

- `EmptyState`: `title`(필수) + `description`(선택) + `action`(CTA 버튼, 권장).
- `ErrorState`: `message` + `onRetry`. 자동으로 "다시 시도" 버튼 표시.
- `Forbidden`: `message`. "메인으로" 링크 자동 포함.
- `Skeleton`: `className` 으로 h/w 지정. 복수 개 나열로 레이아웃 유지.
- 데이터가 있지만 필터 결과 없음: `EmptyState`에 "전체 보기" 버튼 action.

### 2-11. 모달 / 확인 다이얼로그

```tsx
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ui/...';

// 폼 모달
<Modal
  open={open}
  onClose={() => setOpen(false)}
  title="KPI 항목 수정"
  description="수정 내용은 저장 후 반영돼요."
  footer={
    <>
      <Button variant="ghost" onClick={() => setOpen(false)}>취소</Button>
      <Button variant="primary" loading={saving} onClick={handleSave}>저장</Button>
    </>
  }
>
  {/* 폼 내용 */}
</Modal>

// 위험 작업 확인
<ConfirmDialog
  open={confirmOpen}
  tone="danger"
  title="평가를 삭제할까요?"
  message="삭제한 평가 데이터는 복구할 수 없어요."
  confirmText="삭제"
  onConfirm={handleDelete}
  onClose={() => setConfirmOpen(false)}
/>
```

- 모달 최대 폭: 560px. 반경: 16px (`--radius-xl`). 그림자: `elevation-4`.
- 스크림: `rgba(14,14,20,.55)`.
- 진입 애니메이션: 8px 상승 + scale .98→1, 120~200ms.
- 위험 작업(삭제·초기화)은 반드시 `ConfirmDialog`로 한 번 더 확인.

### 2-12. 토스트

```tsx
import { useToast } from '@/components/Toast';

function MyComponent() {
  const toast = useToast();

  async function handleSave() {
    try {
      await save();
      toast.show({ variant: 'success', message: '저장했어요.' });
    } catch (err) {
      toast.show({ variant: 'danger', message: err instanceof Error ? err.message : '저장에 실패했어요.' });
    }
  }
}
```

- 우하단 고정 스택. 자동 닫힘 5초.
- `success` / `warning` / `danger` / `info` 4종.
- 성공: 항상 `success`. API 에러: `danger`. 주의: `warning`.

### 2-13. InfoBanner

```tsx
import { InfoBanner } from '@/components/InfoBanner';

// 맥락 안내 — 페이지 상단, PageHeader 아래
<InfoBanner tone="info" title="결과 보는 법">
  1차(팀장)·2차(본부장)·최종(그룹대표) 단계별 점수를 비교할 수 있어요.
</InfoBanner>

<InfoBanner tone="warning" title="제출 마감 D-3">
  2026.06.19까지 본인평가를 제출해야 해요.
</InfoBanner>
```

- `tone`: `info` / `success` / `warning` / `danger`.
- 페이지 진입 시 중요 안내, 단계 제한 안내, 읽기 전용 안내 등에 사용.

---

## 3. 색 · 타이포 · 간격 토큰 빠른 참조

### 3-1. 텍스트 위계

| 역할 | 색 토큰 | Tailwind 클래스 | 크기 |
|------|--------|----------------|------|
| 페이지 제목 (h1) | `--neutral-950` (#0E0E14) | `text-foreground font-bold` | 20px |
| 섹션 제목 (카드) | `--neutral-950` | `text-foreground font-bold` | 15px |
| 기본 본문 | `--neutral-800` (#2A2A30) | `text-default` | 14~16px |
| 보조 / 설명 | `--neutral-500` (#74747F) | `text-muted-foreground` | 13px |
| 비활성 | `--neutral-400` (#A0A0AC) | `text-disabled` | — |
| 링크 | `--purple-500` (#7A37D8) | `text-primary` | — |

### 3-2. 수치 카드 표시

```tsx
// 대시보드 메인 수치 — 34px · ExtraBold · tabular-nums
<span className="tabular-nums text-[34px] font-extrabold leading-none text-[#7A37D8]">
  {value}
</span>

// 보조 수치 — 24px
<span className="tabular-nums text-[24px] font-bold leading-none">
  {value}
</span>

// 단위 suffix 분리
<span className="text-[14px] text-muted-foreground ml-1">점</span>
```

- 수치는 항상 `tabular-nums`.
- 단위(`점`, `%`, `원`)는 suffix 분리, 작은 크기 `text-muted-foreground`.
- 날짜 형식: `2026.06.16`.

### 3-3. 등급 색 (S~D)

등급은 항상 **색 + 텍스트 라벨을 병기**한다 (접근성 대비 AA 준수).

| 등급 | Solid | Soft BG | FG (텍스트) | 의미 |
|------|-------|---------|------------|------|
| S | `#7A37D8` (purple-500) | `#F4EDFC` (purple-50) | `#56229F` (purple-700) | 최우수 |
| A | `#2563EB` (info-500) | `#EAF1FE` (info-50) | `#173F9B` (info-700) | 우수 |
| B | `#16A34A` (success-500) | `#E9F8EF` (success-50) | `#0E6633` (success-700) | 양호 |
| C | `#F59E0B` (warning-500) | `#FEF5E7` (warning-50) | `#9A6103` (warning-700) | 보통 |
| D | `#E5484D` (danger-500) | `#FDECEC` (danger-50) | `#A0282D` (danger-700) | 미흡 |

- `<GradeChip grade={g}>` 로 사용 — 직접 색 지정 금지.
- `lib/grade.ts`의 `GRADE_COLOR`, `lib/ui.ts`의 `gradeBgClass`/`gradeSolidClass` 가 SSOT.

### 3-4. 평가 상태 색

| 상태 | BG | FG | 한글 라벨 |
|------|----|----|----------|
| `not_started` | `#EFEFF2` | `#565660` | 미시작 |
| `in_progress` | `#F4EDFC` | `#56229F` | 진행 중 |
| `submitted` | `#EAF1FE` | `#1D4FC4` | 제출 완료 |
| `finalized` | `#E9F8EF` | `#0E6633` | 확정 |
| `rejected` | `#FDECEC` | `#C8353A` | 반려 |

- `<StatusBadge status={s}>` 로 사용 — 직접 색 지정 금지.

### 3-5. 표면 (Surface)

| 역할 | 색 | Tailwind |
|------|-----|---------|
| 페이지 캔버스 | `#F7F7F9` | `bg-background` |
| 카드 배경 | `#FFFFFF` | `bg-card` |
| 들어간 영역 (테이블 헤더 등) | `#EFEFF2` | `bg-muted` |
| 호버 | `#F7F7F9` | `hover:bg-accent` |

### 3-6. 보더

| 역할 | 색 | Tailwind |
|------|-----|---------|
| 기본 보더 | `#CCCCD4` | `border-border` |
| 가벼운 구분선 | `#E3E3E8` | `border-border/60` 또는 `divide-border` |
| 포커스 보더 | `#7A37D8` | `focus:border-primary` |

### 3-7. 반경

| 대상 | 값 | Tailwind |
|------|-----|---------|
| 버튼 · 입력 · 컨트롤 | 8px | `rounded-md` |
| 카드 · 패널 | 12px | `rounded-lg` |
| 모달 · 다이얼로그 | 16px | `rounded-xl` |
| 칩 · 검색바 · 뱃지 pill 변형 | 999px | `rounded-full` |
| 인라인 태그 (최소) | 4px | `rounded` |

### 3-8. 그림자 (Elevation)

| 레벨 | 적용 대상 | Tailwind (tailwind-preset) |
|------|----------|--------------------------|
| 0 (없음) | Flat — 보더만으로 구분 | `shadow-none` |
| 1 | **카드** | `shadow-elev-1` |
| 2 | 호버 카드 | `shadow-elev-2` |
| 3 | 드롭다운 · 팝오버 | `shadow-elev-3` |
| 4 | **모달 · 다이얼로그** | `shadow-elev-4` |
| focus | 포커스 링 | `shadow-focus-ring` |

- 컬러 그림자(보라 틴트 등) 사용 금지 — 중립 다크 섀도만.
- 카드에 `boxShadow` 인라인 지정 금지 → `shadow-elev-1` 클래스 사용.

### 3-9. 간격 스케일

| 토큰 | 값 | Tailwind | 주 용도 |
|------|-----|---------|--------|
| space-1 | 4px | `gap-1` `p-1` | 최소 간격 |
| space-2 | 8px | `gap-2` | 인라인 요소 간 |
| space-3 | 12px | `gap-3` | 버튼·아이콘 내부 |
| space-4 | 16px | `p-4` `gap-4` | 컴포넌트 기본 패딩 |
| space-5 | 20px | `gap-5` | 섹션 내 블록 간 |
| space-6 | 24px | `p-6` | **카드 기본 패딩** |
| space-8 | 32px | `gap-8` | 섹션 간 |

### 3-10. 아이콘 (Lucide)

- 라이브러리: `lucide-react`. 라인(스트로크) 전용 — filled 금지.
- 크기: 인라인 텍스트 `size={16}` / 버튼·입력 `size={18}` / 강조 영역 `size={24}`.
- 색: `currentColor` 상속 (`text-muted-foreground`, `text-primary` 등으로 제어).
- `aria-hidden` 필수 (장식 아이콘). 단독 기능 아이콘은 `aria-label`.

---

## 4. 금지 사항 (Anti-Pattern)

리팩토링 중 발견하면 즉시 제거한다.

### 4-1. 로컬 팔레트 상수 선언 금지

```tsx
// BAD — 로컬 상수로 팔레트 재선언
const K = { primary: '#7a37d8', surface: '#f7f7f9', ... } as const;
const T = { grey900: '#18181c', ... } as const;

// GOOD — Tailwind 토큰 또는 DS 컴포넌트 사용
<p className="text-foreground">기본 텍스트</p>
<Button variant="primary">저장</Button>
```

- `const K = {...}`, `const T = {...}`, `const PALETTE = {...}` 패턴 모두 금지.
- 기존 파일에 잔존하는 경우 해당 상수 참조를 Tailwind 클래스로 교체 후 삭제.

### 4-2. hex 리터럴 색 인라인 지정 금지

```tsx
// BAD — hex 리터럴 직접 사용
<p style={{ color: '#18181c' }}>텍스트</p>
<div style={{ background: '#7a37d8' }}>...</div>

// GOOD — Tailwind 시맨틱 클래스
<p className="text-foreground">텍스트</p>
<div className="bg-primary text-primary-foreground">...</div>
```

- 예외: DS에 아직 토큰이 없는 특수 도메인 색(차트 시리즈 등)은 `tailwind-preset.cjs`의 `chart.*` 토큰을 사용.

### 4-3. raw HTML 입력 요소 직접 스타일링 금지

```tsx
// BAD — raw <button> 에 인라인 스타일
<button
  style={{ padding: '8px 18px', background: '#7a37d8', borderRadius: 8, ... }}
  onClick={...}
>
  저장
</button>

// GOOD
<Button variant="primary" onClick={...}>저장</Button>
```

- `<button>`, `<input>`, `<select>`, `<textarea>` 에 직접 `style` 지정 금지.
- DS 컴포넌트(`Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Radio`, `Switch`)를 반드시 사용.

### 4-4. 카드·버튼·칩 인라인 재구현 금지

```tsx
// BAD — 카드를 div+인라인 style로 재구현
<div
  style={{
    background: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 4px 12px rgba(86,69,153,0.05)',
    padding: 24,
  }}
>
  콘텐츠
</div>

// GOOD
<Card title="섹션 제목">콘텐츠</Card>

// BAD — GradeChip 재구현
<span
  style={{
    fontSize: 10, fontWeight: 700, color: '#fff',
    background: '#7a37d8', padding: '2px 8px', borderRadius: 4,
  }}
>
  S
</span>

// GOOD
<GradeChip grade="S" />
```

### 4-5. 그라데이션 금지

```tsx
// BAD
<div style={{ background: 'linear-gradient(135deg, #7a37d8, #2563eb)' }}>
<div className="bg-gradient-to-r from-purple-500 to-blue-500">

// GOOD — 솔리드 배경만
<div className="bg-primary">
<div style={{ background: '#7A37D8' }}>  {/* 불가피한 경우 solid만 */}
```

- 그라데이션, 글래스/블러 효과 일체 금지.
- 배경은 솔리드 색상만.

### 4-6. 컬러 그림자 금지

```tsx
// BAD — 보라/컬러 틴트 그림자
<div style={{ boxShadow: '0 4px 12px rgba(86,69,153,0.15)' }}>
<div style={{ boxShadow: '0 8px 24px rgba(122,55,216,0.25)' }}>

// GOOD — elevation 클래스 또는 중립 그림자
<div className="shadow-elev-1">
```

- `shadow-elev-*` 클래스 사용 (중립 다크 5단계).
- 인라인 `boxShadow`로 카드·모달 재구현 금지.

### 4-7. 추가 패딩 금지

```tsx
// BAD — AppShell이 이미 여백을 제공하는데 추가 패딩
<PageContainer className="px-8 py-8">

// GOOD — AppShell <main>의 px-4 py-6 lg:px-8 를 신뢰
<PageContainer>
```

---

## 5. 모범 페이지 참조 (현재 DS 활용 사례)

아래 세 파일이 현행 EnergyX DS를 가장 잘 활용하는 사례다. 다른 페이지 리팩토링 시 이들의 조립 방식을 참고한다.

### 5-1. ResultDetailView — `features/eval-result-detail/ui/ResultDetailView.tsx`

**잘 된 점:**
- `<PageContainer>` + `<PageHeader>` 기본 골격 준수.
- `<Card title="...">` 로 섹션 분리.
- `<EmptyState>`, `<ErrorState>`, `<Forbidden>`, `<Skeleton>` 4-상태 모두 처리.
- `tabular-nums` 수치 표시, `GradeChip` 사용.
- `<Button variant="secondary">` 보조 액션.
- `<InfoBanner>` 로 컨텍스트 안내.
- `Suspense` + Skeleton fallback 패턴.

**조립 패턴 인용:**
```tsx
// 1. 로딩/에러/권한 분기 → 2. PageContainer 골격 → 3. Card 섹션들
if (loading) return <ResultSkeleton />;
if (error instanceof ApiError && error.isForbidden) return <Forbidden message="..." />;
if (!data) return <EmptyState title="..." />;

return (
  <PageContainer>
    <PageHeader title="평가 상세결과" right={<Button>평가표 인쇄</Button>} />
    <InfoBanner tone="success" title="결과 보는 법">...</InfoBanner>
    {/* 퍼플 요약 카드 — 페이지 대표 지표 강조 */}
    <div className="overflow-hidden rounded-lg" style={{ background: '#7a37d8' }}>
      ...
    </div>
    <Card title="평가자 플로우 (본인 → 1차 팀장 → ...)">
      <EvaluatorFlow steps={flow} />
    </Card>
    <Card title="단계별 점수 비교">
      <ComparisonBar rows={rows} companyAvg={data.companyAvg} />
    </Card>
  </PageContainer>
);
```

### 5-2. NotificationsView — `features/notifications/ui/NotificationsView.tsx`

**잘 된 점:**
- `<PageContainer>` + `<PageHeader>` + `<Tabs>` 조합.
- `<EmptyState action={...}>` 에 CTA 버튼 제공.
- `<Skeleton>` 레이아웃 매칭 (실제 콘텐츠와 비슷한 크기).
- `useToast()` 로 성공·실패 피드백.
- `<ErrorState onRetry={reload}>` 재시도 핸들링.

**조립 패턴 인용:**
```tsx
// Tabs + 리스트 패턴
<PageContainer>
  <PageHeader title="알림" subtitle="..." right={<Button>모두 읽음</Button>} />
  <Tabs items={tabs} activeKey={filter} onChange={setFilter} />
  {error ? <ErrorState onRetry={reload} /> :
   filtered.length === 0 ? (
     <Card><EmptyState title="알림이 없어요." action={<Button>전체 보기</Button>} /></Card>
   ) : (
     <div className="space-y-4">
       {/* 그룹별 섹션 */}
     </div>
   )}
</PageContainer>
```

**개선이 필요한 부분(리팩토링 대상):**
- `const K = {...}` 로컬 상수 선언 → 제거 후 Tailwind 토큰으로 교체 필요.
- `<button>` raw 사용 → `<Button variant="secondary">` 로 교체 필요.

### 5-3. RulesView — `features/admin-rules/ui/RulesView.tsx`

**잘 된 점:**
- `<PageContainer>` + `<PageHeader>` 기본 골격.
- `<Forbidden>` + `<Skeleton>` + `<ErrorState>` 상태 처리.
- `useToast()` 저장 성공·실패 피드백.
- `<Button variant="primary" loading={busy}>` 저장 중 상태.
- 권한 없음 시 `pointerEvents: none + opacity: 0.65` 시각 잠금 패턴.

**조립 패턴 인용:**
```tsx
// 권한 체크 → 로딩 → 에러 → 콘텐츠
if (!allowed) return <Forbidden message="..." />;
if (loading) return <Skeleton className="h-64 w-full" />;
if (error) return (
  <PageContainer>
    <PageHeader title="평가 규칙" />
    <ErrorState message={error.message} onRetry={reload} />
  </PageContainer>
);

return (
  <PageContainer>
    <PageHeader
      title="평가 규칙"
      subtitle="설명 텍스트"
      right={
        <>
          {!validation.ok && <span className="text-[11.5px] font-semibold text-[#e5484d]">...</span>}
          <Button variant="primary" leftIcon={<Save size={14} />} loading={busy}>
            규칙 저장
          </Button>
        </>
      }
    />
    {/* 권한 없음 시각 잠금 래퍼 */}
    <div style={canEdit ? undefined : { pointerEvents: 'none', opacity: 0.65 }}>
      <RuleSetEditor ... />
    </div>
  </PageContainer>
);
```

---

## 6. 역할별 화면 분기 패턴

RBAC에 따른 조건부 렌더링은 아래 패턴을 따른다.

```tsx
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { isHrAdmin } from '@/lib/nav';

function MyView() {
  const { user } = useAuth();
  const { hasFeature } = usePermissions();

  // 1. 접근 자체 차단 — Forbidden 반환
  if (!user || !isHrAdmin(user.role)) {
    return <Forbidden message="HR 관리자만 접근할 수 있어요." />;
  }

  // 2. 기능별 조건부 렌더링
  const canEdit = hasFeature('시스템 설정');

  return (
    <PageContainer>
      <PageHeader
        title="제목"
        right={canEdit ? <Button variant="primary">저장</Button> : null}
      />
      <Card>
        {/* canEdit 이 false면 시각 잠금 */}
        <div style={canEdit ? undefined : { pointerEvents: 'none', opacity: 0.65 }}>
          <Editor />
        </div>
      </Card>
    </PageContainer>
  );
}
```

- `useAuth().user.role`: `hr_admin` / `division_head` / `team_lead` / `employee`.
- `isHrAdmin()`, `isDivisionHead()`, `isTeamLead()` 유틸은 `lib/nav.ts` 사용.
- 부분 잠금(읽기 전용): `pointerEvents: none + opacity: 0.65` + `aria-disabled`.

---

## 7. 사이드바 패턴 (AppShell)

`AppShell` 컴포넌트가 관리. 직접 수정하지 말 것.

- 배경: Brand Ink `#0E0E14` (neutral-950) — 솔리드.
- 활성 항목: 좌측 4px 퍼플(`#7A37D8`) 바 + 흰 텍스트 + `rgba(122,55,216,0.12)` 배경.
- 비활성 텍스트: `rgba(255,255,255,0.65)`.
- 호버: `rgba(255,255,255,0.08)` 배경.
- 그라데이션 사용 금지.
- 아이콘: Lucide `size={18}`, `currentColor`.

---

## 8. 접근성 준수 사항

- **색 대비 AA:** 배경 대비 텍스트 4.5:1 이상. DS 팔레트의 soft bg + 700 fg 조합이 검증됨.
- **등급 색:** 색만으로 구분하지 않고 텍스트 라벨 병기 필수 (`GradeChip` 자동 처리).
- **포커스 링:** `--focus-ring` (`0 0 0 3px rgba(122,55,216,.32)`). `outline: none` 단독 사용 금지.
- **아이콘 단독:** `aria-label` 필수 (`IconButton` 자동 강제).
- **로딩 상태:** `role="status"` (`Spinner` 자동 처리), `aria-busy`.
- **모달:** `aria-modal="true"`, `aria-labelledby`. (`Modal` 컴포넌트 자동 처리).
- **폼 오류:** 오류 메시지는 해당 입력 아래에 표시 (`FormField` 자동 처리).
- **Disabled:** `opacity: 0.45` + `cursor: not-allowed`. `aria-disabled` 병기.

---

## 부록 A. 자주 쓰는 Tailwind 클래스 단축 표

| 의도 | 클래스 |
|------|--------|
| 페이지 제목 | `text-[20px] font-bold text-foreground leading-tight` |
| 카드 섹션 제목 | `text-[15px] font-bold text-foreground tracking-tight` |
| 기본 본문 | `text-[14px] text-default` |
| 보조/설명 텍스트 | `text-[13px] text-muted-foreground` |
| 수치 (대) | `text-[34px] font-extrabold tabular-nums leading-none` |
| 수치 (중) | `text-[24px] font-bold tabular-nums leading-none` |
| 수치 (소) | `text-[18px] font-semibold tabular-nums` |
| 카드 패딩 (기본) | `p-6` |
| 카드 패딩 (고밀도) | `p-4` |
| 섹션 간격 | `space-y-5` (PageContainer 자동 적용) |
| 인라인 요소 간격 | `flex items-center gap-2` |
| 카드 반경 | `rounded-lg` (12px) |
| 버튼·입력 반경 | `rounded-md` (8px) |
| Pill | `rounded-full` |
| 카드 그림자 | `shadow-elev-1` |
| 모달 그림자 | `shadow-elev-4` |
| 보더 기본 | `border border-border` |
| 구분선 | `divide-y divide-border` |
| 호버 배경 | `hover:bg-accent` |
| 표면 들어간 영역 | `bg-muted` |
| 포커스 링 | `focus:outline-none focus:ring-2 focus:ring-primary/30` |

---

## 부록 B. 컴포넌트 import 경로 참조

```tsx
// 레이아웃
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { InfoBanner } from '@/components/InfoBanner';

// 액션
import { Button } from '@/components/Button';

// 탭 / 네비
import { Tabs } from '@/components/Tabs';

// 뱃지 / 등급
import { StatusBadge } from '@/components/StatusBadge';
import { GradeChip } from '@/components/GradeChip';

// 상태
import { EmptyState, ErrorState, Forbidden, Skeleton, Spinner } from '@/components/States';

// 피드백
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';

// 도메인 컴포넌트
import { ComparisonBar } from '@/components/ComparisonBar';
import { DistributionBarChart } from '@/components/DistributionBarChart';
import { EvaluatorFlow } from '@/components/EvaluatorFlow';
import { GradeChip } from '@/components/GradeChip';
import { GradeRadio } from '@/components/GradeRadio';
import { WeightField } from '@/components/WeightField';
import { ScoreCard } from '@/components/ScoreCard';
import { ProgressDonut } from '@/components/ProgressDonut';
import { EvidenceUpload } from '@/components/EvidenceUpload';

// 유틸
import { gradeBgClass, gradeSolidClass, fmtScore } from '@/lib/ui';
import { GRADE_COLOR } from '@/lib/grade';

// shadcn primitives (DS 컴포넌트 래퍼가 없는 경우만 직접 사용)
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
```
