# 보상 시뮬 조정 컬럼 — 프론트엔드 구현 노트

요구사항: `_workspace/00_input/requirements-compensation-sim-columns.md`
백엔드: `_workspace/03_backend/compensation-adjustment-notes.md`

## 변경 파일

### 신규 생성
- `apps/web/features/admin-compensation/ui/CompensationRow.tsx` (~200줄)
  - 개별 행 컴포넌트. 편집 셀(조정분·승격·인센티브·비고) + blur 자동 저장 포함.
  - 파일당 ~200줄 상한 준수를 위해 CompensationView 에서 분리.

### 수정
- `apps/web/features/admin-compensation/api.ts`
  - `compensationsControllerUpsertAdjustment` import 추가
  - `upsertCompensationAdjustment(dto)` 함수 추가 — `@growthx/contracts` 생성 클라이언트 경유, 봉투 unwrap(`res.data.data`) 반환.
  - `UpsertCompensationAdjustmentDto`, `CompensationAdjustmentDto` 타입 re-export.

- `apps/web/features/admin-compensation/ui/CompensationView.tsx`
  - `CompensationRow` import 및 행 렌더링 위임.
  - `GRID_COLS` 8열 → 12열 (`1fr 80px 70px 110px 110px 36px 90px 100px 80px 100px 130px 120px`).
  - `HEADERS` 배열 12개로 확장: 조정분(만원)·승격·인센티브(만원)·비고 추가.
  - 표 컨테이너에 `overflow-x-auto` + `minWidth: 1080` 적용(가로 스크롤).
  - `handleSave` 콜백 — `upsertCompensationAdjustment` 호출 후 `reload()`.
  - 요약 카드 총 인건비 증가: `projectedSalary` → `finalProjectedSalary` 기준으로 전환.
  - 평균 인상률: `finalRaiseRate ?? raiseRate` 기준으로 전환.
  - `handlePrint`: 조정분·승격·인센티브·비고·차기년도 연봉(최종) 컬럼 반영(13열).

## 새 컬럼 구조 (왼쪽 → 오른쪽)

| # | 컬럼 | 소스 | 편집 여부 |
|---|------|------|-----------|
| 1 | 이름 / 본부·팀 | `userName`, `divisionName`, `teamName` | 읽기 전용 |
| 2 | 직급 | `position` → `getPositionLabel` | 읽기 전용 |
| 3 | 평가등급 | `currentGrade` | 읽기 전용 |
| 4 | 전년도 연봉 | `previousSalary` | 읽기 전용 |
| 5 | 금년도 연봉 | `currentSalary` | 읽기 전용 |
| 6 | → | 구분자 | — |
| 7 | **조정분(만원)** | `adjustmentAmount` / 10000 | hr_admin 입력 |
| 8 | **승격** | `promotionPositionCode` | hr_admin 선택 |
| 9 | **인센티브(만원)** | `incentiveAmount` / 10000 | hr_admin 입력 |
| 10 | **비고** | `note` | hr_admin 입력 |
| 11 | 차기년도 연봉 | `finalProjectedSalary` | 읽기 전용(백엔드 산정) |
| 12 | 인상액(율) | `finalRaiseRate`, `finalProjectedSalary` | 읽기 전용(백엔드 산정) |

## 저장 흐름

```
사용자 blur (조정분/승격/인센티브/비고 셀 포커스아웃)
  → 150ms 디바운스(같은 행 탭 이동 중복 저장 방지)
  → upsertCompensationAdjustment({ cycleId, userId, adjustmentAmount, promotionPositionCode, incentiveAmount, note })
      ※ 4개 필드 전체 함께 전송(클로버 방지)
  → 성공: reload() → 서버 finalProjectedSalary/finalRaiseRate 반영
  → 실패: useToast danger 메시지
  → 저장 중 인디케이터: "저장 중…" 인라인 표시
```

- 입력 단위: 조정분·인센티브는 **만원**으로 입력받아 ×10000 원 환산 후 전송.
- `canEdit` = `isHrAdmin(user.role)`. hr_admin 아니면 모든 편집 셀 `disabled`.
- 승격 드롭다운: `usePositions({ includeInactive: true })` 옵션 목록, "—"(null) 포함.

## 파생값 표시 원칙

- `finalProjectedSalary` / `finalRaiseRate` — 백엔드 산정값을 그대로 표시.
- 프론트 재계산 없음(불일치 방지).

## 타입체크 결과

```
pnpm -C apps/web tsc --noEmit (루트 typescript 경유)
```

- `features/admin-compensation/` 관련 에러: **0건**
- 기존 pre-existing 에러 3건 (`admin-competency-items/api.ts` 2건, `competency-eval/api.ts` 1건) — 이번 작업 범위 밖, 우리 변경과 무관.

---

## QA 결함 수정 (2026-06-16)

### FAIL-1 (HIGH) 조회 권한 분리 — CompensationView.tsx

**문제:** `allowed = isHrAdmin(user.role)` 하나로 화면 진입·편집 모두 제어 → 백엔드 `GET /compensations/simulation/team` 이 `hr_admin | division_head | team_lead` 3역할 허용인데 프론트가 `hr_admin` 만 통과.

**수정:**
- `canView = hr_admin | division_head | team_lead` — Forbidden 게이팅·데이터 로드 `enabled` 조건
- `canEdit = hr_admin` only — 편집 셀 `disabled` 게이팅, `CompensationRow` prop 전달
- `useTeamCompensationSimulationData(cycleId, canView && !!cycleId)` 로 변경
- `usePositions({ includeInactive: true }, { enabled: canView })` 로 변경
- `<CompensationRow canEdit={canEdit} ...>` 로 변경 (기존 `allowed` → `canEdit`)
- `isHrAdmin` import는 `canEdit` 에서만 사용하도록 유지

**결과:** division_head · team_lead 는 읽기 전용(편집 셀 disabled), hr_admin 만 편집 가능.

### WARN-1 요약 카드 합계 정합 — CompensationView.tsx

**수정:**
- `valid` 필터 조건을 `finalProjectedSalary != null && currentSalary != null` 으로 통일 (이전: `currentSalary != null && currentGrade != null`)
- `avgRaise` 계산: `finalRaiseRate ?? raiseRate ?? 0` → `finalRaiseRate ?? 0` 로 단일화 (`finalProjectedSalary` null 제외 행이 `finalRaiseRate` 도 없으므로 동일 기준 유지)
- 총 인건비 증가: `valid.reduce` 에서 null 체크 조건 제거하고 비-null 단언(`!`) 사용 (필터로 보장됨)

### WARN-2 파일 길이 (~348줄)

CompensationView.tsx 는 이미 CompensationRow.tsx 를 분리한 상태(~200줄 각각 준수 의도).
현재 348줄 — `handlePrint` HTML 빌더(~50줄)를 분리하면 약 295줄로 감소하나, print 빌더가 `positions`, `filtered`, `toManwonPrint` 등 파일 내부 심볼에 광범위하게 의존해 안전 분리가 불확실하다.
회귀 위험 대비 이점이 낮아 **이번 릴리스는 생략**. 후속 리팩터 과제로 남김.

## 디자인 결정

- Kinetic Enterprise `K` 팔레트 인라인 유지(기존 파일 톤 그대로).
- 편집 셀 배경: `rgba(63,44,128,0.035)` (퍼플 틴트 매우 연하게) + `outlineVariant` 테두리 → hr_admin에게만 표시.
- 가로 스크롤: 표 컨테이너 `overflow-x-auto` + `minWidth: 1080px`. sticky 헤더 유지(top:0 z-10).
- 파일 분리: `CompensationView.tsx`(~200줄) + `CompensationRow.tsx`(~200줄).
