# 재스킨 영역 A — 평가 플로우 페이지

작업일: 2026-06-11
범위: eval/self · eval/dept-head · eval/midterm · midterm 컴포넌트 · competency/eval

---

## 변경 파일 목록

| 파일 | 주요 변경 |
|------|----------|
| `app/(main)/eval/self/page.tsx` | K 팔레트 추가, 카드/인풋/버튼/배너 전면 Kinetic 전환 |
| `app/(main)/eval/dept-head/page.tsx` | K 팔레트 추가, 카드·멤버 리스트·KpiEvalCard·헬퍼 컴포넌트 Kinetic 전환 |
| `app/(main)/eval/midterm/page.tsx` | T import 제거, K 상수 모듈 레벨화, 탭 언더라인/배지 Kinetic 전환 |
| `app/(main)/eval/midterm/EmployeeMidterm.tsx` | T→K 전환, 상태 배너·KpiCheckInCard·자가등급 버튼·ProgressStat Kinetic 전환 |
| `app/(main)/eval/midterm/DeptHeadMidterm.tsx` | T import 제거, 구성원 리스트 패널·Subsection 컴포넌트 Kinetic 전환 |
| `components/MidtermProgressTable.tsx` | T import 제거, 테이블 헤더·섹션 헤더·행 호버 Kinetic 전환 |
| `app/(main)/competency/eval/page.tsx` | 카테고리 색 Kinetic 팔레트 재매핑, 버튼·카드·탭 전면 Kinetic 전환 |

---

## 페이지별 요약

### eval/self/page.tsx
- `K.primary #3f2c80`, `K.secondary #0054ca`, `K.tertiary #0e9aa0` 상수 추가
- 카드: `rounded-xl`, `border rgba(202,196,210,0.5)`, `boxShadow 0 4px 12px rgba(86,69,153,0.05)`
- 상태 배지: Pill (borderRadius 999)
- 읽기전용 배너: teal 틴트
- 제출 버튼: K.primary 배경 + 보라 그림자
- 증빙 아이템: rounded-lg, rgba 테두리

### eval/dept-head/page.tsx
- 멤버 리스트 패널: rounded-xl, `#f8f9fd` 검색바, 활성 상태 `rgba(0,84,202,0.05)` + K.secondary 좌측 바
- KpiEvalCard: rounded-xl hover, `#f8f9fd` 헤더, self-eval 밴드 `#f2f3f7`
- PoolBars: 회색 배경 `#f2f3f7`, 범례 텍스트 리터럴 색
- GradePicker: borderRadius 8, rgba 테두리 미선택
- GradeBadge/StatusPill: borderRadius 999 (pill)
- SelfStatusBanner: teal/orange rgba 틴트 배너로 전환
- T.blue500/T.grey* 잔재 전부 리터럴 색 또는 K.* 로 교체

### eval/midterm/page.tsx
- 탭 언더라인: `#3f2c80` (K.primary)
- 탭 비활성 텍스트: `#797582`
- 상태 배지: pill (borderRadius 999), 점검 기간=K.tertiary
- T import 완전 제거

### EmployeeMidterm.tsx
- 상태 배너: teal rgba / orange rgba 배경
- KpiCheckInCard: rounded-xl, `#f8f9fd` 헤더, 구분선 rgba
- 자가등급 선택 버튼: borderRadius 999, `#f2f3f7` 비선택 배경
- 타입 라벨 칩: pill (borderRadius 999)
- 목표 재조정 collapsible: rounded-xl, `#f8f9fd` 헤더
- ProgressStat/GradeBadge: 리터럴 Kinetic 색, GradeBadge에 borderRadius 999

### DeptHeadMidterm.tsx
- Subsection 컴포넌트: rounded-xl + CARD_SHADOW, `#f8f9fd` 헤더
- 구성원 리스트: rounded-xl, K.secondary 활성 좌측 바
- T import 완전 제거

### MidtermProgressTable.tsx
- thead 배경: `#f8f9fd`
- 섹션 헤더 배경: `#f2f3f7`
- 행 구분선: `rgba(202,196,210,0.3)`
- 호버: `hover:bg-[#f8f9fd]`
- 타입 라벨 칩: pill
- T import 완전 제거

### competency/eval/page.tsx
- 카테고리 색 재매핑: 리더십=K.primary, 협업=K.tertiary, 혁신=K.secondary
- 통계 카드: rounded-xl + CARD_SHADOW
- 탭 버튼: pill (borderRadius 999)
- 문항 카드: rounded-xl, `#f8f9fd` 헤더
- 점수 버튼: borderRadius 8, rgba 테두리
- 제출 버튼: K.primary 배경 + 보라 그림자
- hardcoded `#3182f6` (Toss blue) 전부 K.primary/K.secondary로 교체

---

## UX 개선 포인트

1. 상태 배너 — 기존 초록/노랑 플랫 배경 → teal/orange rgba 틴트로 전환, Kinetic 색 시스템과 통일
2. 등급 배지/상태 칩 — 사각형 → Pill(borderRadius 999), 전반적으로 부드러운 인상
3. KPI 카드 — 헤더 `#f8f9fd` 배경으로 구조 명확화, hover 시 보라 틴트 테두리
4. 자가등급/점수 선택 버튼 — 원형 pill 버튼으로 통일, 선택 상태 명확
5. 카테고리 탭 — pill 스타일로 전환 (competency)
6. 구성원 패널 — 활성 행에 K.secondary 좌측 바로 포커스 명확화
7. 텍스트 계층 — `#191c1f` / `#333d4b` / `#484551` / `#797582` / `#b3b0bb` 5단계 Kinetic 명도 스케일 적용

---

## TypeScript 결과

담당 영역 A 파일 오류: **0건**

참고: `admin/permissions/page.tsx`, `admin/users/page.tsx`에서 TS1127 Invalid character 오류 다수 발생 — 재스킨D 에이전트 작업 영역으로 Area A와 무관.

---

## 주의사항 (wrapper 보정 기록)

- `gradeChipColor` (lib/toss.ts) — 공용 lib, 수정 불가. 등급 배지는 기존 `gradeChipColor.bg/color` 사용. 단, borderRadius 999 추가(페이지 레벨)로 pill 형태로 보정.
- `InfoBanner`, `Card`, `Button`, `TextField` 공용 컴포넌트 — 수정 없음, 페이지 레벨 wrapper/스타일로 보정.
