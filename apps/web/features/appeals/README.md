# appeals feature

이의제기 신청·검토·결정 화면 — 새 아키텍처 표준 패턴([[notifications]]·[[reports-summary]] 복제).

- **책임:** 평가 결과 이의제기 목록 조회·신청(7일 윈도)·부서장 1차 답변·HR 최종 결정. 상태 머신(submitted→under_review→answered→closed) 타임라인 표시.
- **소비 API:** `@growthx/contracts`
  - `appealsControllerList`(타입 `AppealDto`) — 목록(GET /appeals, `userId?` 필터)
  - `appealsControllerCreate`(`CreateAppealDto`) — 신청(POST /appeals)
  - `appealsControllerRespond`(`RespondAppealDto`) — 부서장 답변(POST /appeals/:id/respond)
  - `appealsControllerDecide`(`DecideAppealDto`) — HR 결정(POST /appeals/:id/decide)
- **구조:** `api.ts`(봉투 unwrap `res.data.data`) · `hooks.ts`(`useAppealsData` — 목록 로드 + create/respond/decide 커맨드) · `ui/AppealsView.tsx`(`useSearchParams` 때문에 내부에 `Suspense`) · 라우트는 `<AppealsView/>`만.
- **RBAC/동작 보존:** 답변은 team_lead·division_head·hr_admin, 최종 결정은 hr_admin만(화면 분기 그대로). 시각·UX(타임라인·필터·검증 10자 최소·`APPEAL_WINDOW_CLOSED` 토스트)는 기존 페이지에서 그대로 이관, 데이터 소스만 생성 클라이언트로 교체.
- **비고:** 등급 배지 미사용 페이지라 `lib/grade` 적용 없음. `useAuth`·`useToast`·`ApiError`(err.code 분기) 등 보조 의존은 기존 유지. 디자인 토큰은 Notion Low Color(인라인 `K` 팔레트, 기존 페이지 동일).
