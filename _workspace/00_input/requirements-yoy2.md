# 요구사항 — YoY 2차: 과거결과 임포트 UI + 전년도 연봉 자동 파생

> 작성: orchestrator(리더) · 2026-06-05 · 기준: requirements-yoy.md 후속.
> 배경: 1차 빌드의 임포트가 **실 Docker DB에 미반영**(별도 DB 드라이런만) + 임포트 UI 부재 → 2025가 사이트에서 안 보임.

## 결정 사항
1. **임포트는 사이트 UI로 셀프서비스**(반복 가능). 운영 DB 직접조작 금지(안전가드). 관리자가 엑셀 업로드 → 적재.
2. **전년도 연봉 = 누적 데이터에서 자동 파생**(수기 `User.previousSalary`는 fallback). 사이클이 쌓일수록 자동 갱신.
3. 2025 엑셀엔 연봉 컬럼 없음 → 2025 자체 연봉은 비어도 됨("2025는 확인 안 돼도"). 2026↑ 연봉이 쌓이면 다음 연도 전년도연봉이 자동 채워지는 게 목표.

## S1. 과거결과 임포트 UI (frontend)
- 위치: `admin/cycle` 페이지의 "조직·대상자 엑셀 임포트" 섹션 옆에 **"과거 평가결과 임포트(YoY)"** 섹션 신규. (또는 `/reports/yoy`에 hr_admin 전용 업로드 패널 — 택1, admin/cycle 권장.)
- 동작: 대상 사이클 선택(기본=closed 과거 사이클, 예 2025) + `FileDropzone` → `POST /excel/import/legacy-results?cycleId=`(기존 `uploadExcel` 헬퍼/`lib/excel.ts` 패턴).
- **임포트 리포트 표시**: `imported/matched/createdResigned/legalEntityUpdated/reviewQueue/errors[]/review[]` 요약 + 오류·검토큐 행 펼쳐보기. 재실행 멱등 안내.
- hr_admin 전용 가드(기존 `isHrAdmin`). 성공 시 토스트 + 연도비교로 이동 링크.
- 디자인: Toss 사각(rounded-none), 기존 FileDropzone/States/Toast 재사용. 신규 토큰 0.

## S2. 전년도 연봉 자동 파생 (backend)
- 스키마: `Compensation.baseSalary Int?`(@map base_salary) — 해당 사이클의 연봉 산정 기준(=그 시점 currentSalary). 마이그레이션 additive.
- 파생 규칙 `derivePreviousSalary(userId, cycleYear)`:
  - 해당 user의 **직전 사이클**(year < 현재 사이클 year 중 최대, simulated=false Compensation 존재) 의 `baseSalary`를 전년도 연봉으로 사용.
  - 없으면 직전 사이클 `nextYearSalary`(이월 기준) → 그것도 없으면 `User.previousSalary`(수기 fallback) → null.
- 적용처: `compensations.service` simulation·simulationTeam·list 의 `previousSalary` 필드를 위 파생값으로 교체(현재는 `user.previousSalary` 직접 사용). 응답 필드명 유지(`previousSalary`) + 출처 표시 `previousSalarySource: 'derived'|'manual'|'none'` 추가.
- 보상 산정/확정(persist, simulated=false 생성) 시 `baseSalary = currentSalary` 저장 → 다음 사이클이 읽어감(체이닝).
- 계약 델타 `_workspace/02_contract/contract-yoy.md`에 §보강(또는 contract-yoy2.md). RBAC/봉투 기존과 동일.

## S3. QA
- 임포트 UI → 엔드포인트 봉투/리포트 타입 정합, hr_admin 가드.
- 전년도 연봉 파생: 직전사이클 baseSalary 우선·fallback 체인, source 필드 정합, 기존 보상화면 비회귀.

## 비범위
- 실제 2025 데이터 적재는 사용자가 새 UI로 업로드(또는 운영자 인가 후 별도 실행). 본 작업은 그 수단을 제공.
