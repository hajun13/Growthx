# API 계약 (델타) — 사용자 라이프사이클(퇴사·복직·하드삭제 2모드)

> 작성: backend-engineer · 2026-06-05 · 기준: `api-contract-convention.md`(봉투·camelCase·인증)
> 대상: frontend-engineer(admin/users), qa-inspector. base path `/api/v1`. 전 엔드포인트 RBAC `hr_admin`.

## 0. 공통
- 봉투: 성공 `{ data }`, 에러 `{ error: { code, message, details? } }`. 필드 camelCase.
- 인증 없으면 401, 권한(hr_admin 아님) 403.
- User 응답 shape에 **필드 추가**(비회귀): `legalEntity`, `employmentStatus`, `resignedAt`.
  - `employmentStatus`: `active | on_leave | resigned`
  - `resignedAt`: ISO datetime | null
  - `legalEntity`: `energyx | ...`(기존 enum)
  - 기존 필드(`id,email,name,role,position,jobLevel,departmentId,managerId,currentSalary,mustChangePassword,visibilityScope,isActive,createdAt`) 그대로.

## 1. 퇴사 처리 — `PATCH /users/:id/resign`
- 권한: hr_admin.
- body: 없음.
- 동작: `employmentStatus=resigned`, `resignedAt=now()`(이미 있으면 보존), `isActive=false`. **멱등**(이미 퇴사여도 200·동일 결과).
- 응답: `200 { data: User }`.
- 에러:
  - 본인 대상: `403 FORBIDDEN` "본인은 퇴사 처리할 수 없어요."
  - 없음: `404 NOT_FOUND`.

## 2. 복직 — `PATCH /users/:id/reactivate`
- 권한: hr_admin.
- body: 없음.
- 동작: `employmentStatus=active`, `resignedAt=null`, `isActive=true`.
- 응답: `200 { data: User }`.
- 에러: `404 NOT_FOUND`.

## 3. 하드 삭제 — `DELETE /users/:id` ( `?force=true` )
> **의미 변경**: 기존 `DELETE`=soft-deactivate(isActive=false) → **하드 삭제**로 재정의.
> 소프트 비활성이 필요하면 `PATCH /users/:id/resign` 또는 `PATCH /users/:id`(`{ isActive:false }`) 사용.

- 권한: hr_admin.
- query: `force` (`'true'` 면 완전 삭제). 미지정/그 외=기본 삭제.

### 공통 전제(두 모드)
- 활성 사용자(`isActive=true`): `409 CONFLICT` "활성 사용자는 바로 삭제할 수 없어요. 먼저 퇴사/비활성 처리해 주세요."
- 본인 대상: `403 FORBIDDEN` "본인 계정은 삭제할 수 없어요."
- 마지막 활성 hr_admin(대상이 hr_admin이고 다른 활성 hr_admin 0명): `409 CONFLICT` "마지막 활성 인사관리자는 삭제할 수 없어요."
- 없음: `404 NOT_FOUND`.

### 3-A. 기본 삭제 (`force` 미지정)
- 평가 이력 참조 검사: `results · evaluations(evaluator+evaluatee 합산) · kpis · compensations · appeals · competencyResponses · monthlyPerformances · kpiSnapshots · reviews · comments · competencyQuestions`.
- 하나라도 > 0 → **차단**:
  ```json
  {
    "error": {
      "code": "CONFLICT",
      "message": "평가 이력이 있어 삭제할 수 없어요. 비활성으로 보존되며, 완전 삭제를 원하면 이력 포함 삭제를 사용하세요.",
      "details": [ { "key": "results", "count": 1 }, { "key": "evaluations", "count": 3 } ]
    }
  }
  ```
  (`details`는 count>0 인 항목만. 프론트는 message 그대로 노출 + "완전 삭제" 안내.)
- 이력 0 → 삭제: `notifications` 삭제, `auditLogs.userId=null`(감사추적 보존), 본인을 manager로 둔 `reports.managerId=null`, user 삭제.
- 응답: `200 { data: { id } }`.

### 3-B. 완전 삭제 (`?force=true`)
- 트랜잭션으로 종속 전부 의존순서 삭제(comments·reviews→appeals(응답/결정자 SetNull 후)→evaluations(KpiScore/Comment cascade)→results→compensations→kpis(parentKpiId SetNull 후, Achievement/Review/KpiScore cascade)→competencyResponses→competencyQuestions→monthlyPerformances→kpiSnapshots→notifications, auditLogs.userId=null, reports.managerId=null) → user 삭제.
- **파괴적**: 연도비교(YoY)에서 해당 인원 사라짐.
- 응답: `200 { data: { id, purged: true } }`.

## 4. 감사로그
- `user.resign` · `user.reactivate` · `user.delete` · `user.purge` (entity=`user`, actorId=현재 사용자).

## 5. 프론트 반영 포인트
- admin/users 행 액션: 활성=`[수정][퇴사 처리]`, 비활성=`[복직][삭제][완전 삭제]`.
- "삭제" 409(이력) → message 노출 + 완전 삭제 유도. "완전 삭제" → 2단 확인 후 `DELETE ?force=true`.
- 목록 뱃지: `employmentStatus`(재직/휴직/퇴사) + `isActive`. `includeInactive=true` 토글로 비활성 포함.
- User 타입에 `legalEntity·employmentStatus·resignedAt` 추가.
