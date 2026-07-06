---
name: EnergyX Part-Hybrid Design System
version: "2026-part-hybrid"
brand: ENERGYX (에너지엑스)
primary: "#0257CE"
typeface: Pretendard
language: ko-KR
---

# EnergyX Part-Hybrid Design System

에너지엑스 인사 평가의 시각 언어 **단일 SSOT**. 클라이언트 확정 시안(`Part/image N.png`, 2026-07-02)과 `_workspace/01_design/part-revision-brief.md`를 본문으로 승격한 버전이다. 이전 "Notion-Low-Color"(radius 0·웜 그레이·#0075DE) 체계는 **전면 폐기**한다.

핵심 정체성: **쿨 그레이 캔버스 + 흰 카드(10px 라운드·옅은 그림자) + 진네이비 타이포 + 액션 블루 1색 + 사이드바 전용 퍼플 + 5색 등급 배지.**

## 1. 원칙

- **액션 컬러 1개:** 본문 강조는 액션 블루 `#0257CE` 하나. 민트 `#0ED0D9`는 차트·보조 포인트만.
- **퍼플은 사이드바 전용:** `#564599`(활성 `#4A3B85`)는 사이드바 배경에만 쓴다. 본문 UI에 퍼플 배경/텍스트 금지(등급 S 배지 `#7C3AED`는 별개 토큰).
- **카드 10px 라운드:** 카드·패널·표 컨테이너는 radius 10px + 헤어라인 + 옅은 중립 그림자. radius 0 플랫(구 Notion)과 대형 라운드(12px+) 모두 금지.
- **쿨 그레이 스케일:** 웜 그레이(#F6F5F4·#E6E2DE 계열) 금지. 캔버스 `#F8F9FD`, 헤어라인 `#E7E9F3`, 텍스트 진네이비 `#161326`.
- **Pretendard 유지:** 행간 1.45~1.6, 자간 0, `tabular-nums`.
- **AI 느낌 제거:** 그라데이션, 글래스, 컬러 섀도, 장식용 컬러 블록, 마케팅형 히어로 금지.
- **업무 밀도:** 빈 여백은 실제 상태·다음 작업·검증 요약·최근 변경·처리 큐로 채운다.

## 2. 컬러

### Core (인라인 스타일은 `apps/web/lib/palette.ts`의 `T`, 클래스는 tailwind preset 토큰 사용 — 새 hex 하드코딩 금지)

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--surface-page` | `#F8F9FD` | 앱 캔버스 |
| `--surface-card` | `#FFFFFF` | 카드·패널·입력 표면 |
| `--surface-muted` | `#F4F5FA` | 정보 영역, 표 헤더, 비활성 배경 |
| `--border-subtle` | `#E7E9F3` | 기본 헤어라인 |
| `--border-default` | `#D8DCEB` | 강조 보더, 입력 보더 |
| `--text-strong` | `#161326` | 제목, 핵심 수치 (진네이비) |
| `--text-default` | `#2D2A3D` | 본문 |
| `--text-muted` | `#6B6980` | 보조 설명, 캡션 |
| `--text-faint` | `#9B98AC` | placeholder, 비활성 |
| `--color-primary` | `#0257CE` | 주 액션, 링크, 진행중, 포커스 |
| `--color-primary-hover` | `#0246A8` | primary hover |
| `--color-primary-subtle` | `#EAF2FE` | 선택/활성 연한 배경 |
| `--color-sidebar` | `#564599` | **사이드바 배경 전용** |
| `--color-sidebar-active` | `#4A3B85` | 사이드바 활성 메뉴 |
| `--color-accent-teal` | `#0ED0D9` | 차트 포인트·보조 강조 (`#E4FBFB` subtle) |

### 상태색

작은 배지·점·텍스트·아이콘에 쓴다. 대형 배경 면 금지.

| 상태 | bg | 텍스트 |
| --- | --- | --- |
| 미평가/대기 | `#F4F5FA` | `#6B6980` |
| 작성 중/진행중/접수 | `#EAF2FE` | `#0257CE` |
| 검토 중 | `#FFF6DC` | `#B4790A` |
| 수정요청 | `#FFEEDD` | `#C2570A` |
| 반려/오류 | `#FDE8E8` | `#C81E1E` |
| 승인완료/작성완료/정상 | `#E3F7EC` | `#0B7A47` |

배지 형태: Pill(`rounded-full`), 패딩 4px 10px, 12px/600.

### 등급 색 (전 화면 공통 — `lib/grade.ts`·`palette.ts gradeChipColor`가 코드 SSOT)

| 등급 | Solid bg | 텍스트 | Soft bg | Soft 텍스트 |
| --- | --- | --- | --- | --- |
| S | `#7C3AED` | `#FFFFFF` | `#F3EBFE` | `#6D28D9` |
| A | `#0EA05E` | `#FFFFFF` | `#E3F7EC` | `#0B7A47` |
| B | `#F97316` | `#FFFFFF` | `#FFEEDD` | `#C2570A` |
| C | `#F5B400` | `#FFFFFF`(사용자 확정 2026-07-06 — 진갈색 폐기) | `#FFF6DC` | `#8A5B00` |
| D | `#EF4444` | `#FFFFFF` | `#FDE8E8` | `#C81E1E` |

배지·차트 누적바·범례는 Solid 세트 재사용(화면별 톤 파생 금지). 설명 패널의 부차 표시만 Soft. 등급은 항상 문자+색 동시 표기.

## 3. 타이포그래피

- 단일 패밀리: `"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif`
- 페이지 제목 20~24px/700 · 섹션 제목 16~18px/600~700 · 본문 14px/400~500 · 표/메타 12~13px/500~600 · 핵심 수치 ~34px/700
- 볼드(700)는 제목·핵심 수치·현재 선택 값에만. 색으로 강조된 요소에 볼드 중복 금지.
- 숫자 `tabular-nums`, 긴 한국어 문장 `break-keep`.

## 4. 간격과 레이아웃

- 기준 단위 4px. 카드 내부 20~24px(표 밀집형 16px). 카드 간 16~20px. 화면 여백 desktop 24~32px / mobile 16px.
- AppShell이 페이지 여백을 제공한다 — 페이지에서 추가 최상위 패딩 금지.
- 패턴: 대시보드 `주요 작업 + 보조 레일`, 작성/평가 폼 `좌 작성 + 우 기준/상태 레일`, 관리 화면 `필터바 + 표 + 세부 패널`.

## 5. 반경 (globals.css `--ex-radius-*` 토큰 사용)

| 대상 | 값 | 토큰 |
| --- | --- | --- |
| 카드, 패널, 표 컨테이너, 다이얼로그 | `10px` | `--ex-radius-card` / `.gx-panel` / `.gx-work-surface` |
| 버튼, 입력, 셀렉트, 텍스트영역 | `8px` | `--ex-radius-control` |
| 작은 라벨/칩(비상태) | `6px` | `--ex-radius-label` |
| 상태 배지, 필터 pill | `9999px` | `--ex-radius-pill` |
| 아바타, 진행 노드 | `9999px` | |

`rounded-none`·radius 0(구 Notion)과 `rounded-xl` 이상(12px+) 모두 신규 코드 금지. 예외: 표 내부 셀, 세그먼트 컨트롤 중간 항목, 컨테이너에 맞닿아 잘리는 내부 요소 등 구조적으로 0이 맞는 곳.

## 6. 엘레베이션

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| 카드/패널 | `0 1px 3px rgba(22,19,38,.06), 0 1px 2px rgba(22,19,38,.04)` | `.gx-panel`·`.gx-work-surface` 기본 |
| 드롭다운 | `0 4px 12px rgba(22,19,38,.10)` | |
| 모달 | `0 10px 28px rgba(22,19,38,.14)` | |
| 포커스 링 | `0 0 0 2px rgba(2,87,206,.22)` | |

컬러 섀도 금지. 중립(네이비 틴트) 그림자만.

## 7. 컴포넌트 규칙

- **Button:** 주요/승인만 `#0257CE` solid+흰 텍스트. 보조/반려/수정요청은 흰 배경+`#D8DCEB` 보더+`#4A4860` 텍스트(그레이 outline — "반려=빨강 solid" 금지). 파괴적 액션은 red outline+확인 모달. 링크형은 `#0257CE` 텍스트. 높이 36px(표 내부 28~32px), radius 8px.
- **Card/Panel:** `.gx-panel`/`.gx-work-surface`(흰 배경·헤어라인·10px·옅은 그림자). 선택 강조는 `1.5px solid #0257CE` + `#EAF2FE`.
- **Table:** 헤더 `#F4F5FA`, 행 구분 헤어라인, 컬러 배경 행 금지, sticky 헤더 허용.
- **Badge/Chip:** 상태 배지는 Pill+§2 상태색. 등급 배지는 `GradeChip`(Solid).
- **Tabs:** 하단 2px 인디케이터(`#0257CE`).
- **진행 스테퍼:** 완료 노드 진네이비 `#161326` bg+흰 체크, 진행중 `#0257CE` bg+흰 숫자, 미도래 흰 배경+`#D8DCEB` 보더. 연결선 완료 2px solid / 미도래 2px dashed.
- **Avatar:** `components/Avatar.tsx` — 사진 없으면 이름 해시 파스텔 5색 로테이션+진한 톤 이니셜. 검은 배경 이니셜 금지.
- **Charts:** 그레이 기본, 강조 1개만 blue, 등급 분포는 등급 Solid 5색. 다단계 평가 라운드 색: 1차 `#0257CE`/2차 `#7C3AED`/3차 `#0ED0D9`.
- **Icons:** Lucide line, `currentColor`, 16~20px. 이모지 금지.
- **정보 영역(CSF/목표/평가방식):** 카드 상단 3열 그리드, `#F4F5FA` 배경 radius 8px inset, 라벨 12px `#6B6980` / 값 14px `#2D2A3D`.

## 8. 페이지 패턴

- **업무 홈/대시보드:** 오늘 할 일, 마감, 평가 단계 스테퍼, 미완료 큐, 최근 변경.
- **작성/평가 폼:** 좌측 작성, 우측 기준/상태/검증 레일.
- **관리 화면:** 상단 필터바(그룹→본부→팀 캐스케이드 셀렉트, 36px, radius 8px), 중앙 테이블, 우측/모달 세부.
- **결과/리포트:** 수치·표 우선, 등급만 5색, 나머지는 굵기·정렬·헤어라인으로 위계.
- **빈 상태:** 안내 문장 + 실제 다음 행동 버튼. 장식 일러스트 금지.

## 9. 금지 목록

- 본문 퍼플(배경·텍스트) — 사이드바·등급 S 배지 제외.
- radius 0 카드(구 Notion 플랫), 12px+ 대형 라운드, pill 카드.
- 웜 그레이 팔레트(#F6F5F4/#F0EFED/#E6E2DE/#D8D3CD/#615D59/#9A948E/#2F2E2C/#111111 텍스트), 구 primary #0075DE, 구 Kinetic(#3f2c80/#0054ca)·Toss(#3182f6).
- 그라데이션, 글래스모피즘, 컬러 섀도, 검정/진회색 배경 박스, 검은 배경 이니셜.
- 대형 상태색 배경, 의미 없는 마케팅형 히어로, 데이터 화면의 빈 장식 공간.

## 10. 코드 SSOT 매핑

| 관심사 | 파일 |
| --- | --- |
| 인라인 색 토큰 `T`·상태/그룹/등급 칩 | `apps/web/lib/palette.ts` |
| 등급 색·라벨 | `apps/web/lib/grade.ts`, `components/GradeChip.tsx` |
| tailwind 토큰(여러 앱 공유) | `packages/ui/tailwind-preset.cjs` |
| CSS 변수·`.gx-*` 유틸 | `apps/web/app/globals.css` |
| 시안 원본 | `Part/image N.png`, `_workspace/01_design/part-revision-brief.md` |

최종 갱신: 2026-07-03 — Part 하이브리드를 단일 SSOT로 승격(Notion-Low-Color 본문 폐기), 전 화면 디자인 통일 기준.
