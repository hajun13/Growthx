# admin-cycle feature

평가 운영(HR) 화면 — 평가 주기 기간 설정·단계 전환·삭제 + 단계별 일정·잠금·알림 + 과거결과 임포트(YoY). 새 아키텍처 표준 패턴([[notifications]]·[[reports-summary]] 복제).

- **책임:** 평가 운영 주기 CRUD(생성·수정·단계전환·삭제). 일정/스냅샷/재배정/리마인더/YoY 임포트는 기존 보조 모듈(`useSchedules`·`useKpiSnapshots`·`useEvaluations`·`useNotifications`·`uploadExcel`) 그대로 사용.
- **소비 API:** `@growthx/contracts` `cyclesControllerList`/`Get`/`Create`/`Update`/`UpdateStatus`/`Remove`(타입: `CycleDto`). 봉투는 `api.ts`에서 한 번 unwrap(`res.data.data`).
- **구조:** `api.ts`(생성 클라이언트 호출 + 봉투 unwrap, 경계에서 도메인 타입으로 좁힘) · `hooks.ts`(`cycleCommands` — 기존 시그니처 보존) · `ui/CycleOpsView.tsx` · 라우트는 `<CycleOpsView/>`만.
- **비고:**
  - 주기 **목록**은 (main) 레이아웃에 마운트된 `CurrentCycleProvider`(전역 `useCycles`)가 공유하므로 페이지는 그 컨텍스트(`useCurrentCycle`)를 그대로 소비한다 — 여기서는 변이 커맨드만 생성 클라이언트로 이관했다.
  - 생성 DTO 의 `status`/`cycleType`은 orval 에서 loose(`{ [k]: unknown }`)로 나와 `api.ts` 경계에서 도메인 타입(`EvaluationCycle`/`CycleStatus`)으로 좁힌다(데이터 의미 불변).
  - 등급(S~D) 배지는 이 화면에 없어 `lib/grade`는 미사용. 디자인 토큰은 DESIGN.md(Kinetic) 인라인 유지.
