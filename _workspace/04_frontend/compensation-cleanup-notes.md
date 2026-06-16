# 보상 현황 표 정리 — 변경 요약

날짜: 2026-06-16

## 변경 파일
- `apps/web/features/admin-compensation/ui/columns.ts`
- `apps/web/features/admin-compensation/ui/GradeChip.tsx`
- `apps/web/features/admin-compensation/ui/CompensationRow.tsx`
- `apps/web/features/admin-compensation/ui/CompensationView.tsx`

---

## §1 삭제된 컬럼

| 삭제 항목 | 이유 |
|---|---|
| `25.02기준(월)` (careerBaseMonths) | 사용자 피드백 — 불필요 |
| `경력직급` (careerPosition) | 사용자 피드백 — 불필요 |
| `등급` sticky 컬럼 (currentGrade 단독) | 등급 전환 셀로 통합 |
| 연봉 셀의 `GradeChip` (전년도·금년도 셀 하단) | 등급 전환 셀로 통합 |

---

## §2 연차 계산 변경

- 이전: `row.serviceYears` DTO 필드 직접 사용
- 변경: `Math.floor(totalCareerMonths / 12)` 파생 계산 (DTO 설명과 일치)
- null 이면 "—" 표시

---

## §3 신규 컬럼 — 등급(작년→올해)

- 위치: 인상률(col 16) **바로 왼쪽** (col 15)
- 컴포넌트: `GradeTransition` (GradeChip.tsx 에 추가, ~20줄)
- 표시 로직:
  - 양쪽 모두 없으면 "—"
  - previousGrade 있으면 색상 칩, 없고 previousCycleYear < 2025 이면 "도입전" 회색 칩, 없고 연도도 없으면 "—"
  - currentGrade 있으면 색상 칩, 없으면 "—"
  - 두 칩 사이 "→" 화살표, 셀 가운데 정렬

---

## §4 최종 컬럼 순서 (20개)

```
[sticky 0] 이름/본부·팀  (152px)
[sticky 1] 직급          (72px)
── 경력 그룹 (groupStart: 'career') ──────────────
[2]  입사일              (92px)
[3]  근속력(월)          (64px)
[4]  전경력(월)          (64px)
[5]  총경력(월)          (64px)
[6]  총경력(연월)        (84px)
[7]  연차(년)            (54px)
[8]  고려대상 열외       (88px)
── 연봉 그룹 (groupStart: 'salary') ───────────────
[9]  전년도 연봉         (100px)
[10] 금년도(이전제외A)   (100px)
[11] 금년도(이전포함B)   (100px)
[12] 증감(B-A)           (84px)
── 보상조정 그룹 (groupStart: 'compensation') ─────
[13] 조정분(만원) 편집   (80px)
[14] 제안연봉            (108px)
[15] 등급(작년→올해) ★  (110px)
[16] 인상률              (76px)
[17] 승격 편집           (96px)
[18] 인센티브(만원) 편집 (84px)
[19] 비고 편집           (100px)
```

---

## §5 간격·균형·가독성

- sticky 2컬럼 → 마지막(직급) 우측에 `box-shadow: 2px 0 8px rgba(0,0,0,0.06)` 분리감
- 헤더 th·행 td 에 `groupStart` 컬럼마다 `border-left: 2px solid rgba(63,44,128,0.1)` 옅은 보라 구분선
  - 그룹: 경력(입사일) / 연봉(전년도) / 보상조정(조정분)
- 수치 컬럼 `fontVariantNumeric: tabular-nums` + 우측 정렬 유지
- 행 높이: padding 9px 10px 통일
- STICKY_OFFSETS: name=0, position=152 (2컬럼으로 축소)

---

## §6 handlePrint 업데이트

- 삭제된 컬럼(25.02기준·경력직급·등급 단독) 제거
- 연봉 셀 등급 칩 → 텍스트 제거 (printSalaryWithGrade 함수 삭제)
- 등급 전환 셀 추가: `{prev} → {curr}` 텍스트 형식 (A→S 등)
- 연차: Math.floor(totalCareerMonths / 12) 파생

---

## §7 검증

- `tsc --noEmit` 에러 0건 (apps/web 전체 스코프)
- 백엔드/계약/데이터 레이어(api.ts·hooks.ts) 무변경
- 편집 셀(조정분·승격·인센티브·비고) handleBlurSave 로직 불변
