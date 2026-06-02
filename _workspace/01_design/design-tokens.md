# 디자인 토큰 — 인사평가 솔루션 (TDS 디자인 언어 차용 · v2 도메인 정정)

> **권위 자료:** 운영계획 PPT + `domain-model.md` + `business-rules.md`. **시각 언어:** `tds-design-language.md`(TDS 차용).
> **v2 변경:** 다면(peer/upward) 차트색 제거 → self/downward1/downward2 3색 체계. 그룹 풀 상한 마커색(`pool-cap-marker`) 추가. 등급 S~D·평가 상태 4색 유지(역량 전용 토큰 없음 — 추가 제거분 없음).
> **라이선스:** TDS 패키지 임포트 금지. 공개 디자인 원칙만 참고해 독자 토큰으로 재현한다.
> **사용처:** frontend-engineer가 `apps/web`의 `tailwind.config.ts` + CSS 변수로 1:1 변환. 토큰명은 **확정값**(변경 금지).
> **단위:** 색은 HEX, 치수는 px(별도 표기 외), 타이포 행간은 배수. 모든 값은 수치 — 추상 표현 없음.

---

## 0. 토큰 사용 규칙 (요약)

- **Primary = 토스 블루 `#3182F6`** 계열. 주요 액션·진행중·활성 링크.
- **등급 색(S~D)·평가 상태 색은 전역 고정 시맨틱.** 화면마다 재정의 금지 — `GradeChip`/`ComparisonBar`/`StatusBadge`가 공유.
- **등급은 색만으로 구분하지 않는다.** 항상 라벨(S/A/B/C/D) 병기. 대비 AA 이상.
- 폰트는 **Pretendard**(웹폰트 self-host), 폴백 system 산세리프.

---

## 1. 색상 (Color)

### 1.1 Primary — 토스 블루 (신뢰·진행·주요 액션)

| 토큰 | HEX | 용도 |
|------|-----|------|
| `primary-50`  | `#EBF3FE` | 활성 배경·선택 칩 배경 |
| `primary-100` | `#D2E4FD` | hover 배경 |
| `primary-200` | `#A9CCFB` | 보더(연한) |
| `primary-300` | `#7DB2F9` | 비활성 액센트 |
| `primary-400` | `#509AF7` | 그라데이션 보조 |
| `primary-500` | `#3182F6` | **메인 Primary**(버튼·진행 바·활성 탭 밑줄) |
| `primary-600` | `#1B64DA` | hover/press(버튼) |
| `primary-700` | `#1450B4` | 진한 강조 텍스트 |
| `primary-800` | `#0E3C87` | — |
| `primary-900` | `#0A2C63` | — |

### 1.2 Success / Accent — 그린 (완료·코치마크·finalized)

| 토큰 | HEX | 용도 |
|------|-----|------|
| `success-50`  | `#E7F8EF` | 완료 배경·코치마크 배경 |
| `success-100` | `#C5EFD7` | — |
| `success-500` | `#15B66E` | **메인 Success**(완료 배지·코치마크 말풍선) |
| `success-600` | `#0F9457` | hover/press |
| `success-700` | `#0B7544` | 텍스트 강조 |

### 1.3 Warning — 앰버 (주의·미완료·정성 초과 경고)

| 토큰 | HEX | 용도 |
|------|-----|------|
| `warning-50`  | `#FEF6E6` | 경고 배경(연함) |
| `warning-100` | `#FCEAC0` | — |
| `warning-500` | `#F5A623` | **메인 Warning**(정성 KPI 30% 초과 주의·미완료 강조) |
| `warning-600` | `#D98A0E` | hover/텍스트 |
| `warning-700` | `#A66800` | 텍스트(배경 대비) |

### 1.4 Danger — 레드 (오류·반려·가중치 합 초과·삭제)

| 토큰 | HEX | 용도 |
|------|-----|------|
| `danger-50`  | `#FDECEC` | 오류 배경·반려 배경 |
| `danger-100` | `#FAD2D2` | — |
| `danger-500` | `#F04452` | **메인 Danger**(가중치 합 ≠100·반려·삭제·풀 초과) |
| `danger-600` | `#D6303D` | hover/press |
| `danger-700` | `#AE222E` | 텍스트 강조 |

### 1.5 Neutral — 그레이 스케일 (텍스트·보더·배경)

| 토큰 | HEX | 용도 |
|------|-----|------|
| `neutral-0`   | `#FFFFFF` | 카드·표면 배경 |
| `neutral-50`  | `#F9FAFB` | 페이지 배경·표 헤더 |
| `neutral-100` | `#F2F4F6` | 입력 비활성 배경·구분 영역 |
| `neutral-200` | `#E5E8EB` | 보더(기본)·구분선 |
| `neutral-300` | `#D1D6DB` | 보더(강조)·비활성 보더 |
| `neutral-400` | `#B0B8C1` | placeholder·비활성 아이콘 |
| `neutral-500` | `#8B95A1` | 보조 텍스트(캡션) |
| `neutral-600` | `#6B7684` | 본문 보조 텍스트 |
| `neutral-700` | `#4E5968` | 본문 텍스트(서브) |
| `neutral-800` | `#333D4B` | 본문 텍스트(기본) |
| `neutral-900` | `#191F28` | 제목·강조 텍스트 |

**텍스트 별칭(시맨틱):** `text-primary`=`neutral-900`, `text-body`=`neutral-800`, `text-secondary`=`neutral-600`, `text-caption`=`neutral-500`, `text-disabled`=`neutral-400`, `text-inverse`=`neutral-0`.

### 1.6 평가 상태 색 (`Evaluation.status` 전역 시맨틱) — domain-model §5

| 상태 | 한글 | 토큰(텍스트) | 토큰(배경) | HEX 텍스트 / 배경 |
|------|------|-------------|-----------|------------------|
| `not_started` | 미평가 | `status-not-started-fg` | `status-not-started-bg` | `#6B7684` / `#F2F4F6` |
| `in_progress` | 진행중 | `status-in-progress-fg` | `status-in-progress-bg` | `#1B64DA` / `#EBF3FE` |
| `submitted`   | 제출   | `status-submitted-fg`   | `status-submitted-bg`   | `#4B43BD` / `#ECEBFB` (인디고) |
| `finalized`   | 확정   | `status-finalized-fg`   | `status-finalized-bg`   | `#0F9457` / `#E7F8EF` |

> KPI 상태 보조 매핑(`StatusBadge` 재사용): `draft`→not-started 톤, `submitted`→submitted 톤, `approved`→in-progress 톤, `confirmed`→finalized 톤, `rejected`/`revision_requested`→danger 톤(`#D6303D`/`#FDECEC`).

### 1.7 등급 시맨틱 색 (S~D 전역 고정) — business-rules §1

`GradeChip`·`GradeRadio`·`ComparisonBar`·`DistributionBarChart`·`ResultTable` 공통. **대비 AA 보장**(fg는 bg 위, solid는 흰 텍스트 위).

| 등급 | 의미 | `grade-*-solid` (막대/칩 채움) | `grade-*-fg` (텍스트) | `grade-*-bg` (연배경) | 라벨 |
|------|------|------------------------------|----------------------|----------------------|------|
| S | 최우수(딥블루) | `#1B4DCB` | `#16409F` | `#E7EEFC` | "S" |
| A | 우수(블루)     | `#3182F6` | `#1B64DA` | `#EBF3FE` | "A" |
| B | 표준(그린)     | `#15B66E` | `#0F9457` | `#E7F8EF` | "B" |
| C | 보통(앰버)     | `#F5A623` | `#A66800` | `#FEF6E6` | "C" |
| D | 미흡(레드)     | `#F04452` | `#AE222E` | `#FDECEC` | "D" |

> solid 위 텍스트는 항상 `neutral-0`(흰색). `grade-C-solid`(#F5A623) 위 흰 텍스트 대비는 경계이므로 C 칩은 **bg+fg 조합**(연배경+진한 텍스트)을 기본으로 쓰고, 막대 채움에만 solid 사용.

### 1.8 차트/비교 보조 색

| 토큰 | HEX | 용도 |
|------|-----|------|
| `chart-company-avg` | `#191F28` | `ComparisonBar` 전사 평균 마커(세로선) |
| `chart-grid`        | `#E5E8EB` | 차트 그리드 라인 |
| `chart-self`        | `#8B95A1` | 본인평가(self) 막대(중립, 유형 구분용) |
| `chart-downward-1`  | `#3182F6` | 1차 팀장(downward round1) 막대 |
| `chart-downward-2`  | `#1B4DCB` | 2차 본부장(downward round2) 막대 |
| `pool-cap-marker`   | `#191F28` | `DistributionBarChart` 그룹 풀 상한 점선 마커 |
| `pool-over`         | `#F04452` | 풀 상한 초과 막대 강조(= `danger-500`) |

> **v2:** 평가 유형은 self + downward(1차·2차) 3종뿐 — 수평(peer) 막대색 `chart-peer` **제거**. 유형별 색은 등급 색과 충돌하지 않게 **명도 단계**로 구분. 막대 안 등급/점수 텍스트는 별도 표기(색만으로 구분 금지). 풀 상한 마커는 분포 막대 위 점선(`pool-cap-marker`), 초과 시 막대를 `pool-over`로 강조 + "초과" 텍스트 병기.

### 1.9 포커스/오버레이

| 토큰 | 값 | 용도 |
|------|-----|------|
| `focus-ring` | `#3182F6` (2px, offset 2px) | 키보드 포커스 링 |
| `overlay`    | `rgba(25,31,40,0.48)` | 모달 딤 |

---

## 2. 타이포그래피 (Typography)

**Font family:** `--font-sans: "Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;`
**Numeric:** 점수·달성률·가중치 표시에 `font-variant-numeric: tabular-nums`(정렬용 고정폭 숫자).

| 토큰 | size(px) | line-height | weight 기본 | 용도 |
|------|----------|-------------|-------------|------|
| `text-xs`   | 11 | 1.45 (16px) | 500 | 캡션·배지·표 보조 |
| `text-sm`   | 13 | 1.5 (20px)  | 400 | 보조 본문·라벨 |
| `text-base` | 15 | 1.6 (24px)  | 400 | **기본 본문** |
| `text-md`   | 17 | 1.5 (26px)  | 600 | 카드 타이틀·강조 본문 |
| `text-lg`   | 20 | 1.4 (28px)  | 600 | 섹션 제목 |
| `text-xl`   | 24 | 1.35 (32px) | 700 | 페이지 제목 |
| `text-2xl`  | 28 | 1.3 (36px)  | 700 | 대시보드 큰 수치 |
| `text-3xl`  | 34 | 1.25 (42px) | 700 | 점수 대형 표시(ScoreCard·ReportCard) |

**Weight 토큰:** `font-regular`=400, `font-medium`=500, `font-semibold`=600, `font-bold`=700.
**Letter-spacing:** 제목(`text-xl`↑) `-0.02em`, 본문 `-0.01em`, 숫자 `0`.

---

## 3. 간격 (Spacing) — 4px 기준 스케일

| 토큰 | px |
|------|-----|
| `space-0` | 0 |
| `space-1` | 4 |
| `space-2` | 8 |
| `space-3` | 12 |
| `space-4` | 16 |
| `space-5` | 20 |
| `space-6` | 24 |
| `space-8` | 32 |
| `space-10` | 40 |
| `space-12` | 48 |
| `space-16` | 64 |

**레이아웃 상수:** 사이드바 너비 `sidebar-w`=240, 상단탭 높이 `topbar-h`=56, 페이지 좌우 패딩 `page-x`=32(lg↑)/16(md↓), 카드 내부 패딩 `card-pad`=20, 콘텐츠 최대폭 `content-max`=1280.

---

## 4. 반경 (Radius) — TDS 큰 라운드

| 토큰 | px | 용도 |
|------|-----|------|
| `radius-sm`   | 8  | 배지·칩·작은 입력·라디오 박스 |
| `radius-md`   | 12 | **기본 카드·버튼·입력 필드** |
| `radius-lg`   | 16 | 모달·큰 패널·코치마크 |
| `radius-full` | 9999 | 아바타·도넛·pill 토글 |

---

## 5. 그림자 (Elevation) — 가벼운 그림자

| 토큰 | 값 | 용도 |
|------|-----|------|
| `shadow-sm` | `0 1px 2px rgba(25,31,40,0.04), 0 1px 3px rgba(25,31,40,0.06)` | 카드(기본) |
| `shadow-md` | `0 2px 8px rgba(25,31,40,0.08), 0 1px 3px rgba(25,31,40,0.06)` | hover 카드·드롭다운 |
| `shadow-lg` | `0 8px 28px rgba(25,31,40,0.16), 0 2px 8px rgba(25,31,40,0.08)` | 모달·우하단 고정 액션 바 |
| `shadow-focus` | `0 0 0 2px #FFFFFF, 0 0 0 4px #3182F6` | 포커스 더블 링 |

---

## 6. 브레이크포인트 (Breakpoint) — 데스크탑 우선

| 토큰 | min-width(px) | 레이아웃 동작 |
|------|---------------|--------------|
| `sm` | 640  | 모바일 가로 / 작은 태블릿 |
| `md` | 768  | 태블릿: 사이드바→드로어, 3분할→세로 스택 |
| `lg` | 1024 | **데스크탑 기준**: 사이드바 고정, 3분할 표시 |
| `xl` | 1280 | 와이드: 콘텐츠 max 1280 중앙 정렬 |

> 데스크탑 우선. `lg` 미만에서 사이드바는 드로어로, 좌-중-우 3분할 평가 화면은 세로 스택, 점수 입력 표는 카드 리스트로 전환.

---

## 7. 모션 (Motion)

| 토큰 | 값 | 용도 |
|------|-----|------|
| `duration-fast`   | 120ms | hover·포커스 |
| `duration-base`   | 200ms | 탭 전환·드롭다운 |
| `duration-slow`   | 320ms | 모달·드로어 |
| `easing-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | 기본 |
| `easing-emphasis` | `cubic-bezier(0.2, 0, 0, 1)` | 진입 강조 |

> `prefers-reduced-motion: reduce` 시 모든 transition `duration` → 0ms, 페이드만 유지.

---

## 8. Tailwind config 변환 가이드 (frontend 참고)

```ts
// tailwind.config.ts (발췌 — frontend-engineer가 이 매핑대로 확정)
theme: {
  extend: {
    colors: {
      primary: { 50:'#EBF3FE',100:'#D2E4FD',200:'#A9CCFB',300:'#7DB2F9',
                 400:'#509AF7',500:'#3182F6',600:'#1B64DA',700:'#1450B4',
                 800:'#0E3C87',900:'#0A2C63' },
      success: { 50:'#E7F8EF',100:'#C5EFD7',500:'#15B66E',600:'#0F9457',700:'#0B7544' },
      warning: { 50:'#FEF6E6',100:'#FCEAC0',500:'#F5A623',600:'#D98A0E',700:'#A66800' },
      danger:  { 50:'#FDECEC',100:'#FAD2D2',500:'#F04452',600:'#D6303D',700:'#AE222E' },
      neutral: { 0:'#FFFFFF',50:'#F9FAFB',100:'#F2F4F6',200:'#E5E8EB',300:'#D1D6DB',
                 400:'#B0B8C1',500:'#8B95A1',600:'#6B7684',700:'#4E5968',800:'#333D4B',900:'#191F28' },
      grade: { // S~D solid (막대/칩 채움)
        s:'#1B4DCB', a:'#3182F6', b:'#15B66E', c:'#F5A623', d:'#F04452' },
    },
    borderRadius: { sm:'8px', md:'12px', lg:'16px', full:'9999px' },
    fontSize: {
      xs:['11px',{lineHeight:'16px'}], sm:['13px',{lineHeight:'20px'}],
      base:['15px',{lineHeight:'24px'}], md:['17px',{lineHeight:'26px'}],
      lg:['20px',{lineHeight:'28px'}], xl:['24px',{lineHeight:'32px'}],
      '2xl':['28px',{lineHeight:'36px'}], '3xl':['34px',{lineHeight:'42px'}],
    },
    spacing: { 1:'4px',2:'8px',3:'12px',4:'16px',5:'20px',6:'24px',8:'32px',10:'40px',12:'48px',16:'64px' },
    screens: { sm:'640px', md:'768px', lg:'1024px', xl:'1280px' },
    boxShadow: {
      sm:'0 1px 2px rgba(25,31,40,0.04), 0 1px 3px rgba(25,31,40,0.06)',
      md:'0 2px 8px rgba(25,31,40,0.08), 0 1px 3px rgba(25,31,40,0.06)',
      lg:'0 8px 28px rgba(25,31,40,0.16), 0 2px 8px rgba(25,31,40,0.08)',
    },
    fontFamily: { sans:['"Pretendard Variable"','Pretendard','system-ui','sans-serif'] },
  }
}
```

> 평가 상태색(§1.6)·등급 fg/bg(§1.7)·차트색(§1.8)은 별도 CSS 변수 또는 `colors.status.*`/`colors.gradeFg.*` 네임스페이스로 확장한다. 토큰명은 본 문서 표의 키를 따른다.
</content>
</invoke>
