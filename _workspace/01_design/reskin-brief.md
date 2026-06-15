# 재스킨 통일 브리프 — 에너지엑스 인사 평가 (Kinetic Enterprise)

> **권위:** 루트 `DESIGN.md`(Kinetic Enterprise) + 기준 3화면 코드가 SSOT.
> 충돌 시 기준 3화면 실제 구현이 우선. 이 문서에 없는 것은 DESIGN.md를 따른다.
>
> **대상 에이전트:** 전면 재스킨 담당 프론트 에이전트 9명. 각 섹션의 클래스·스니펫을 그대로 복붙한다.

---

## 0. 팔레트 상수 (K 객체)

모든 페이지는 인라인 스타일에서 아래 K 상수를 사용한다.
`T` 객체(lib/toss.ts)의 grey 계열은 중립 텍스트·보조 색으로 그대로 사용한다.

```ts
// 기준 화면(dashboard/page.tsx)에서 그대로 추출
const K = {
  primary:          '#3f2c80', // deep purple — 브랜드·구조·번호칩·S등급
  primaryContainer: '#564599', // 강조 면
  secondary:        '#0054ca', // true blue — 주요 액션·링크·진행·A등급
  secondaryDim:     '#336fe5', // hover 대체
  tertiary:         '#0e9aa0', // teal — 성공·완료·달성·게이지
  tertiaryBright:   '#2ddbe4',
  surface:          '#f8f9fd', // 캔버스 배경
  white:            '#ffffff',
} as const;

// T 객체(lib/toss.ts) — 중립 텍스트용
// T.grey900 = '#191f28' (본문 최고명도)
// T.grey600 = '#6b7684' (보조 텍스트)
// T.grey500 = '#8b95a1' (힌트·플레이스홀더)
// T.grey400 = '#b0b8c1' (비활성·대기)
// T.grey200 = '#e5e8eb' (구분선)
// T.grey100 = '#f2f4f6' (내부 배경)
// T.grey50  = '#f9fafb' (아이콘 타일 배경)
// T.green500 = '#03b26c'
// T.red500   = '#f04452'
// T.orange500= '#fe9800'
```

---

## 1. 페이지 골격

### 1-1. 루트 래퍼

**모든 페이지는 `<PageContainer>`를 루트로 사용한다.** PageContainer는 `space-y-5` 하나만 적용하는 래퍼다. AppShell `<main>`이 `px-4 py-6 pb-28 lg:px-8`을 이미 제공하므로 **페이지 루트에 추가 padding 금지.**

```tsx
// PageContainer.tsx 구현
<div className={cn('space-y-5', className)}>{children}</div>
```

섹션 간격은 `space-y-5`(20px)가 기본. 카드 내부 섹션 구분은 `space-y-3`~`space-y-4`를 쓴다.

### 1-2. PageHeader (공용 컴포넌트 — 수정 금지)

```tsx
// 모든 페이지 상단에 PageHeader 를 그대로 사용
import { PageHeader } from '@/components/PageHeader';

<PageHeader
  title="페이지 제목"           // h1, text-[20px] font-bold leading-[1.3] color=#191f28
  subtitle="보조 설명 텍스트"   // text-[13px] color=#6b7684 mt-2px
  right={<>                     // 우측 슬롯 — flex items-center gap-2.5 flex-wrap
    <button ...>액션</button>
  </>}
  // 사이클 선택 드롭다운이 필요하면:
  cycles={cycles}
  selectedId={selectedId}
  onSelectCycle={setSelectedId}
/>
```

**PageHeader 규격 (변경 금지):**

| 요소 | 값 |
|------|-----|
| 타이틀 `<h1>` | `text-[20px] font-bold leading-[1.3]` `color: T.grey900(#191f28)` |
| subtitle `<p>` | `text-[13px]` `color: T.grey600(#6b7684)` `marginTop: 2px` |
| 우측 슬롯 | `flex items-center gap-2.5 flex-wrap` |
| 인라인 fontFamily | **금지** — 전역 Pretendard 상속 |

### 1-3. 대시보드식 인사말 헤더 (PageHeader가 아닌 커스텀 헤더가 필요한 경우)

대시보드처럼 PageHeader 대신 `<header>` 커스텀을 쓸 때의 패턴:

```tsx
<header className="flex flex-wrap items-start justify-between gap-4">
  <div>
    <h2 style={{ fontSize: 28, fontWeight: 800, color: T.grey900, letterSpacing: '-0.5px' }}>
      안녕하세요, {user.name} {position}님!
    </h2>
    <p style={{ color: T.grey500, marginTop: 4, fontSize: 14, fontWeight: 500 }}>
      보조 설명
    </p>
  </div>
  {/* 우측 정보 카드 슬롯 — 필요시만 */}
</header>
```

---

## 2. 카드/섹션 패턴

### 2-1. 카드 공통 상수

```ts
// kpi/page.tsx cardStyle 에서 추출 — 모든 카드에 동일 적용
const cardStyle: React.CSSProperties = {
  background:   '#fff',
  borderRadius: 12,                               // DESIGN.md DEFAULT 8px → 기준 화면은 실제로 12px(rounded-xl)
  border:       '1px solid rgba(202,196,210,0.5)',
  boxShadow:    '0 4px 12px rgba(86,69,153,0.05)', // Level 1 보라 틴트 그림자
};
```

Tailwind 클래스로 같은 효과:
```
className="bg-white rounded-xl border border-[#cac4d2]/50 overflow-hidden"
style={{ boxShadow: '0 4px 12px rgba(86,69,153,0.05)' }}
```

### 2-2. 카드 내부 패딩

| 상황 | 패딩 |
|------|------|
| 표준 카드 본문 | `padding: 24` (또는 `p-6`) |
| 좁은 컨텍스트 카드 | `padding: 20` (또는 `p-5`) |
| 카드 헤더 행(테두리 있는 구분) | `px-6 py-4` |
| 정보 그리드 내부 셀 | `padding: '16px 20px'` |

### 2-3. 카드 섹션 헤더 (아이콘 + 타이틀)

```tsx
<div className="px-6 py-4 border-b border-[#e7e8ec] flex items-center gap-2.5">
  <ClipboardCheck size={18} color="#0054ca" />
  <h3 className="text-[16px] font-semibold leading-[1.4] text-[#191c1f]">섹션 타이틀</h3>
</div>
```

카드 안에서 섹션 서브타이틀(레이블 형태):
```tsx
<p className="text-[12px] font-bold tracking-[0.04em] text-[#484551] mb-3 uppercase">
  섹션 이름
</p>
```

### 2-4. KPI 2그룹 색 코딩 (고정값 — 변경 금지)

```ts
// kpi/page.tsx GROUP_CFG 에서 추출
const GROUP_CFG = {
  performance_core:     { label: '성과중심',  bg: '#1B64DA', hover: '#1255c0', color: '#fff' },
  collaboration_growth: { label: '협업·성장', bg: '#029359', hover: '#017a4a', color: '#fff' },
};
```

그룹 범례 스니펫 (섹션 헤더 우측):
```tsx
<div className="flex items-center gap-3" style={{ fontSize: 11.5 }}>
  <span className="inline-flex items-center gap-1.5">
    <span style={{ width: 9, height: 9, background: '#1B64DA', borderRadius: 2, display: 'inline-block' }} />
    <span style={{ color: T.grey600 }}>성과중심</span>
  </span>
  <span className="inline-flex items-center gap-1.5">
    <span style={{ width: 9, height: 9, background: '#029359', borderRadius: 2, display: 'inline-block' }} />
    <span style={{ color: T.grey600 }}>협업·성장</span>
  </span>
</div>
```

### 2-5. 연한 배경 정보 그리드 (카드 내부 서브섹션)

```tsx
<div
  className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl"
  style={{ background: '#f2f3f7', border: '1px solid rgba(202,196,210,0.5)', padding: '16px 20px', marginTop: 14 }}
>
  <div className="flex flex-col gap-1">
    <span style={{ fontSize: 10, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      레이블
    </span>
    <span style={{ fontSize: 13, fontWeight: 600, color: '#191c1f' }}>값</span>
  </div>
</div>
```

### 2-6. 점선 추가 버튼 카드 (빈 목록 아래 + 항목 추가)

```tsx
<button
  onClick={addItem}
  className="flex flex-col items-center justify-center gap-2 w-full rounded-xl transition-all"
  style={{
    padding: '20px 0',
    fontSize: 13, fontWeight: 600,
    color: '#0054ca',
    background: '#fff',
    border: '2px dashed rgba(202,196,210,0.6)',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.borderColor = '#0054ca';
    e.currentTarget.style.background = 'rgba(0,84,202,0.03)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.borderColor = 'rgba(202,196,210,0.6)';
    e.currentTarget.style.background = '#fff';
  }}
>
  <PlusCircle size={22} />
  <span>새로운 항목 추가</span>
</button>
```

---

## 3. 표(테이블) 패턴

### 3-1. 요약 지표 카드 그리드 (숫자 강조형)

```tsx
// eval/my/page.tsx 의 4컬럼 요약 카드 패턴
<div className="grid grid-cols-1 md:grid-cols-4 gap-5">
  {[
    { label: '확정',       value: n, color: '#0054ca'  },
    { label: '제출·승인', value: n, color: '#3f2c80'  },
    { label: '작성 중',   value: n, color: '#797582'  },
    { label: '반려',      value: n, color: '#ba1a1a'  },
  ].map((card) => (
    <div
      key={card.label}
      className="bg-white p-5 rounded-xl border border-[#cac4d2]/50 flex flex-col items-center justify-center transition-transform hover:scale-[1.02] cursor-pointer"
      style={{ boxShadow: '0 4px 12px rgba(86,69,153,0.05)' }}
    >
      <span className="text-[#484551] text-[13px] font-semibold tracking-[0.01em] mb-1.5">
        {card.label}
      </span>
      <span
        className="tabular-nums text-[34px] font-extrabold leading-[1.2] tracking-[-0.02em]"
        style={{ color: card.color }}
      >
        {card.value}
      </span>
    </div>
  ))}
</div>
```

**대형 수치 스케일: `text-[34px] font-extrabold tabular-nums tracking-[-0.02em]`**

### 3-2. 일반 테이블 행 패턴

헤더 행:
```tsx
<div style={{ fontSize: 10, fontWeight: 600, color: '#797582', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
  컬럼명
</div>
```

본문 행 (hover):
```tsx
<div className="flex items-center justify-between p-3.5 bg-[#f2f3f7] rounded-lg border border-[#cac4d2]/20 hover:border-[#3f2c80]/30 transition-colors group">
```

숫자 값 — **반드시 우측 정렬 + tabular-nums**:
```tsx
<span className="tabular-nums text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
  {value}
</span>
```

구분선:
```tsx
<div style={{ width: 1, height: 30, background: T.grey200 }} />  {/* 수직 구분선 */}
<div style={{ borderTop: `1px solid ${T.grey100}` }} />           {/* 수평 구분선 */}
```

---

## 4. 상태 배지 패턴

### 4-1. 등급 칩 (S~D) — 색+텍스트 라벨 항상 병기 (접근성)

```ts
// DESIGN.md 프로젝트 적용 노트 기준 — kpi/page.tsx GRADE_BADGE 에서 확정
const GRADE_BADGE: Record<string, { bg: string; color: string }> = {
  S: { bg: '#3f2c80', color: '#fff' },  // primary deep purple
  A: { bg: '#0054ca', color: '#fff' },  // secondary true blue
  B: { bg: '#4CAF50', color: '#fff' },  // green
  C: { bg: '#FF9800', color: '#fff' },  // amber warning
  D: { bg: '#F44336', color: '#fff' },  // error red
};
```

등급 칩 JSX:
```tsx
<span
  style={{
    fontSize: 12, fontWeight: 700,
    color: GRADE_BADGE[grade].color,
    background: GRADE_BADGE[grade].bg,
    padding: '2px 12px',
    borderRadius: 8, // Pill에 가까운 크기
  }}
>
  {grade}
</span>
```

`gradeChipColor`(lib/toss.ts)의 값은 Toss 기반이므로 **위 GRADE_BADGE 값을 우선 사용.**

### 4-2. 상태 Pill 배지 (진행/완료/대기/예정)

```tsx
// dashboard/page.tsx StatusBadge 에서 추출 — Pill(border-radius: 999)
const STATUS_CFG = {
  done:    { label: '완료',   bg: T.grey100,               color: T.grey500  },
  active:  { label: '진행 중', bg: 'rgba(0,84,202,0.10)',  color: '#0054ca'  },
  pending: { label: '예정',   bg: T.grey50,                color: T.grey400  },
};

<span
  style={{
    fontSize: 10.5, fontWeight: 700,
    padding: '2px 9px',
    borderRadius: 999, // Pill
    background: cfg.bg, color: cfg.color,
    flexShrink: 0,
  }}
>
  {cfg.label}
</span>
```

### 4-3. KPI 상태 배지 (제출/승인/확정/반려/수정요청/작성중)

```ts
const KPI_STATUS_LABEL = {
  submitted:          { label: '제출',     bg: '#0054ca'   },
  approved:           { label: '승인',     bg: T.green500  },
  confirmed:          { label: '확정',     bg: '#3f2c80'   },
  rejected:           { label: '반려',     bg: T.red500    },
  revision_requested: { label: '수정요청', bg: T.orange500 },
  draft:              { label: '작성중',   bg: T.grey500   },
};

<span style={{
  fontSize: 11, fontWeight: 600,
  color: '#fff', background: s.bg,
  padding: '3px 10px', borderRadius: 4,
}}>
  {s.label}
</span>
```

### 4-4. 진행 단계 스텝 카드 (체크·로더·원형 아이콘)

```tsx
// dashboard/page.tsx StepCard 패턴
const STEP_META = {
  done:    { fg: K.tertiary,  tile: 'rgba(14,154,160,0.10)', tileFg: K.tertiary  },
  active:  { fg: K.secondary, tile: 'rgba(0,84,202,0.10)',   tileFg: K.secondary },
  pending: { fg: T.grey400,   tile: T.grey100,               tileFg: T.grey400   },
};

// 카드 안 아이콘 타일
<div style={{ width: 44, height: 44, borderRadius: 12, background: m.tile }}>
  <Icon size={20} color={m.tileFg} strokeWidth={2} />
</div>
// 상태 텍스트 — done=CheckCircle2, active=Loader2, pending=Circle
```

### 4-5. 평가 프로세스 행 (번호 칩 + 라벨 + 상태 칩)

```tsx
// eval/my/page.tsx ProcessStepRow 패턴
<div className="flex items-center justify-between p-3.5 bg-[#f2f3f7] rounded-lg border border-[#cac4d2]/20 hover:border-[#3f2c80]/30 transition-colors">
  <div className="flex items-center gap-3.5">
    <div className="w-7 h-7 rounded-md bg-[#0054ca] text-white flex items-center justify-center font-bold text-[13px]">
      {index}
    </div>
    <span className="text-[#191c1f] font-semibold text-[14px]">{label}</span>
    <span className="text-[12.5px] text-[#484551]">({sub})</span>
  </div>
  <span className={`px-3 py-1 text-[12.5px] font-semibold rounded-md ${chip.cls}`}>
    {chip.text}
  </span>
</div>
```

번호 칩:
```tsx
<span
  style={{ width: 22, height: 22, fontSize: 11, fontWeight: 700, color: '#fff',
    background: '#3f2c80', borderRadius: 6 }}
  className="inline-flex items-center justify-center tabular-nums"
>
  {index + 1}
</span>
```

### 4-6. 사이클 유형 배지 (틸 톤)

```tsx
// eval/my/page.tsx CyclePhaseBadge 패턴
<span className="px-2 py-1 rounded-lg text-[12px] font-bold border bg-[#2ddbe4]/20 text-[#004f53] border-[#2ddbe4]/40">
  {label}
</span>
```

---

## 5. 버튼/CTA 위계

### 5-1. 공용 Button 컴포넌트

```tsx
import { Button } from '@/components/Button';

// 변형 4종
<Button variant="primary">주요 액션</Button>    // shadcn "default" → #3182f6(CSS var primary)
<Button variant="secondary">보조 액션</Button>  // shadcn "outline"
<Button variant="ghost">텍스트 액션</Button>    // shadcn "ghost"
<Button variant="danger">위험 액션</Button>     // shadcn "destructive"

// 크기 3종
<Button size="sm" /> <Button size="md" /> <Button size="lg" />

// 로딩/비활성
<Button loading>저장 중…</Button>
<Button disabled>비활성</Button>
```

### 5-2. 인라인 스타일 primary 버튼 (하단 고정 액션 바 등)

**CSS 변수 primary가 Toss 블루(#3182f6)이므로, 고딕 퍼플/블루 액션이 필요할 때는 인라인 스타일 사용.**

```tsx
// Primary — Deep Purple (임시저장/확인)
<button
  style={{
    padding: '10px 22px', fontSize: 13, fontWeight: 600,
    color: '#3f2c80', background: '#fff',
    border: '1px solid #3f2c80', borderRadius: 8,
  }}
>
  임시저장
</button>

// Primary 솔리드 — True Blue (제출/주요 CTA)
<button
  style={{
    padding: '10px 28px', fontSize: 13, fontWeight: 700,
    color: '#fff', background: '#0054ca', border: 'none', borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0,84,202,0.25)',
  }}
>
  최종 제출
</button>

// Primary 솔리드 — Deep Purple (결과 확인 등)
<button
  className="flex items-center justify-center gap-2 py-3 rounded-lg text-[13px] font-semibold text-white transition-colors hover:opacity-90"
  style={{ background: '#0054ca', border: '1px solid #0054ca' }}
>
  상세 평가표 보기
</button>
```

### 5-3. 버튼 배치 위치 규칙

| 위치 | 용도 | 예시 |
|------|------|------|
| PageHeader `right` 슬롯 | 해당 페이지 전체 액션(내보내기·불러오기) | `양식 불러오기` |
| 카드 헤더 우측 | 카드 범위 액션(전체 보기 링크) | `전체 보기 →` |
| **하단 고정 액션 바** | 다중 KPI 임시저장·최종 제출 등 | `임시저장` `최종 제출` |
| 카드 푸터 | 단일 항목 액션 | `상세 평가표 보기` `평가결과 상세` |

### 5-4. 하단 고정 액션 바 (KPI 작성·본인평가 등)

```tsx
// kpi/page.tsx 하단 고정 바 패턴 — 사이드바 폭(256px) 오프셋 적용
<div
  className="fixed bottom-0 left-0 lg:left-64 right-0 z-30 flex flex-wrap items-center justify-between gap-4"
  style={{
    background: 'rgba(248,249,253,0.92)',
    backdropFilter: 'blur(8px)',
    borderTop: '1px solid rgba(202,196,210,0.4)',
    padding: '14px 24px',
  }}
>
  {/* 좌측: 요약 통계 */}
  <div className="flex items-center gap-6">
    {/* 통계 항목 */}
    <div style={{ width: 1, height: 32, background: '#cac4d2' }} /> {/* 구분선 */}
    {/* 다음 항목 */}
  </div>
  {/* 우측: 액션 버튼 (secondary → primary 순) */}
  <div className="flex items-center gap-3">
    <button /* secondary: outline purple */ >임시저장</button>
    <button /* primary: solid blue */ >최종 제출</button>
  </div>
</div>
```

---

## 6. 폼 패턴

### 6-1. 필드 래퍼 (Field)

```tsx
// kpi/page.tsx Field 컴포넌트 — 모든 폼 필드에 적용
function Field({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: T.grey600 }}>
        {label}
        {required && <span style={{ color: T.red500, marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}
```

필수 표시: `<span style={{ color: T.red500, marginLeft: 3 }}>*</span>`

### 6-2. 텍스트 입력 (CardInput)

```tsx
// 기본 상태
<input
  style={{
    border: '1px solid rgba(202,196,210,0.6)',
    padding: '9px 11px', fontSize: 13, color: T.grey900,
    background: '#fff', width: '100%', outline: 'none',
    borderRadius: 6, transition: 'border-color .12s, box-shadow .12s',
  }}
  // 포커스 시 인라인 이벤트로 테두리+글로우 전환
  onFocus={(e) => {
    e.currentTarget.style.borderColor = '#0054ca';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,84,202,0.10)';
  }}
  onBlur={(e) => {
    e.currentTarget.style.borderColor = 'rgba(202,196,210,0.6)';
    e.currentTarget.style.boxShadow = 'none';
  }}
/>
```

### 6-3. 텍스트에어리어 (CardTextarea)

```tsx
<textarea
  onFocus={(e) => { e.currentTarget.style.borderColor = '#0054ca'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,84,202,0.10)'; }}
  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(202,196,210,0.6)'; e.currentTarget.style.boxShadow = 'none'; }}
  style={{
    border: '1px solid rgba(202,196,210,0.6)',
    padding: '9px 11px', fontSize: 13, color: T.grey900,
    background: '#f8f9fd',   // textarea는 surface 색
    width: '100%', outline: 'none', borderRadius: 6,
    resize: 'none', lineHeight: 1.5,
    transition: 'border-color .12s, box-shadow .12s',
  }}
/>
```

### 6-4. 셀렉트 드롭다운 (eval/my/page.tsx 패턴)

```tsx
<select
  className="appearance-none min-w-[240px] px-4 py-2 pr-10 bg-white border border-[#cac4d2] rounded-lg text-[13px] font-semibold text-[#191c1f] hover:bg-[#f2f3f7] transition-colors cursor-pointer"
/>
{/* ChevronDown 아이콘을 absolute로 우측에 */}
<ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#484551]" />
```

### 6-5. 세그먼트 토글 (정량/정성)

```tsx
<div
  role="group"
  style={{
    display: 'inline-flex',
    border: '1px solid rgba(202,196,210,0.6)',
    borderRadius: 8, overflow: 'hidden',
    background: '#f2f3f7',
  }}
>
  <button type="button" aria-pressed={!value} onClick={() => onChange(false)}
    style={{ padding: '5px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
      background: !value ? '#0054ca' : 'transparent',
      color: !value ? '#fff' : T.grey500,
    }}>
    정량
  </button>
  <button type="button" aria-pressed={value} onClick={() => onChange(true)}
    style={{ padding: '5px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
      borderLeft: '1px solid rgba(202,196,210,0.4)',
      background: value ? '#3f2c80' : 'transparent',
      color: value ? '#fff' : T.grey500,
    }}>
    정성
  </button>
</div>
```

### 6-6. 토글 스위치

```tsx
<button
  type="button" role="switch" aria-checked={value}
  onClick={() => onChange(!value)}
  style={{
    position: 'relative', width: 40, height: 22, flexShrink: 0,
    border: `1px solid ${value ? '#0054ca' : T.grey300}`,
    background: value ? '#0054ca' : T.grey200,
    borderRadius: 11, cursor: 'pointer', padding: 0,
    transition: 'background .15s ease, border-color .15s ease',
  }}
>
  <span style={{
    position: 'absolute', top: 2, left: value ? 20 : 2,
    width: 16, height: 16, background: '#fff', borderRadius: '50%',
    transition: 'left .15s ease',
  }} />
</button>
```

---

## 7. 피드백 패턴

### 7-1. 빈 상태 (EmptyState)

공용 컴포넌트 우선 사용:
```tsx
import { EmptyState } from '@/components/States';

// title 필수, description 선택, action 슬롯(행동 버튼)
<EmptyState
  title="진행 중인 평가 주기가 없어요."
  description="HR 관리자에게 문의하세요."
  action={<Button variant="secondary" size="sm">관리자에게 문의</Button>}
/>
```

카드 내 인라인 빈 상태 (공용 컴포넌트 대신 카드 안에 넣을 때):
```tsx
// dashboard/page.tsx 인라인 빈 상태 패턴
<div className="flex flex-col items-center justify-center" style={{ color: T.grey400 }}>
  <Icon size={32} color={T.grey300} />
  <p style={{ fontSize: 13, marginTop: 10 }}>데이터가 아직 없어요.</p>
</div>
```

**주의:** 빈 상태에는 반드시 **안내 메시지 + 행동 버튼(가능하면)**을 포함한다.

### 7-2. 로딩 스켈레톤

```tsx
import { Skeleton } from '@/components/States';

// 단일 블록
<Skeleton className="h-10 w-72" />
<Skeleton className="h-56 w-full" />
<Skeleton className="h-28 w-full rounded-xl" />

// 그리드 스켈레톤 패턴
<div className="grid grid-cols-4 gap-5">
  {[1,2,3,4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
</div>
```

### 7-3. 에러 상태 (ErrorState)

```tsx
import { ErrorState, Forbidden } from '@/components/States';

<ErrorState message="잠시 문제가 생겼어요." onRetry={reload} />
<Forbidden message="이 페이지에 접근할 권한이 없어요." />
```

### 7-4. Toast 알림

```tsx
import { useToast } from '@/components/Toast';
const toast = useToast();

toast.show({ variant: 'success', message: '임시저장 완료' });
toast.show({ variant: 'danger',  message: '저장에 실패했어요.' });
toast.show({ variant: 'info',    message: '안내 메시지' });
```

### 7-5. InfoBanner (인라인 안내 배너)

```tsx
import { InfoBanner } from '@/components/InfoBanner';

// tone: 'info' | 'tip' | 'warning' | 'success'
<InfoBanner tone="info" title="제목(선택)">
  안내 내용 (본문)
</InfoBanner>

// 색 토큰
// info:    bg=#EBF3FE border=#BBD6FB text=#1B4DCB
// tip:     bg=#FEF8EA border=#FBE2AE text=#8A5A00
// warning: bg=#FDECEC border=#F7C4C4 text=#AE222E
// success: bg=#E7F8EF border=#B6E6CC text=#0B7544
```

잠금/보안 배너 (어두운 배경 강조 안내 — eval/my/page.tsx 패턴):
```tsx
<div className="px-6 py-3 flex items-center gap-2" style={{ background: '#191f28' }}>
  <Lock size={14} color="#fe9800" />
  <span className="text-[12px] text-[#b0b8c1]">
    안내 텍스트 <strong className="text-white">강조 내용</strong>
  </span>
</div>
```

### 7-6. 잠금 안내 (기간 외 접근)

```tsx
// kpi/page.tsx isLocked 배너 패턴
{isLocked && (
  <div className="flex items-center gap-2 p-3"
    style={{ background: '#fff8ed', border: '1px solid #fed7aa', borderRadius: 8 }}>
    <Info size={14} color={T.orange500} />
    <span style={{ fontSize: 12, color: '#f57800' }}>
      현재 작성 기간이 아닙니다.
    </span>
  </div>
)}
```

---

## 8. 모달 패턴

```tsx
import { Modal } from '@/components/Modal';

// 기본 사용 (삭제 확인 — kpi/page.tsx 실사용 예)
<Modal
  open={deleteTarget !== null}
  onClose={() => setDeleteTarget(null)}
  title="과제를 삭제할까요?"
  primaryAction={{ label: '삭제', variant: 'danger', onClick: () => void confirmDelete() }}
  secondaryAction={{ label: '취소', onClick: () => setDeleteTarget(null) }}
  size="sm"   // sm(400px) | md(560px) | lg(720px)
>
  삭제하면 작성한 내용이 사라져요.
</Modal>
```

**모달 푸터 버튼 순서:** `secondaryAction`(좌) → `primaryAction`(우). DialogFooter가 이 순서를 강제한다.

내부 구현: shadcn Dialog — 오버레이 포털은 자동 처리됨. 별도 포털 코드 불필요.

**위험 작업(삭제·초기화·제출 철회)은 반드시 `variant: 'danger'` Modal로 확인 후 실행.**

---

## 9. 타이포·수치 스케일

| 역할 | 클래스/인라인 값 |
|------|-----------------|
| 페이지 타이틀 (PageHeader h1) | `text-[20px] font-bold leading-[1.3]` `color: #191c1f` |
| 대시보드 인사말 타이틀 | `fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px'` |
| **대형 수치 (KPI 달성률 %)** | `fontSize: 40, fontWeight: 800, letterSpacing: '-1px'` |
| **지표 숫자 (요약 카드)** | `text-[34px] font-extrabold tracking-[-0.02em]` |
| 카드 본문 수치 | `fontSize: 18, fontWeight: 800 tabular-nums` |
| 섹션 헤더 | `fontSize: 16/17, fontWeight: 700, color: #191c1f` |
| 카드 보조 타이틀 | `text-[16px] font-semibold leading-[1.4] text-[#191c1f]` |
| 본문 텍스트 | `fontSize: 13~14, fontWeight: 600` `color: #191c1f 또는 #484551` |
| 보조 텍스트 | `fontSize: 13, color: #484551(T.grey600)` |
| 힌트/메타 | `fontSize: 11~12, color: T.grey500~grey400` |
| 레이블 (UPPERCASE) | `fontSize: 10~11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: #797582` |
| 숫자 정렬 | 항상 `tabular-nums` + `font-variant-numeric: tabular-nums` |

**인라인 fontFamily 금지.** 전역 `body { font-family: var(--font-sans) }` (Pretendard Variable) 상속만.

### 수치 단위 표기

| 단위 | 표기 |
|------|------|
| 억원 이상 | `{(n/1e8).toFixed(1)}억원` |
| 만원 미만 | `${Math.round(n/1e4).toLocaleString()}만원` |
| 퍼센트 | `{Math.round(pct)}%` — tabular-nums |
| 점수 | `{score.toFixed(1)}점` |

---

## 10. UX 개선 체크리스트

재스킨 에이전트가 각 페이지에서 반드시 점검해야 할 항목:

1. **빈 상태 안내 + 행동 버튼**
   - 데이터 없을 때 "아직 없어요." 텍스트 + 관련 페이지 이동 버튼 표시 (EmptyState `action` 슬롯 활용)
   - 카드 인라인 빈 상태도 아이콘(grey300) + 안내 텍스트(grey400) 포함

2. **로딩 스켈레톤**
   - 첫 로딩에만 스켈레톤 표시 (재로드 시 전체 교체로 스크롤 리셋 방지)
   - 패턴: `if (loading && !data) return <XxxSkeleton />;`
   - 스켈레톤은 실제 레이아웃과 동일한 그리드로 구성

3. **위험 작업 확인 Modal**
   - 삭제·초기화·제출 철회는 반드시 `<Modal variant="danger">` 로 2단계 확인
   - 확인 버튼 라벨은 동사형으로 (`삭제` not `확인`)

4. **긴 목록 sticky 헤더**
   - 10개 이상 행이 있는 테이블은 `thead` 또는 헤더 행에 `sticky top-0 bg-white z-10` 적용

5. **필터 즉시 반영**
   - 드롭다운·탭 변경 시 debounce 없이 즉시 필터링 (API 호출이면 로딩 표시)

6. **폼 에러 인라인 표시**
   - 에러는 필드 아래 `<p style={{ fontSize: 11, color: T.red500, marginTop: 3 }}>에러 메시지</p>`
   - Toast로만 에러 표시하지 말고 폼 필드에 인라인 표시 병행

7. **키보드 포커스 스타일**
   - 포커스 시 `0 0 0 3px rgba(0,84,202,0.10)` glow (CardInput/CardTextarea 패턴)
   - 버튼 focus-visible: shadcn Button 기본 ring 유지

8. **날짜/숫자 포맷 일관**
   - 날짜: `toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })` 또는 `MM.DD (요일)` 형식
   - 숫자: `toLocaleString()` 또는 `tabular-nums`
   - D-day: `D-${diff}` / `D-day` 형식

9. **hover 상호작용**
   - 카드·행 hover: `borderColor`를 `rgba(63,44,128,0.25~0.30)`으로 전환 (보라 틴트)
   - 바로가기 카드: `hover:borderColor = K.secondaryDim(#336fe5)`
   - transition: `transition-colors` 또는 `transition: 'border-color .12s'`

10. **페이지 하단 여백**
    - AppShell main에 `pb-28`이 이미 있어 하단 고정 바와 충돌 방지됨
    - 고정 바 없는 페이지도 `pb-28` 유지 (사이드바 아래 자연 여백)

---

## 11. 금지 사항

| 금지 항목 | 대체 |
|-----------|------|
| `#3182f6` (Toss 블루 — CSS var primary) | `#0054ca` (K.secondary) 또는 공용 Button 컴포넌트 |
| 사각 모서리 (borderRadius: 0~4) | 카드는 12px, 버튼은 8px, 뱃지는 4~999px |
| `background: #f9fafb` (Toss 표면) | `#f8f9fd` (K.surface) 또는 `#f2f3f7` (카드 내부 서브섹션) |
| 임의 보라 계열 (`#9333ea`, `#6366f1`, `#4338ca` 등) | `#3f2c80` (K.primary) 또는 `#564599` (K.primaryContainer) |
| 페이지 루트에 외곽 padding 추가 | AppShell main이 제공, 금지 |
| 인라인 `fontFamily` 명시 | 전역 Pretendard 상속 |
| 공용 프리미티브 수정 (`PageHeader`, `Button`, `Modal`, `States`, `InfoBanner`) | 페이지별 래퍼로 확장하거나 props 활용 |
| Toss 팔레트 토큰 `toss-blue500/600` Tailwind 클래스를 액션 색으로 | `[#0054ca]` 리터럴 또는 K.secondary 상수 |
| 배경 `#1c133a` (다크 네이비) 사이드바를 콘텐츠 영역에 적용 | 사이드바 전용 — 콘텐츠 영역 금지 |
| `gradeChipColor`(lib/toss.ts) 를 S/A 등급 색으로 사용 | 위 GRADE_BADGE 상수 사용 (S=purple, A=blue) |

---

## 12. 사이드바 토큰 (AppShell — 수정 금지)

AppShell의 사이드바는 재스킨 대상이 아니므로 수정하지 않는다. 참고용으로만 기재한다.

```ts
const SIDEBAR = {
  bg:       'linear-gradient(180deg, #1c133a 0%, #151128 100%)',
  activeBg: '#4338ca',              // 활성 항목 단색 박스
  border:   'rgba(255,255,255,0.10)',
};
// 사이드바 너비: 256px (fixed, lg:left-64 오프셋과 일치)
// 로고 영역: p-8, img h-26px filter brightness(0) invert(1)
// 그룹 구분: mt-8 border-t border-white/10 pt-8
// 활성 행: rounded-xl px-4 py-3 background #4338ca
// 비활성 hover: rgba(255,255,255,0.10)
// 하단 프로필: p-6 bg-black/20, 48px 원형 아바타 border #818cf8
```

---

## 13. 페이지별 적용 요약

아래는 재스킨 에이전트가 각 페이지에서 적용해야 할 핵심 패턴의 빠른 참조다.

| 페이지 유형 | 루트 | 헤더 | 주요 패턴 |
|-------------|------|------|-----------|
| 목록/대시보드 | PageContainer | PageHeader 또는 커스텀 header | 요약 카드 그리드(§3-1), 스텝 카드(§4-4), ProgressRow |
| 폼 작성(KPI/평가) | PageContainer | PageHeader (right 슬롯) | Field+CardInput(§6), 하단 고정 액션 바(§5-4), 점선 추가 버튼(§2-6) |
| 결과/상세 조회 | `<div className="space-y-6 w-full">` | 인라인 헤더 | 요약 카드(§3-1), ProcessStepRow(§4-5), GradeTile |
| 설정/관리 | PageContainer | PageHeader | 카드 섹션 헤더(§2-3), 정보 그리드(§2-5), 토글 스위치(§6-6) |

---

*이 브리프의 모든 수치·클래스는 `apps/web/app/(main)/dashboard/page.tsx`, `eval/my/page.tsx`, `kpi/page.tsx` 및 루트 `DESIGN.md`에서 직접 추출되었다. 창작하지 않았다.*
