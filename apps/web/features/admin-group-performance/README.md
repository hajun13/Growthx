# admin-group-performance feature

전사 등급풀 화면(`/admin/group-performance`) — 새 아키텍처 표준 패턴([[notifications]]·[[reports-summary]] 복제).

- **책임:** 월별실적에서 동기화된 그룹 실적을 바탕으로 전사 단일 등급풀을 자동 적용하거나 S/A/B/C/D 상한 인원을 수동 조정.
- **소비 API(생성 클라이언트):** `@growthx/contracts`
  - `groupPerformanceControllerList`(타입 `GroupPerformanceDto`) — 그룹 실적 조회
  - `groupPerformanceControllerUpsert`(타입 `UpsertGroupPerformanceDto`) — 그룹 실적 저장
- **구조:** `api.ts`(봉투 `res.data.data` unwrap) · `hooks.ts`(`useGroupPerformanceData` — 로드+upsert) · `ui/GroupPerformanceView.tsx` · 라우트는 `<GroupPerformanceView/>`만.
- **비고:** 내부 API는 그룹별 GradePool row를 유지하지만 UI와 제출 검증은 전체 그룹 caps를 합산한 전사 풀만 사용한다. 수동 저장 시 모든 내부 GradePool row에 같은 비율을 반영한다.
- **디자인:** 등급 배지·파이·진행바 색은 `@/lib/grade`(`gradeColor` — Kinetic dark-on-light, bg=배경 / fg=텍스트·수치). 기존 인라인 `GRADE_BADGE`(흰 텍스트) 제거. DESIGN.md(Kinetic) 토큰 준수, 시각/동작 보존.
- **RBAC:** 조회·적용=hr_admin 전용, 적용은 추가로 `hasFeature('등급풀 수정')`(백엔드 `@RequireFeature` 강제).
