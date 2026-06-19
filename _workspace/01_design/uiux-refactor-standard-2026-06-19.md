# EnergyX UIUX Refactor Standard

Date: 2026-06-19
Scope: apps/web full UIUX refactor
Status: v1 기준안

## 1. 목표

이번 리팩토링의 목표는 프론트를 "다시 칠하는" 수준이 아니라, 실제 납품 가능한 HR 업무 제품으로 재구성하는 것이다.

- 대시보드 화면의 현재 톤을 기준으로 전 페이지 시각 언어를 통일한다.
- 모든 화면을 공통 컴포넌트와 공통 패턴 위에서 재구성한다.
- 사용자가 다음에 해야 할 일을 즉시 알 수 있게 한다.
- 과장된 장식, AI 생성물처럼 보이는 카드 나열, 보라색 장식 남발, 둥근 pill 남발을 제거한다.
- 접근성, 폼 오류, 테이블 조작, 빈 상태, 로딩 상태까지 납품 기준으로 만든다.

## 2. 권위 자료

외부 UX 기준은 아래 자료를 기준으로 해석한다.

| 자료 | 적용 기준 |
| --- | --- |
| Nielsen Norman Group, 10 Usability Heuristics | 상태 가시성, 실제 업무 언어, 되돌리기, 일관성, 오류 예방, 기억보다 인식, 미니멀한 정보 설계 |
| W3C WCAG 2.2 / WAI-ARIA APG | 키보드 조작, 포커스, 명도 대비, 상태 메시지, 탭/모달/테이블 접근성 |
| GOV.UK validation pattern | 상단 오류 요약, 필드별 오류, 입력값 보존, 제출 시점 검증 |
| IBM Carbon Data Table / Filtering | 테이블 툴바, 검색, 필터, 행 액션, 페이지네이션, 스켈레톤 로딩 |
| Dashboard Design Patterns | 요약, 이상징후, 다음 액션, 상세 탐색의 대시보드 구조 |

레포 내부 권위는 아래 순서로 따른다.

1. `DESIGN.md`
2. `packages/ui/tailwind-preset.cjs`
3. `apps/web/app/globals.css`
4. 현재 대시보드 화면: `apps/web/features/dashboard/ui/DashboardView.tsx`
5. 공용 컴포넌트: `apps/web/components/*`, `apps/web/components/ui/*`

## 3. 시각 방향

기준 화면은 현재 대시보드다.

- 배경은 솔리드 neutral canvas를 유지한다.
- 표면은 흰색, 보더, 얕은 중립 그림자로 구분한다.
- Primary purple은 핵심 CTA, 선택 상태, 진행 중 상태에만 사용한다.
- 정보 밀도는 유지하되, 화면마다 요약과 다음 액션을 먼저 배치한다.
- Lucide 라인 아이콘을 사용하되, 아이콘 장식 영역을 과하게 키우지 않는다.
- 문구는 한국어 업무 언어로 쓴다. 내부 구현 용어와 영어 상태값은 화면에 노출하지 않는다.

## 4. Radius 원칙

사용자 확정 기준: 컴포넌트 라운드는 무조건 8px로 통일한다.

- 카드, 패널, 버튼, 입력, 셀렉트, 모달, 드롭다운, 배지, 칩 모두 최종 시각 반경은 8px이다.
- `rounded-xl`, `rounded-2xl`, `rounded-full`, pill 형태는 신규 UI에서 금지한다.
- 예외처럼 보이는 진행바, 아바타, 점 indicator도 제품 전반의 AI 느낌을 줄이기 위해 과한 pill을 피하고, 필요한 경우에만 8px 안에서 처리한다.
- 다만 페이지 구성은 "8px 카드만 반복"하지 않는다. 8px 컴포넌트와 무반경 구분선을 섞는다.

적용 방식:

- 컴포넌트 표면: `rounded-lg` 또는 토큰 기반 8px.
- 테이블 헤더/행: 무반경 또는 컨테이너 8px, 내부 셀은 라운드 없음.
- 페이지 섹션: 카드가 필요한 정보 묶음만 8px panel. 넓은 구역, 탭 본문, 데이터 영역은 보더/구분선 기반 flat surface도 허용.
- nested card 금지. 카드 안 카드가 필요해 보이면 section header, divider, inset row, table, list로 바꾼다.

## 5. AI처럼 보이지 않게 하는 규칙

아래 패턴은 금지한다.

- 보라색 그라데이션, 오로라, 글래스, 빛나는 그림자, 큰 decorative blob.
- 동일한 둥근 카드가 3열 이상 반복되는 구성.
- 모든 정보를 badge/chip으로 감싸는 구성.
- Hero처럼 큰 타이포와 큰 카드가 업무 화면 상단을 차지하는 구성.
- 내용 없는 "인사이트", "AI 추천", "스마트 분석" 같은 문구.
- 의미 없는 아이콘 원형 배경 반복.
- 실제 업무보다 시각 장식이 먼저 보이는 레이아웃.

대체 원칙:

- 실제 업무의 다음 단계가 먼저 보인다.
- 수치와 상태는 작고 정확하게, 설명은 짧게 쓴다.
- 시각적 차이는 색보다 구조, 정렬, 간격, 타이포 굵기로 만든다.
- 화면별 개성을 만들기보다 제품 전체의 반복 학습성을 우선한다.

## 6. 페이지 구조 표준

모든 업무 페이지는 아래 구조 중 하나를 따른다.

### A. 업무 실행형

KPI 작성, 본인평가, 부서장평가, 중간점검에 적용한다.

1. PageHeader: 화면명 + 짧은 설명 + 대표 CTA
2. WorkSummary: 현재 상태, 마감, 완료율, 다음 단계
3. TaskRail: 지금 해야 할 항목
4. MainWorkArea: 작성/검토/평가 본문
5. SideContext: 기준, 이전 입력, 피드백, 변경 이력

### B. 데이터 운영형

사용자 관리, 권한, 규칙, 보상, 감사 로그, 리포트에 적용한다.

1. PageHeader: 화면명 + 주요 액션
2. FilterBar: 검색, 필터, 주기 선택, 초기화
3. DataToolbar: 총 건수, 선택 수, export/import, batch action
4. DataTable: 정렬, 행 액션, 빈 상태, 로딩 상태
5. DetailDrawer 또는 Modal: 상세 편집

### C. 요약 대시보드형

대시보드, 리포트, 조직 현황에 적용한다.

1. PageHeader
2. SummaryBand: 핵심 3~4개 수치
3. ExceptionPanel: 지연, 누락, 확인 필요
4. Trend/Distribution
5. RecentActivity 또는 DetailTable

## 7. 공통 컴포넌트 리팩토링 대상

우선 정비할 컴포넌트:

- `PageHeader`: 페이지 상단 규격, action slot, cycle select, help tooltip 정리.
- `Card` / `gx-panel`: 8px radius, border, shadow, header/body spacing 통합.
- `DataTable`: toolbar, filter, empty, loading, selection, row action까지 확장.
- `FilterBar`: 검색, select, chip, reset의 공통 조합.
- `StatusBadge`: status/grade/cycle/action item을 하나의 tone 체계로 통합.
- `Button` / `IconButton`: 8px radius, icon placement, loading, destructive.
- `FormField` / `ErrorSummary`: GOV.UK 기준의 폼 오류 UX.
- `Modal` / `Drawer` / `ConfirmDialog`: 위험 작업, 편집, 상세 보기의 공통 패턴.
- `EmptyState` / `Skeleton`: 화면별로 새로 만들지 않고 공통화.

## 8. 폼 UX 기준

- 제출 전까지 사용자가 입력한 값은 유지한다.
- 오류는 제출 시점에 표시한다. 실시간 검증은 길이 제한처럼 즉시 도움이 되는 경우만 쓴다.
- 오류 발생 시 상단 ErrorSummary와 필드별 errorText를 함께 표시한다.
- 오류 문구는 "무엇이 문제인지"와 "어떻게 고칠지"를 같이 말한다.
- 저장, 임시저장, 제출, 승인, 반려는 모두 완료 피드백을 제공한다.
- 파괴적 작업은 ConfirmDialog를 거친다.

## 9. 테이블 UX 기준

- 데이터 테이블은 충분한 가로 공간을 확보한다.
- 테이블 안에 테이블을 넣지 않는다.
- 검색/필터/표시 설정/내보내기는 테이블 상단 toolbar에 둔다.
- 행 액션이 2개 이하이면 아이콘 버튼으로 노출하고, 3개 이상이면 overflow menu를 쓴다.
- hover state는 항상 둔다.
- 긴 목록은 pagination 또는 명확한 lazy loading을 둔다.
- 로딩은 spinner보다 skeleton을 우선한다.
- 숫자 열은 우측 정렬 + tabular numbers를 사용한다.

## 10. 접근성 기준

- 모든 아이콘 버튼은 `aria-label`을 가진다.
- focus ring은 제거하지 않는다.
- 색만으로 상태를 전달하지 않는다. 텍스트 라벨을 함께 둔다.
- 탭, 모달, 드롭다운, tooltip은 ARIA 패턴을 따른다.
- 모바일에서도 텍스트가 버튼/카드 밖으로 넘치지 않아야 한다.
- 최소 목표는 WCAG 2.2 AA 수준이다.

## 11. 구현 순서

1. 토큰/프리미티브 정리: radius 8, surface, typography, button, card, table.
2. 페이지 쉘 정리: AppShell, PageHeader, PageContainer, navigation.
3. 대시보드 패턴 확정: SummaryBand, TaskRail, timeline, activity table.
4. 핵심 업무 화면 재구성: KPI 작성, 내 평가표, 본인평가, 부서장평가, 중간점검.
5. 운영 화면 재구성: 사용자, 권한, 주기, 규칙, 보상, 감사 로그.
6. 리포트 화면 재구성: 요약, YoY, 평가결과, 조직 분포.
7. QA: typecheck, build, 주요 라우트 브라우저 확인, 데스크톱/모바일 확인.

## 12. 완료 기준

- 모든 신규/수정 화면이 8px radius 원칙을 따른다.
- AI처럼 보이는 장식 패턴이 없다.
- 페이지별로 사용자의 다음 행동이 첫 화면에서 보인다.
- 공통 컴포넌트 없이 페이지별 adhoc 스타일을 만들지 않는다.
- 데이터/폼/상태/빈 상태/로딩/오류가 같은 패턴으로 동작한다.
- `pnpm -C apps/web typecheck`와 `pnpm -C apps/web build`를 통과한다.
- 주요 화면을 실제 브라우저에서 확인한다.
