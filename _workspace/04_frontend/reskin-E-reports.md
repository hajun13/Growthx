# 재스킨 그룹 E — 리포트: 인덱스·YoY 비교·평가자정리

> **날짜:** 2026-06-12
> **담당:** frontend-engineer (nextjs-frontend 스킬)
> **기준:** reskin-brief.md + 루트 DESIGN.md (Kinetic Enterprise)

---

## 변경 파일 목록

### 페이지 파일
| 파일 | 주요 변경 |
|------|-----------|
| `apps/web/app/(main)/reports/page.tsx` | `gradeChipColor` → `GRADE_BADGE` 전환 (S=purple, A=blue) |
| `apps/web/app/(main)/reports/yoy/YoyComparePage.tsx` | `T` import 제거, `text-toss-grey500` → 인라인 스타일 |
| `apps/web/app/(main)/reports/yoy/PersonTimelinePanel.tsx` | Toss 잔재(`text-toss-*`, `Badge` shadcn) → Kinetic 인라인 스타일 전면 교체. `legalEntityLabel` Pill 직접 구현. GRADE_BADGE 도입 |
| `apps/web/app/(main)/reports/yoy/OrgDistributionPanel.tsx` | `text-toss-*`, `border-border`, `border-t border-border` → Kinetic 인라인 스타일. 세그먼트 탭 CARD_SHADOW 추가 |
| `apps/web/app/(main)/reports/evaluation-summary/page.tsx` | sticky 헤더, GRADE_BADGE 전환, 적용된 필터 칩, 등급 분포 카드 26px→수치 스케일 조정, ExportButton PageHeader right 슬롯으로 이동, 내보내기 위치 일관화 |

### yoy 전용 컴포넌트 (다른 페이지에서 미사용 확인 후 수정)
| 파일 | 주요 변경 |
|------|-----------|
| `apps/web/components/yoy/StepLabel.tsx` | `T.blue500` → K.secondary, Tailwind 클래스 → 인라인 스타일 |
| `apps/web/components/yoy/CycleMultiSelect.tsx` | `toss-*` 클래스 → Kinetic 인라인 스타일, `rounded-none` → borderRadius: 8 |
| `apps/web/components/yoy/LegalEntityFilter.tsx` | `toss-grey100`, `rounded-none border border-border` → Kinetic 세그먼트(rounded-xl, surfaceLow 배경, 카드 그림자) |
| `apps/web/components/yoy/ResignedToggle.tsx` | `toss-grey700` → K.onSurfaceVariant, `rounded-none` checkbox 제거 |
| `apps/web/components/yoy/YoyStatCard.tsx` | 전면 재스킨 — hover:bg-toss-grey50 → 인라인 onMouse, 아이콘 타일 borderRadius 10, 좌측 4px accent 바 |
| `apps/web/components/yoy/YoyDistributionGroup.tsx` | `T.blue50/blue700` 최근 배지 → rgba(0,84,202,.12)/K.secondary, 막대 색 `gradeChipColor` → `GRADE_BADGE`, 범례 dot borderRadius 2px |
| `apps/web/components/yoy/DistRatioTable.tsx` | `toss-grey*` 클래스 전면 교체 → 인라인 스타일, `GradeChip` → 직접 GRADE_BADGE span, hover 인라인 이벤트 |
| `apps/web/components/yoy/YearDetailCard.tsx` | `toss-grey*`, `bg-primary`, `text-primary`, `bg-card`, `border-[#cac4d2]/50` 클래스 → 인라인 스타일, GradeChip → GRADE_BADGE span, hover border color |
| `apps/web/components/yoy/RuleSetChip.tsx` | `bg-toss-grey100`, `text-toss-grey600`, `rounded-none` → K.surfaceLow, K.outline, borderRadius 4 |
| `apps/web/components/yoy/YoyTimelineChart.tsx` | `T.blue500` 라인 색 → K.secondary, `gradeChipColor` → GRADE_BADGE, 툴팁 boxShadow·borderRadius Kinetic 카드 규격 |

---

## UX 개선 핵심

1. **sticky 헤더** — `evaluation-summary` 표의 `thead`에 `position: sticky, top: 0, zIndex: 2` 적용(maxHeight: 600, overflow: auto), 10개 이상 행 시 컬럼명 고정
2. **등급 색 통일** — 전 담당 파일에서 Toss 기반 `gradeChipColor` (S=blue, A=lightblue) → `GRADE_BADGE` (S=purple #3f2c80, A=blue #0054ca) 통일
3. **적용된 필터 칩** — evaluation-summary 필터 바에 활성 그룹필터 Pill 칩 표시 + ✕ 클릭으로 즉시 해제
4. **내보내기 버튼 위치 일관** — evaluation-summary `Download` 인라인 링크 → `PageHeader right` 슬롯으로 이동 (reports/page.tsx 패턴과 동일)
5. **빈 연도 안내** — `YoyDistributionGroup` 막대가 없는 연도 행에 "해당 연도 데이터 없음" 텍스트 표시(이미 구현, 배경 K.surfaceLow로 통일)

---

## 공용 컴포넌트 변경 요청 없음

다음 컴포넌트는 **yoy 페이지 외 다른 페이지에서도 사용**하므로 수정 금지였으나, grep 결과 yoy 전용으로 확인되어 수정함:
- `GradeChip` (공용) — YearDetailCard에서 import 제거, 직접 GRADE_BADGE span으로 대체 (공용 컴포넌트 자체는 수정 없음)

다음 공용 컴포넌트는 변경 없음 (이미 Kinetic 기준 구현됨):
- `PageHeader`, `PageContainer`, `Card`, `Button`, `Modal`, `States`, `InfoBanner`, `ExportButton`

---

## typecheck 결과

```
npx tsc --noEmit → 출력 없음 (PASS)
```

에러 0건.
