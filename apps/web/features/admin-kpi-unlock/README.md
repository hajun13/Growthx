# admin-kpi-unlock feature

KPI 확정 해제(`/admin/kpi-unlock`, 사이드바 **기타 › KPI 확정 해제**) — hr_admin 전용.

- **책임:** 전 단계 결재가 끝난(confirmed) KPI 를 구성원 단위 / KPI 단위로 골라 '작성중'(draft)으로 되돌린다.
  구성원이 수정해 다시 제출하면 결재선 1차부터 다시 결재한다.
- **소비 API:** `@growthx/contracts` 생성 클라이언트
  - `kpisControllerUnlockCandidates` — `GET /kpis/unlock-candidates?cycleId=` 주기 상태·KPI 작성 잠금 여부 + 구성원별 확정 KPI(평가 점수·중간점검 연결 수 포함)
  - `kpisControllerUnlock` — `POST /kpis/unlock { kpiIds, reason }` 일괄 해제(전부 성공 또는 전부 실패)
- **구조:** `api.ts`(봉투 unwrap) · `hooks.ts`(`useUnlockOverview`, `kpiUnlockCommands`) ·
  `ui/KpiUnlockView.tsx`(주기 선택·검색·선택·실행) · `ui/UnlockTable.tsx`(구성원 행 + 펼침 KPI 행) ·
  `ui/UnlockDialog.tsx`(사유 입력·영향 안내) · `ui/StateViews.tsx`.
- **불변식(서버 강제):** hr_admin + `KPI 승인/반려` 기능 권한, 마감(closed) 주기 불가, 확정 상태만 대상, 사유 필수.
  사유는 `rejectReason` 에 `[확정해제]` 프리픽스로 저장 → KPI 작성·검토 화면이 반려와 구분해 'HR 확정 해제'로 표시
  (`lib/ui parseKpiReturnReason`). 감사 로그 `kpi.unlock`(before 에 결재 이력 보존), 구성원별 알림 `kpi_unlocked`.

## 비고
- KPI 작성 단계가 잠겨 있으면(평가 운영 일정 잠금) 해제해도 구성원이 수정할 수 없다 — 화면이 경고한다.
- 평가 점수가 저장된 KPI 는 다시 확정될 때까지 본인평가 화면에서 빠지고, 삭제는 서버가 막는다(409).
