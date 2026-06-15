# 재스킨 그룹 B — 중간점검·재조정 관리 (2026-06-12)

> **담당 에이전트:** frontend-engineer
> **기준 브리프:** `_workspace/01_design/reskin-brief.md`
> **DESIGN.md SSOT:** 루트 `DESIGN.md` (Kinetic Enterprise)

---

## 수정 파일 목록

| 파일 | 수정 내용 |
|------|----------|
| `apps/web/app/(main)/eval/midterm/page.tsx` | TabButton 색 `#3f2c80` → `#0054ca` (SectionTabBar와 통일), whiteSpace: nowrap 추가 |
| `apps/web/app/(main)/eval/midterm/EmployeeMidterm.tsx` | GRADE_BADGE 상수 도입(gradeChipColor 교체), 입력 포커스 glow, 제출 상태 배너 개선, 빈 상태 아이콘+텍스트, 등급 기준 레이블 UPPERCASE 통일 |
| `apps/web/app/(main)/eval\midterm/DeptHeadMidterm.tsx` | 구성원 헤더 아바타+상태 칩 디자인 개선, 확인수/전체수 tabular-nums 강조, 미제출 빈 상태 아이콘+텍스트, 재조정 탭 안내 InfoBanner 스타일, rounded-2xl → rounded-xl 통일 |
| `apps/web/app/(main)/eval/midterm/RebaselineReviewQueue.tsx` | K/CARD_SHADOW 상수 추가, 빈 상태 카드 섹션 헤더 추가, 모달 textarea Kinetic 스타일(포커스 glow+배경), 텍스트 색 T.grey700 → #484551 통일 |
| `apps/web/app/(main)/eval/midterm/RebaselineRequestSection.tsx` | CARD_SHADOW 상수 추가, 반려/승인 배너 rounded-xl + Kinetic 색 토큰(InfoBanner tone과 일치), 사유 텍스트 색 통일, EmptyState action 슬롯에 행동 버튼 추가 |
| `apps/web/app/(main)/eval/midterm/OrgProgressCard.tsx` | Stat 컴포넌트 레이블 UPPERCASE 10px, 수치 22px font-extrabold tabular-nums, sticky thead 헤더, 테이블 헤더 UPPERCASE 스케일, 행 hover 스타일 |

## 수정 금지 확인 (다른 그룹 페이지에서도 사용하는 공용 컴포넌트)

아래 컴포넌트는 담당 페이지 외에서도 임포트되므로 수정하지 않았다.

| 컴포넌트 | 이유 |
|---------|------|
| `MidtermProgressTable` | `eval/midterm/DeptHeadMidterm.tsx`에서만 사용 — 수정 가능 범위이나 구조 변경 없어도 브리프 목표 달성 |
| `ActionItemRow` | 다수 페이지에서 공유 가능 — 수정 없음 |
| `RebaselineTable`, `WeightSummaryBar`, `RebaselineStatusBadge`, `RebaselineHistory` | 공용 프리미티브 — 수정 금지, 사용 측에서 디자인 통일 |
| `ActionItemFormModal` | 공용 — 수정 금지 |

## UX 개선 사항 (브리프 §10 체크리스트)

1. **빈 상태 안내 + 행동 버튼** — `EmployeeMidterm` 보완조치·피드백 탭, `DeptHeadMidterm` 자가점검 미제출 상태: 아이콘(grey300) + 안내 텍스트(grey400) 패턴 적용. `RebaselineRequestSection` EmptyState에 "목표 재조정 요청" 버튼 추가.
2. **로딩 스켈레톤** — 기존 `if (loading && !data) return <Skeleton />;` 패턴 유지(재로딩 시 스크롤 리셋 없음).
3. **입력 포커스 glow** — `EmployeeMidterm` KPI 자가점검 textarea/input, `RebaselineReviewQueue` 모달 textarea: `0 0 0 3px rgba(0,84,202,0.10)` glow + `#0054ca` 테두리.
4. **등급 칩 통일** — `gradeChipColor`(toss 기반, S=gray, A=blue) → `GRADE_BADGE`(Kinetic: S=purple, A=true-blue) 교체.
5. **tabular-nums 강조** — 확인수/전체수, Stat 수치에 tabular-nums + extrabold 적용.
6. **sticky 테이블 헤더** — `OrgProgressCard` 카테고리 표 `thead` → `sticky top-0 z-10`.
7. **날짜 포맷** — `toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })` 통일 (기존 `ko-KR` default에서 month+day 명시).
8. **상태 배너 디자인** — 반려(#FDECEC/#F7C4C4), 승인(#E7F8EF/#B6E6CC) — InfoBanner warning/success 토큰과 통일.
9. **구성원 헤더** — 아바타 원형 칩 + 자가점검 상태 Pill 배지 (미제출 grey, 제출완료 amber, 확인완료 teal).

## TypeScript 검사 결과

담당 파일 범위 에러: **0건**

기존 에러 (비담당, 수정 금지):
- `apps/web/components/OrgStructureBoard.tsx` — 인코딩/문자 관련 기존 에러 (담당 범위 외, 이번 작업과 무관)
