---
version: v3-toss
name: toss-design-system
description: >
  에너지엑스 인사평가 시스템 디자인 언어 — Toss(토스) 디자인 시스템 기반.
  Figma Make 생성 레퍼런스 파일 기준(C:\Users\user\Downloads\인사 평가 사이트 UIUX 디자인).
  데이터 중심 앱에 최적화된 컴팩트·고밀도 UI.
  글꼴: Pretendard (Noto Sans KR 동등, 한글 최적화).

# 색상 시스템 (Toss Color System)

## Primary (Blue)
colors:
  blue50: "#f2f4f6"      # hover/selected bg
  blue100: "#dbeafe"
  blue300: "#64a8ff"     # chart, 보조
  blue500: "#3182f6"     # PRIMARY — 버튼, 액션, 링크
  blue600: "#2272eb"     # hover state
  blue700: "#1b64da"     # active, focus, active nav text

## Grey Scale (Text / Surface)
  grey50:  "#f9fafb"     # page bg, hover
  grey100: "#f2f4f6"     # 카드 내부 분리선 bg
  grey200: "#e5e8eb"     # 카드 border, divider
  grey300: "#d1d6db"     # 비활성 border
  grey400: "#b0b8c1"     # 비활성 텍스트, placeholder
  grey500: "#8b95a1"     # 보조 텍스트 (label, meta)
  grey600: "#6b7684"     # 본문 보조
  grey700: "#4e5968"     # 본문 (nav 기본 텍스트)
  grey800: "#333d4b"
  grey900: "#191f28"     # 최고 강조 텍스트, 제목

## Semantic
  green500: "#03b26c"    # 성공, 완료, 긍정 등급(B)
  green100: "#e7f8ef"    # 성공 배경
  red500:   "#f04452"    # 오류, 위험, 이의제기 뱃지
  red50:    "#fdecec"    # 오류 배경
  orange500: "#fe9800"   # 경고, 진행중
  orange50:  "#fef6e6"   # 경고 배경
  purple500: "#a234c7"   # 보조 강조

## Background / Surface
  white:     "#ffffff"   # 카드, 패널 bg
  pageBg:    "#f9fafb"   # 페이지 배경
  sidebarBg: "#ffffff"   # 사이드바 배경
  headerBg:  "#ffffff"   # 헤더 배경

# 타이포그래피

font:
  family: "'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif"
  sizes:
    xs:   "10px"    # 메타, 뱃지 숫자
    sm:   "11px"    # 캡션, 레이블 상단
    base: "12px"    # 표준 텍스트
    md:   "12.5px"  # 본문
    lg:   "13px"    # 섹션 타이틀
    xl:   "20px"    # 페이지 헤더
    hero: "22px"    # KPI 대형 수치
  weights:
    normal: 400
    medium: 500
    semibold: 600
    bold: 700

# 레이아웃

layout:
  sidebarWidth: "216px"
  headerHeight: "52px"
  pagePadding:  "24px"
  cardGap:      "12px"

# 컴포넌트 규칙

corners:
  # 핵심 원칙: border-radius 최소화 (sharp, 데이터 앱 느낌)
  default: "0px"          # 카드, 버튼, 입력필드 → square
  badge:   "0px"          # 뱃지/태그도 사각
  avatar:  "50%"          # 아바타만 원형 (is-circle)
  icon:    "0px"          # 아이콘 박스 사각

# 아이콘 박스 (사이드바 nav 아이템)
iconBox:
  size: "24x24px"
  colors:
    core:  "#191f28"       # 대시보드, 조직도
    eval:  "#3182f6"       # 평가 관련 전체
    admin: "#4e5968"       # 관리/설정
    alert: "#d22030"       # 이의제기

# 카드
card:
  bg:      "#ffffff"
  border:  "1px solid #e5e8eb"
  padding: "16px-22px"     # 상황별

# 버튼 Primary
button:
  primary:
    bg:    "#3182f6"
    hover: "#2272eb"
    text:  "#ffffff"
    height: "32px"
    padding: "0 16px"
    radius: "0px"
    font: "12.5px 600"

# 사이드바 Nav 활성 상태
navActive:
  bg:          "#f2f4f6"
  borderLeft:  "2px solid #3182f6"
  textColor:   "#1b64da"
  fontWeight:  600

navInactive:
  textColor:   "#4e5968"
  fontWeight:  400

# 뱃지 (알림 카운트)
badge:
  bg:     "#f04452"
  text:   "#ffffff"
  size:   "16x16px"
  font:   "9.5px 700"

# 상태 색상 (도메인 — 유지)
grade:
  S: { bg: "#e7eefc", text: "#16409f", label: "S" }
  A: { bg: "#ebf3fe", text: "#1b64da", label: "A" }
  B: { bg: "#e7f8ef", text: "#0f9457", label: "B" }
  C: { bg: "#fef6e6", text: "#a66800", label: "C" }
  D: { bg: "#fdecec", text: "#ae222e", label: "D" }

# 레퍼런스 화면 (Figma Make 파일 기반)
# 위치: C:\Users\user\Downloads\인사 평가 사이트 UIUX 디자인\src\app\components\

screens:
  - id: dashboard    file: Dashboard.tsx    route: /dashboard
  - id: orgchart     file: OrgChart.tsx     route: /org
  - id: hr-main      file: HRMain.tsx       route: /eval
  - id: kpi-write    file: KPIWrite.tsx     route: /kpi
  - id: kpi-review   file: KPIReview.tsx    route: /kpi/review
  - id: self-eval    file: SelfEval.tsx     route: /eval/self
  - id: dept-eval    file: DeptEval.tsx     route: /eval/dept-head
  - id: eval-results file: EvalResults.tsx  route: /eval/result
  - id: group-perf   file: GroupPerf.tsx    route: /admin/group-performance
  - id: monthly-perf file: MonthlyPerf.tsx  route: /reports (월별탭)
  - id: dist-monitor file: DistMonitor.tsx  route: /reports
  - id: appeals      file: Appeals.tsx      route: /appeals
  - id: comp-simul   file: CompSimul.tsx    route: /admin/compensation
  - id: settings     file: Settings.tsx     route: /admin/settings
  - id: audit-log    file: AuditLog.tsx     route: /audit or /admin/audit
  # 제외: CompItems.tsx, CompEval.tsx — 역량평가는 도메인에 없음

# 공통 레이아웃 컴포넌트 (레퍼런스)
layout_components:
  - file: Sidebar.tsx   → apps/web/components/AppShell.tsx (사이드바 섹션)
  - file: Header.tsx    → apps/web/components/AppShell.tsx (헤더 섹션)

# 적용 지침
guidelines:
  1: "inline style 기반 컴포넌트 — Tailwind 클래스와 혼용 가능, style prop 우선"
  2: "border-radius는 기본 0px. 아바타만 is-circle (borderRadius: '50%')"
  3: "모든 hover 상태는 onMouseEnter/onMouseLeave로 처리 (디자인 파일 패턴 유지)"
  4: "글꼴은 Pretendard 유지 (Noto Sans KR 대신)"
  5: "역량평가(CompItems, CompEval) 화면 완전 제외 — 사이드바에서도 제거"
  6: "기존 RBAC/인증 로직 (useAuth, visibleNav) 유지"
  7: "기존 API hooks (useKpis, useEvaluations 등) 유지 — UI만 교체"
  8: "recharts 차트 라이브러리 사용 (디자인 파일과 동일)"
