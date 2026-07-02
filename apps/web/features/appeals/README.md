# appeals feature

이의제기 신청·검토·결정 화면 — 새 아키텍처 표준 패턴([[notifications]]·[[reports-summary]] 복제).

- **책임:** 평가 결과 이의제기 목록 조회·신청(7일 윈도)·부서장 1차 답변·HR 최종 결정. 상태 머신(submitted→under_review→answered→closed) 타임라인 표시.
- **소비 API:** `@growthx/contracts`
  - `appealsControllerList`(타입 `AppealDto`) — 목록(GET /appeals, `userId?` 필터)
  - `appealsControllerCreate`(`CreateAppealDto`) — 신청(POST /appeals)
  - `appealsControllerRespond`(`RespondAppealDto`) — 부서장 답변(POST /appeals/:id/respond)
  - `appealsControllerDecide`(`DecideAppealDto`) — HR 결정(POST /appeals/:id/decide)
- **구조 (image 13 재현, 2026-07-02 Part/ 수정요청 P17):**
  - `api.ts`(봉투 unwrap `res.data.data`) · `hooks.ts`(`useAppealsData` — 목록 로드 + create/respond/decide 커맨드).
  - `ui/AppealsView.tsx` — 오케스트레이션(`useSearchParams` 때문에 내부에 `Suspense`).
  - `ui/useAppealActions.ts` — 신청/답변/결정 커맨드 훅(검증·busy·토스트).
  - `ui/AppealCreateForm.tsx` — 이의제기 신청 폼(resultId 진입 시).
  - `ui/AppealListPanel.tsx` — 좌측 목록(Avatar + 상태배지 + 카드형, 검색·필터).
  - `ui/AppealDetailPanel.tsx` — 우측 상세(신청자정보 카드 + 스테퍼 + 처리내용 카드들 + 최종결정).
  - `ui/AppealStepper.tsx` — 진행 스테퍼(접수→검토중→부서장답변→HR최종결정).
  - `ui/AppealDecisionForm.tsx` — HR 최종 결정 폼(유형 5종 선택 + 사유).
  - `ui/appealTimeline.ts` — 단계 정의·필터 옵션 공유 상수.
- **RBAC/동작 보존:** 답변은 team_lead·division_head·hr_admin, 최종 결정은 hr_admin만(화면 분기 그대로). 검증 10자 최소·`APPEAL_WINDOW_CLOSED` 토스트 유지.
- **API 갭 (P17):**
  - **결정 유형 enum 없음**: `DecideAppealDto.decision`은 자유 텍스트 하나뿐. UI는 5종(평가유지/점수수정/등급수정/재평가진행/기각) 라디오를 제공하고 `[유형] 사유` 형태로 접두어를 붙여 무손실 전송(백엔드 파싱 없이 텍스트로 저장).
  - **상태 4종뿐, "반려" 없음**: `AppealStatus`는 submitted/under_review/answered/closed 4가지. 요구사항 5상태(접수/검토중/답변완료/최종완료/반려) 중 "반려"는 계약에 없어 표시하지 않음.
  - **단계별 완료일시·담당자 이름 없음**: `respondedById`/`decidedById`(ID)와 `updatedAt`(단일 타임스탬프)만 존재. 스테퍼는 상태 전이 여부로 근사하고, 담당자는 역할명("부서장"/"HR")으로 폴백 표시.
  - **첨부파일 필드 없음**: 첨부 카드는 UI만 존재("준비 중" 안내), 업로드/다운로드 미구현.
- **비고:** `useAuth`·`useToast`·`ApiError`(err.code 분기) 등 보조 의존은 기존 유지.
