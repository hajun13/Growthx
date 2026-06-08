# 요구사항 — 사용자 라이프사이클(퇴사·비활성·삭제)

> 작성: orchestrator(리더) · 2026-06-05
> 요청: "퇴사하면 비활성화 할 수 있게 하고, 비활성된 사용자 삭제할 수 있게도."
> 결정(사용자): 삭제는 **둘 다 제공** — 기본 삭제는 평가 이력 있으면 차단, 별도 "완전 삭제(이력 포함)"는 강경고 후 cascade.

## 현재 상태
- `DELETE /users/:id` → 실제로는 `deactivate`(soft, isActive=false만). employmentStatus/resignedAt 미연동. 하드 삭제 없음.
- 프론트 admin/users "삭제" 버튼 → deactivate 호출("비활성화했어요" 토스트).
- User 인입 참조 대부분 onDelete=Restrict(Cascade 아님): results·evaluations(evaluator/evaluatee)·kpis·compensations·appeals·competencyResponses·monthlyPerformances·kpiSnapshots·reviews·comments·competencyQuestions·notifications·auditLogs(userId nullable)·reports(managerId self). → 이력 있는 User 하드삭제는 FK로 막힘.
- enum `EmploymentStatus { active, on_leave, resigned }`·`resignedAt` 이미 존재(YoY 마이그레이션).

## S1. 퇴사/복직 (backend)
- `PATCH /users/:id/resign` (hr_admin): `employmentStatus=resigned`, `resignedAt=now()`, `isActive=false`. 멱등(이미 퇴사면 그대로). 감사로그.
- `PATCH /users/:id/reactivate` (hr_admin, 복직): `employmentStatus=active`, `resignedAt=null`, `isActive=true`.
- 자기 자신 퇴사 차단(403). 응답 `{data: User}`(employmentStatus·resignedAt·isActive 포함하도록 serializer 보강).

## S2. 하드 삭제 — 2모드 (backend)
- **전제**: 두 모드 모두 `isActive=false`인 사용자만 삭제 가능(활성 사용자는 409 "먼저 퇴사/비활성 처리하세요"). 자기 자신·마지막 hr_admin 삭제 차단(409/403).
- **기본 삭제** `DELETE /users/:id` (force 아님):
  - **평가 이력 존재 검사**: results·evaluations(evaluator/evaluatee)·kpis·compensations·appeals·competencyResponses·monthlyPerformances·kpiSnapshots·reviews·comments·competencyQuestions 중 하나라도 있으면 **409 CONFLICT** + 차단 사유 요약(예: `{ blocked: true, refs: { results: 1, evaluations: 3, ... } }`, message "평가 이력이 있어 삭제할 수 없어요. 비활성으로 보존되며, 완전 삭제를 원하면 이력 포함 삭제를 사용하세요.").
  - 이력 없으면 삭제: notifications 삭제, auditLogs.userId=null(SetNull, 감사추적 보존), 본인을 manager로 둔 reports의 managerId=null, 그 후 user 삭제. 응답 `{data:{id}}`.
- **완전 삭제(이력 포함)** `DELETE /users/:id?force=true`:
  - 트랜잭션으로 종속 레코드 의존순서 삭제: comments→kpiScores/achievements(평가/卑 cascade 활용)→evaluations→results(+appeals)→compensations→reviews→kpis→competencyResponses→competencyQuestions→monthlyPerformances→kpiSnapshots→notifications, auditLogs.userId=null, reports.managerId=null, 그 후 user 삭제. (Cascade 걸린 하위는 부모 삭제로 자동 정리.)
  - 강한 파괴적 작업 — **연도비교에서 해당 인원 사라짐**. 응답 `{data:{id, purged:true}}`.
- 계약 `_workspace/02_contract/contract-userlifecycle.md`(델타). RBAC hr_admin, 봉투/ camelCase 기존 규약.

## S3. 화면 (frontend, admin/users 중심)
- 목록에 **비활성 포함 토글**(이미 includeInactive 쿼리 존재) + **재직/휴직/퇴사 뱃지**(employmentStatus) + 비활성 표시.
- 행 액션 분기:
  - 활성 사용자: `[수정] [퇴사 처리]`(확인모달 → resign).
  - 비활성 사용자: `[복직] [삭제] [완전 삭제(이력 포함)]`.
- **삭제**(기본): 확인모달 → DELETE. 409(이력 있음)면 백엔드 message 그대로 노출 + "완전 삭제" 안내.
- **완전 삭제**: 빨강 강조 + 2단 확인(이름 입력 또는 명시 체크) "이력까지 영구 삭제, 연도비교에서 사라짐". → DELETE ?force=true.
- 토스트/상태 갱신. (org 페이지 인물카드에도 동일 액션 노출은 선택 — admin/users 우선.)

## S4. QA
- 활성 사용자 삭제 차단, 이력 있는 비활성 삭제 차단(409)·완전삭제 cascade 성공, 마지막 hr_admin/자기삭제 차단, 퇴사→복직 상태전이, 뱃지·토글 정합, 봉투/권한.

## 비범위
- 대량(일괄) 삭제 UI는 범위 외(단건). 휴직(on_leave) 전용 액션은 이번 범위 외(employmentStatus 값은 보존).
