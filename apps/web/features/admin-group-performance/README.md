# admin-group-performance feature

그룹실적 / 등급풀 화면(`/admin/group-performance`) — 새 아키텍처 표준 패턴([[notifications]]·[[reports-summary]] 복제).

- **책임:** 그룹 실적 입력(HR)·등급풀 비율 인터랙티브 편집·등급 풀 적용·부서별 등급 현황 조회.
- **소비 API(생성 클라이언트):** `@growthx/contracts`
  - `groupPerformanceControllerList`(타입 `GroupPerformanceDto`) — 그룹 실적 조회
  - `groupPerformanceControllerUpsert`(타입 `UpsertGroupPerformanceDto`) — 그룹 실적 저장
- **구조:** `api.ts`(봉투 `res.data.data` unwrap) · `hooks.ts`(`useGroupPerformanceData` — 로드+upsert) · `ui/GroupPerformanceView.tsx` · 라우트는 `<GroupPerformanceView/>`만.
- **비고:** 등급풀(`useGradePools`/`gradePoolCommands`)·등급분포(`useGradeDistribution`)·그룹목록(`useDepartments`) 등 보조 데이터는 기존 훅 유지 — 주 데이터(그룹 실적)만 생성 클라이언트로 이관(reports-summary 패턴).
- **디자인:** 등급 배지·파이·진행바 색은 `@/lib/grade`(`gradeColor` — Kinetic dark-on-light, bg=배경 / fg=텍스트·수치). 기존 인라인 `GRADE_BADGE`(흰 텍스트) 제거. DESIGN.md(Kinetic) 토큰 준수, 시각/동작 보존.
- **RBAC:** 조회=hr_admin·division_head, 쓰기=hr_admin + `hasFeature('등급풀 수정')`(백엔드 `@RequireFeature` 강제) — 불변.
