# 리스킨 브리프 — EnergyX Common Design System 2026 전환

> **목적:** DESIGN.md가 Kinetic Enterprise에서 EnergyX Common Design System 2026으로 전면 교체됨에 따라, 무엇이 어떻게 바뀌었는지 프론트 개발자가 빠르게 파악할 수 있도록 정리한다.
> **작성:** 2026-06-16

---

## 1. 핵심 변경 요약

| 항목 | 이전 (Kinetic Enterprise) | 신규 (EnergyX 2026) |
|------|--------------------------|---------------------|
| Primary 색 | Deep Purple `#3f2c80` | 퍼플 `#7A37D8` (purple-500) |
| Secondary 색 | True Blue `#0054ca` | 폐기 → 필요 시 info `#2563EB` |
| Tertiary 색 | Teal `#004346` | 폐기 → success `#16A34A` |
| 배경(canvas) | `#f8f9fd` | `#F7F7F9` (neutral-50, 사실상 동일) |
| 카드 배경 | `#ffffff` | `#FFFFFF` (동일) |
| 사이드바 | Purple `#564599` + Teal 활성바 | Brand Ink `#0E0E14` + 퍼플 `#7A37D8` 활성바 |
| 포커스 링 | (미정의) | `0 0 0 3px rgba(122,55,216,.32)` |
| 그림자 | Soft Ambient(보라 틴트) | 중립 다크 5단계 (컬러 없음) |
| 서체 | Pretendard (동일) | Pretendard (동일 — 폴백 스택 정비) |
| 반경 컨트롤 | 8px | 8px (`--radius-md`) — 동일 |
| 반경 카드 | 8px | 12px (`--radius-lg`) — 변경 |
| 반경 모달 | 미정의 | 16px (`--radius-xl`) |
| 레거시 Toss | 일부 잔존 (`#3182f6`, gradeChipColor) | 전면 폐기 |
| 글래스/그라데이션 | 일부 사용 | 완전 폐기 |

---

## 2. 팔레트 대조표

### 퍼플 스케일 (신규)

```
--purple-50:  #F4EDFC  ← grade-S soft bg
--purple-500: #7A37D8  ← PRIMARY (구 Kinetic #3f2c80과 다름)
--purple-600: #6A2DC0  ← 호버
--purple-700: #56229F  ← 프레스, grade-S fg
```

### 뉴트럴 스케일 (신규)

```
--neutral-50:  #F7F7F9  ← surface-page (구 #f8f9fd와 사실상 동일)
--neutral-950: #0E0E14  ← Brand Ink (사이드바 배경)
```

### 시맨틱 (신규 — Kinetic 폐기색 대체)

| 역할 | 구 Kinetic | 신규 EnergyX |
|------|-----------|--------------|
| 성공/완료 | Tertiary Teal | success `#16A34A` |
| 주요 액션 | Secondary Blue `#0054ca` | primary `#7A37D8` 또는 info `#2563EB` |
| 오류 | error `#ba1a1a` | danger `#E5484D` |

---

## 3. 등급 색 토큰 매핑 (확정 — 변경 없음)

`packages/ui/tailwind-preset.cjs`의 `grade/gradeFg/gradeBg` 및 `apps/web/lib/grade.ts`의 `GRADE_COLOR`가 SSOT.

| 등급 | solid (`grade.*`) | soft bg (`gradeBg.*`) | text fg (`gradeFg.*`) |
|------|------------------|-----------------------|----------------------|
| S | `#7A37D8` | `#F4EDFC` | `#56229F` |
| A | `#2563EB` | `#EAF1FE` | `#173F9B` |
| B | `#16A34A` | `#E9F8EF` | `#0E6633` |
| C | `#F59E0B` | `#FEF5E7` | `#9A6103` |
| D | `#E5484D` | `#FDECEC` | `#A0282D` |

`lib/grade.ts` `GRADE_COLOR.X.bg` = `gradeBg`, `.fg` = 600 음영(gradeFg의 -600 수준).

> 등급 표시 시 항상 색 + 텍스트 라벨 병기 (대비 AA 준수).

---

## 4. 사이드바 변경

```
이전: background #564599 (Kinetic primary-container) + Teal 4px 활성바
신규: background #0E0E14 (Brand Ink) + 퍼플 #7A37D8 4px 활성바
```

활성 항목:
```css
/* 신규 */
border-left: 4px solid #7A37D8;
background: rgba(122, 55, 216, 0.12);  /* purple-500 12% */
color: #FFFFFF;
```

비활성 텍스트: `rgba(255,255,255,0.65)`
호버 배경: `rgba(255,255,255,0.08)`

---

## 5. 엘레베이션 변경

| 레벨 | 이전 (Kinetic) | 신규 (EnergyX) |
|------|---------------|----------------|
| 카드(lv1) | `0 4px 12px rgba(86,69,153,0.05)` (보라 틴트) | `0 1px 2px rgba(14,14,20,.06), 0 1px 3px rgba(14,14,20,.08)` (중립) |
| 모달(lv2) | `0 12px 24px rgba(0,0,0,0.08)` | `0 8px 16px rgba(14,14,20,.10), 0 24px 56px rgba(14,14,20,.22)` |

Tailwind: `shadow-elev-1`(카드), `shadow-elev-3`(드롭다운), `shadow-elev-4`(모달).

---

## 6. 반경 변경

| 대상 | 이전 | 신규 |
|------|------|------|
| 버튼·입력 | `rounded` = 8px | `rounded-md` = 8px (동일) |
| 카드 | `rounded` = 8px | `rounded-lg` = 12px **(변경)** |
| 모달 | 미정의 | `rounded-xl` = 16px |
| 칩·뱃지 pill | `rounded-full` | `rounded-pill` = 999px (동일) |

---

## 7. 코드에서 확인할 파일

```
packages/ui/tailwind-preset.cjs   ← 색·radius·elev 토큰 SSOT
apps/web/app/globals.css          ← shadcn HSL 변수 (--primary 등)
apps/web/lib/grade.ts             ← 등급 GradeColor
apps/web/lib/ui.ts                ← gradeBgClass, gradeSolidClass 유틸
```

DESIGN.md와 코드 사이 충돌 시 **코드(tailwind-preset.cjs)가 우선**.

---

## 8. 프론트 체크리스트

- [ ] 사이드바 배경을 `#564599` → `#0E0E14`으로 교체했는가
- [ ] 사이드바 활성바 색을 Teal → `#7A37D8`(퍼플)으로 교체했는가
- [ ] 카드 반경을 `rounded`(8px) → `rounded-lg`(12px)로 교체했는가
- [ ] 카드 그림자를 보라 틴트(`rgba(86,69,153,.05)`) → `shadow-elev-1`로 교체했는가
- [ ] `#3182f6`(Toss blue) 잔존 여부 검색·제거했는가
- [ ] `gradeChipColor` 레거시 함수 제거하고 `GRADE_COLOR`로 대체했는가
- [ ] 등급 칩에 색 + 라벨 병기 적용됐는가 (접근성)
- [ ] 포커스 링 `shadow-focus` 클래스 적용됐는가
