# 컴포넌트 스펙 — 연도 누적(YoY) 평가 비교

> 소비자: frontend-engineer(`apps/web`). 시각 SSOT: 루트 `DESIGN.md`(Toss, border-radius **0**, 컴팩트). 토큰: 기존 Tailwind 토큰만(`grade-*`, `gradeBg-*`, `gradeFg-*`, `chart-*`, `status-*`, `toss-grey*`, `border`, `muted`). **신규 토큰 0**.
> 재사용 우선: 신규 컴포넌트는 차트 2종 + 필터 1종 + 경량 보조만. 등급색·뱃지·배너·States는 기존 컴포넌트를 그대로 import.
> 모든 점수/등급/비율 값은 백엔드 산정 그대로 표시(재계산 금지). 숫자는 `tabular-nums`. 차트는 라이브러리 없는 인라인 SVG(`MonthlyTrendChart` 패턴 준수).

---

## A. 재사용 컴포넌트 (수정 없이 사용)

| 컴포넌트 | 용도(YoY) | 비고 |
|----------|-----------|------|
| `PageHeader` | 페이지 제목 + right 슬롯(필터들) | `cycles`/`onSelectCycle` 미사용(멀티셀렉트는 패널 내부) |
| `Tabs` | 개인 타임라인 / 조직 등급분포 | `items=[{key:'person'},{key:'org'}]` |
| `InfoBanner` | **RuleDiffBanner**(규칙차이 배너) | `tone='info'`(기본), 풀 차이=`'warning'` |
| `GradeChip` | 연도별 등급 칩, 테이블 헤더 등급, 차트 점 라벨 | `grade:null` 시 "—" 자동 처리 |
| `StatusBadge` | 퇴사 뱃지(중립 톤), 법인 뱃지 | 퇴사는 `tierStyle` 톤 재사용 불가 → §C 참고(소형 전용) |
| `Select`(ui) | PersonPicker, OrgPicker, 단위 토글 | 검색형은 ui/command 조합 |
| `States`(Empty/Loading) | 빈/로딩 상태 | 차트·카드 스켈레톤 |
| `DistributionBarChart` | (단일 사이클 fallback 시 1개 분포) | 다년 비교는 `YoyDistributionGroup` 신규 |
| `OrgViewToggle` | 단위 토글(그룹/본부/팀) 세그먼트 | 라벨·아이콘만 교체 |

> 색 매핑 재사용: `gradeSolidClass`(`bg-grade-s~d`), `gradeBgClass`/`gradeFg`(연배경+텍스트) — `lib/ui.ts`. 차트 막대 채움은 `bg-grade-{s,a,b,c,d}` 클래스(혹은 SVG `fill`은 동일 HEX: S `#1B4DCB`/`#1b4dcb`는 토큰 `grade-s`, A `#3182f6`, B `#15B66E`, C `#F5A623`, D `#F04452`). DESIGN.md grade 표와 동일.

---

## B. 신규 — 주요 컴포넌트 (3)

### B1. `YoyTimelineChart` — 개인 연도별 등급 추이 (인라인 SVG)

한 임직원의 연도별 최종등급을 스텝/라인으로. 점수 비반영 사이클은 시각적으로 구분.

```ts
interface YoyTimelinePoint {
  cycleId: string;
  year: number;
  grade: Grade | null;        // null=미집계 → 회색 점, 라인 단절
  score: number | null;       // 툴팁 표시용(최종점수)
  org: { group: string; division: string | null; team: string | null };
  reflected: boolean;         // 점수 등급 반영 여부(역량 미반영 연도 등)
}
interface YoyTimelineChartProps {
  points: YoyTimelinePoint[]; // 연도 오름차순
  height?: number;            // 기본 200
}
```

- **Y축**: 등급 5단계(S 위 → D 아래). `gradeRank: {S:5,A:4,B:3,C:2,D:1}`로 y 좌표.
- **선/점**: `stroke-primary`(#3182f6) 2px. 점 r=4 `fill`=해당 grade 색. `reflected:false`이거나 인접 점이 null이면 그 구간 `stroke-dasharray="4 4"` + 점 `fill=#b0b8c1`(toss-grey400).
- **점 위 라벨**: `<GradeChip grade size="sm">` 대신 SVG `<text>`로 등급 1글자(렌더 단순화) — 등급 색 텍스트. **색만으로 구분 금지** → 항상 글자 병기(이미 글자라 충족).
- **X축**: 연도 라벨(`text-[10px] fill-muted-foreground`), 하단.
- **툴팁**(hover/focus): 연도·등급·점수·당시 조직(group › division › team). 키보드 포커스 가능(각 점 `tabindex=0`, `role="img"` aria-label에 전체 요약).
- **접근성**: 루트 `role="img"` `aria-label="등급 추이 — 2024 A, 2025 B(역량 미반영), 2026 A"`.
- **상태**: `points.length===0` → 부모가 `States.Empty` 처리(차트는 그리지 않음). `length===1` → 점 1개 중앙(라인 없음).
- **반응형**: `viewBox` 고정 + `width:100%`, `min-w-[420px]` + `overflow-x-auto` 부모 래퍼.
- 신규 토큰 없음. border-radius 0(SVG라 무관). 사각 카드 안에 배치.

### B2. `YoyDistributionGroup` — 조직 연도별 등급분포 비교 (그룹 막대, 인라인 SVG)

연도별 S~D 분포를 가로 그룹 막대로. `결론` 시트의 그룹별 등급분포 재현.

```ts
interface YoyDistRow {
  cycleId: string;
  year: number;
  total: number;
  counts: Record<Grade, number>;
  ratios?: Record<Grade, number>;  // 0~1, 없으면 counts/total
  poolCaps?: Record<Grade, number>; // 옵션 — 풀 상한 점선 마커
}
interface YoyDistributionGroupProps {
  rows: YoyDistRow[];        // 연도 오름차순
  mode?: 'grouped' | 'stacked'; // 기본 'grouped'(연도 행마다 S~D 5막대)
  showRatio?: boolean;       // 막대 끝 라벨에 비율 표기(기본 true)
}
```

- **레이아웃(grouped 기본)**: 연도별 1행, 행 안에 S·A·B·C·D 5개 막대(가로). 각 막대 `fill`=grade 색(B1과 동일 HEX). 막대 끝에 `인원(비율%)` 텍스트.
- **stacked 옵션**: 연도별 1개 100% 누적 막대(S→D 순). 분포 형태 비교에 적합. 작은 화면 기본값으로 권장.
- **풀 상한 마커**: `poolCaps` 있으면 해당 등급 막대에 점선 마커(`DistributionBarChart`의 `border-pool-cap-marker` 패턴 = `#191F28` 점선). 초과 시 막대 `fill=#F04452`(danger) + "초과" 텍스트 — 기존 규칙 동일.
- **범례**: 하단 `■S ■A ■B ■C ■D`(grade 색 + 라벨). 색만으로 구분 금지 → 라벨 필수.
- **법인필터/퇴사자 토글 결과**는 부모가 이미 필터링한 `rows`를 전달(컴포넌트는 표시만).
- **접근성**: `role="img"` aria-label에 연도별 분포 요약. 각 막대 `<title>`로 등급·인원·비율.
- **빈/단일**: `rows.length===0` → 부모 Empty. `===1` → 1행만(비교 아님, 정상).
- **반응형**: lg 가로 막대 정상 / md 높이 축소 / <768 권장 `mode='stacked'` 세로 카드(부모가 mode 전환). 래퍼 `overflow-x-auto min-w-[480px]`.

### B3. `LegalEntityFilter` — 법인별 보기 필터

에너지엑스㈜ / 미래환경플랜 토글. 조직도는 통합, 법인은 집계 필터로만.

```ts
type LegalEntity = 'energyx' | 'mirae_plan';
interface LegalEntityFilterProps {
  value: 'all' | LegalEntity;
  onChange: (v: 'all' | LegalEntity) => void;
  counts?: Record<'all' | LegalEntity, number>; // 옵션 — 각 옵션 인원수 뱃지
}
```

- **형태**: 세그먼트(pill 아님 — Toss 사각). 3옵션: `전체` / `에너지엑스㈜` / `미래환경플랜`. `OrgViewToggle`과 동일 마크업 패턴(`role="tablist"`, 활성 `bg-card font-semibold`, 비활성 `text-muted-foreground`). **단 border-radius 0**(OrgViewToggle은 rounded 사용 → YoY는 `rounded-none`으로 오버라이드해 DESIGN.md 준수).
- **법인 뱃지 라벨 매핑**(`lib/ui.ts`에 추가 권장):
  ```ts
  legalEntityLabel = { energyx: '에너지엑스㈜', mirae_plan: '미래환경플랜' };
  legalEntityStyle = {
    energyx:   'bg-toss-grey100 text-toss-grey700',   // 중립
    mirae_plan:'bg-primary-50 text-primary-700',      // 블루 톤 구분
  };
  ```
- **퇴사자 표시 토글**(`ResignedToggle`)은 별도 소형 체크/스위치로 이 필터 옆에 배치(§C2).
- 신규 토큰 0(기존 색만).

---

## C. 신규 — 경량 보조 컴포넌트

### C1. `CycleMultiSelect` — 비교 사이클 다중 선택 (칩)

```ts
interface CycleOption { cycleId: string; year: number; name: string; }
interface CycleMultiSelectProps {
  options: CycleOption[];          // closed 사이클만
  selected: string[];              // cycleId[]
  onChange: (ids: string[]) => void;
  min?: number;                    // 기본 1
}
```
- 토글 칩들(연도 라벨). 활성=`bg-primary-50 text-primary-700 border-primary-500`, 비활성=`bg-card text-toss-grey600 border-border`. **사각(rounded-none)**, 높이 28px.
- 선택 0개 방지(min). 정렬: 연도 오름차순.

### C2. `ResignedToggle` — 퇴사자 표시 토글

```ts
interface ResignedToggleProps { checked: boolean; onChange: (v: boolean) => void; }
```
- 라벨 "퇴사자 포함" + ui/switch 또는 체크박스(기존 ui 사용). 캡션 hint: 조직 분포 탭에서 "과거 분포는 당시 재직 인원 기준이에요"(기본 ON 권장).

### C3. `YearDetailCard` — 연도별 상세 카드 (개인 탭)

```ts
interface YearDetailCardProps {
  year: number;
  finalGrade: Grade | null;
  finalScore: number | null;
  perfScore: number | null;
  compScore: number | null;        // 역량 — null이면 "—", 값 있으면 "(참고)" 캡션
  org: { group: string; division: string | null; team: string | null };
  orgChanged?: boolean;            // 전년 대비 조직 변경 시 • + "변경"
  ruleSummary: { competencyIncluded: boolean; perfWeight: number };
}
```
- 사각 카드(`border border-border bg-card`, padding 16). 상단 등급 `GradeChip`(soft) + 점수. 중단 실적/역량 행. 하단 조직 3줄 + `RuleSetChip`.
- **역량 행**: `compScore!=null` → `82 (참고)` — "(참고)" `text-toss-grey500 text-[11px]`. null → `—`. 절대 등급/연봉 반영 표시 금지(참고용 명시).
- `orgChanged` → 그룹/본부/팀 변경된 줄 앞에 `•`(primary) + 줄 끝 `변경` 캡션.

### C4. `RuleSetChip` — 사이클 RuleSet 요약 칩

```ts
interface RuleSetChipProps {
  competencyIncluded: boolean;     // 역량평가 포함 여부
  reflected?: boolean;             // 점수 반영 여부(역량은 false)
  perfWeight?: number;             // 실적 가중치(%)
}
```
- 소형 칩: `실적 100%` 또는 `실적 70%·역량(참고)`. 배경 `bg-toss-grey100 text-toss-grey600`, 사각, `text-[11px]`. 역량 포함이지만 미반영이면 "역량(참고)" 회색.

### C5. `DistRatioTable` — 등급 비율 테이블 (조직 탭)

```ts
interface DistRatioTableProps {
  rows: YoyDistRow[];              // B2와 동일 타입
  showDelta?: boolean;            // 전년 대비 ▲▼(기본 false)
}
```
- 표 헤더: 연도 · 총원 · S · A · B · C · D · (평균등급). 등급 헤더는 `GradeChip size="sm" variant="soft"`(라벨만). 셀 = `인원(비율%)` `tabular-nums`.
- `결론` 시트 재현. 스트라이프 없음(Toss 컴팩트), 행 구분선 `border-b border-border`. 헤더 `bg-toss-grey50`.
- `showDelta` → 비율 셀 아래 `▲2%`(success-600) / `▼3%`(danger-600) 캡션.

---

## D. 등급 색 매핑 (단일 출처 — 재확인)

| 등급 | SVG fill / `bg-grade-*` | 연배경 `gradeBg` | 텍스트 `gradeFg` |
|------|------------------------|------------------|------------------|
| S | `#1B4DCB` (grade-s) | `#e7eefc` | `#16409f` |
| A | `#3182F6` (grade-a) | `#ebf3fe` | `#1b64da` |
| B | `#15B66E` (grade-b) | `#e7f8ef` | `#0f9457` |
| C | `#F5A623` (grade-c) | `#fef6e6` | `#a66800` |
| D | `#F04452` (grade-d) | `#fdecec` | `#ae222e` |

> DESIGN.md grade 표 = `lib/ui.ts` gradeBgClass/gradeSolidClass = Tailwind `grade-*`/`gradeBg-*`/`gradeFg-*`. 셋 다 동일 — **신규 색 추가 금지**. C는 solid 위 흰 텍스트 경계이므로 칩은 soft(연배경+진한 텍스트), 막대 채움에만 solid 사용(기존 규칙 동일).

---

## E. 상태 매트릭스 (전 컴포넌트 공통)

| 상태 | 처리 |
|------|------|
| 로딩 | `States.Loading` — 차트/카드/표 스켈레톤. 차트 영역은 회색 박스. |
| 빈 (결과 없음) | `States.Empty` — "비교할 평가 결과가 아직 없어요." |
| 단일 사이클 | 차트/표 1줄 정상 렌더(비교 아님, 경고 아님) |
| 미집계 등급(null) | `GradeChip`이 "—" 자동. 차트는 회색 점 + 라인 단절 |
| 규칙 차이 | `RuleDiffBanner`(InfoBanner) 표시 — 역량 미반영/풀 차이 |
| 퇴사자 | 헤더/목록 퇴사 뱃지 + 회색. 데이터는 정상(보존). 토글로 분포 포함 제어 |
| 권한 외 (RBAC 403) | Empty "열람 권한이 없어요." (백엔드 스코핑 신뢰) |

---

## F. 반응형 규칙 (요약 — design-tokens.md 브레이크포인트)

| 구간 | 개인 탭 | 조직 탭 |
|------|---------|---------|
| lg ≥1024 | 차트 풀폭 + 연도 카드 3열 | 그룹 막대 + 테이블 풀폭 |
| md 768–1023 | 차트 풀폭 + 카드 2열(가로 스크롤) | 막대 높이 축소 + 테이블 가로 스크롤 |
| <768 | 차트 `overflow-x-auto` + 카드 1열 | `YoyDistributionGroup mode='stacked'` + 테이블 → 연도 카드 리스트 |

선택바(사람/사이클/필터)는 <768에서 세로 스택, gap-2.

---

## G. frontend 구현 주의점 (계약·정합성)

1. **신규 컴포넌트 3 + 보조 5만 추가**. 등급색·배너·뱃지·States·Tabs·Select는 import 재사용(중복 구현 금지).
2. **border-radius 0** — `OrgViewToggle` 패턴 복사 시 `rounded-lg/md`를 `rounded-none`으로 교체(DESIGN.md SSOT). 칩·세그먼트·카드 전부 사각.
3. SVG 차트 색은 `lib/ui` HEX와 1:1(`grade-*`). 하드코딩 시 D §D 표 값만.
4. 백엔드 값 표시만 — 비율/평균등급 재계산 금지. `compScore`는 참고용 표기 강제("(참고)").
5. 응답 unwrap·camelCase·훅 타입은 기존 `useEvaluations`/`useResults` 패턴 따름. `legalEntity`/`employmentStatus`/`orgSnapshot` 필드 신규 — `lib/types.ts`에 추가 필요(`LegalEntity`, `EmploymentStatus`, `OrgSnapshot`).
6. `lib/nav.ts`에 `yoy` 항목 + `activeKeyForPath('/reports/yoy')` `/reports`보다 우선 매칭. `AppShell` `NAV_ICONS['yoy']=TrendingUp`.
7. `lib/ui.ts`에 `legalEntityLabel`/`legalEntityStyle`, `employmentStatusLabel`(active/on_leave/resigned→재직/휴직/퇴사) 추가.
8. RBAC: 화면 가드는 UX 보조일 뿐, 실제 스코핑은 백엔드. division_head/team_lead는 PersonPicker·OrgPicker 옵션을 백엔드가 좁혀 내려줌.
