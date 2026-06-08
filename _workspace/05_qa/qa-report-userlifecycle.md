# QA 리포트 — 사용자 라이프사이클(퇴사·복직·하드삭제 2모드)

> 검증자: qa-inspector · 2026-06-05 · 방법: 양쪽 동시 읽기 + schema/migration FK 정적 대조 + 양쪽 `tsc --noEmit`
> 기준: `_workspace/02_contract/contract-userlifecycle.md`
> **운영 DB 변경 없음(읽기 검증만).**

## 요약표

| # | 경계면 | 판정 |
|---|--------|------|
| 1 | 엔드포인트↔커맨드 1:1 매핑 + 응답 shape | PASS |
| 2 | DELETE 의미변경 비회귀(deactivate 잔존 0) | PASS |
| 3 | 삭제 차단 409 처리(message 평탄화 없이 노출+에스컬레이트) | PASS |
| 4 | 완전삭제 cascade FK 안전(RESTRICT 위반 0) | PASS |
| 5 | serializer 비회귀(필드 추가만, camelCase 1:1) | PASS |
| 6 | 액션 분기/뱃지/토글/2단확인 | PASS |
| 7 | RBAC 전 엔드포인트 @Roles(hr_admin) | PASS |
| — | API `tsc --noEmit` | PASS(exit 0) |
| — | web `tsc --noEmit` | PASS(exit 0) |

**릴리스 게이트: 통과(GO).** 차단(blocker) 결함 0건. 정보성 관찰 2건(아래).

---

## 1. 엔드포인트 ↔ 커맨드 매핑 + 응답 shape — PASS

| 동작 | 백엔드(controller) | 프론트(userCommands) | 응답 shape 정합 |
|------|------|------|------|
| resign | `PATCH :id/resign` (60) | `apiPatch<User>('/users/:id/resign')` (50) | `{data:User}`→`apiPatch` unwrap→User ✅ |
| reactivate | `PATCH :id/reactivate` (67) | `apiPatch<User>(.../reactivate)` (52) | `{data:User}`→User ✅ |
| remove(기본) | `DELETE :id` (73) | `apiDelete<{id}>('/users/:id')` (54) | `{data:{id}}`→`{id}` ✅ |
| purge | `DELETE :id?force=true` (73, force 분기) | `apiDelete<{id,purged}>('/users/:id',{force:'true'})` (56) | `{data:{id,purged:true}}`→`{id,purged}` ✅ |

- `apiDelete<T>(path, query?)`(api.ts:192)가 `query`를 `request`→`withQuery`(api.ts:41)로 직렬화 → `?force=true` 정확히 생성. `withQuery`가 `data` 봉투 unwrap(`json.data`)도 수행. ✅
- 봉투: 백엔드 응답은 전역 인터셉터 `{data}` 래핑, 프론트 `apiPatch/apiDelete` 모두 `json.data` unwrap. 일치.
- resign 멱등: 서비스(177)가 `resignedAt: user.resignedAt ?? new Date()`로 기존 퇴사일 보존, 재호출해도 200·동일. 계약 §1 일치.

## 2. DELETE 의미변경 비회귀 — PASS

- 코드베이스 전역 `deactivate` 호출 0건. `apps/` 내 유일 매치는 `users.controller.ts:72`의 **주석**(의미변경 설명)뿐. `userCommands`에 `deactivate` 멤버 없음(useUsers.ts:45-60).
- 기존 "비활성화" 동작은 계약대로 `PATCH :id/resign`(퇴사) 또는 `PATCH :id` `{isActive:false}`(update.ts:155)로 이전됨 — 후자는 `UpdateUserDto.isActive`(dto:97) 유지. 깨진 호출부 없음.

## 3. 삭제 차단(409) 처리 — PASS

- 백엔드 409 형태: `{code:'CONFLICT', message, details:[{key,count}]}` (service:279-284). `details`는 count>0만 필터(276-278). 계약 §3-A 일치.
- 프론트 `handleDelete`(page:1250): `err.code==='CONFLICT'`이면 `setDeleteBlocked(err.message)` — **백엔드 message 그대로**, 평탄화/가공 없음(1262). 모달에서 `{deleteBlocked}` 원문 인라인 노출(2019) + "완전 삭제로 전환" 유도(2021-2023).
- 에스컬레이트: confirm 버튼이 `deleteBlocked`이면 라벨 "완전 삭제로 전환", onConfirm=`escalateToPurge`(1997-1999) → purge 모달 오픈(1296-1304). 계약 §5 일치.
- 활성 사용자 삭제 차단(service:242 409), 본인 삭제 차단(232 403), 마지막 활성 hr_admin 차단(250-260 409) 모두 구현. 계약 §3 공통전제 일치.
- `ApiError.details`(api.ts:28)에 details 보존 — 프론트는 message만 쓰므로 미사용이나 비회귀.

## 4. 완전삭제 cascade FK 안전 — PASS (정밀 대조 완료)

**근거:** schema.prisma + migration SQL(`20260604001028_init` 등)의 실제 FK `ON DELETE` 액션을 직접 읽어 정적 검증.

`users` 참조 FK 중 **RESTRICT**(삭제 전 반드시 정리 필요):
kpis.user · evaluations.evaluator · evaluations.evaluatee · reviews.author · comments.author · evaluation_results.user · appeals.user · compensations.user · notifications.user · monthly_performances.entered_by · competency_questions.created_by · competency_responses.user · kpi_snapshots.user.
**SET NULL**(자동): users.manager · appeals.responded_by · appeals.decided_by · audit_logs.user.

purge() 순서(service:308-346) 대조 — 모든 RESTRICT 경로가 user 삭제(step 8) 전에 해소됨:
- comments.author → `comment.deleteMany({authorId})` step1 ✅
- reviews.author → `review.deleteMany({authorId})` step1 ✅
- appeals.user → `appeal.deleteMany({userId})` step2 ✅ (responded/decided는 DB가 SET NULL이나 코드가 명시 updateMany로 선해제 — 중복이나 무해)
- evaluations.evaluator/evaluatee → `evaluation.deleteMany({OR})` step3 ✅
- evaluation_results.user → `evaluationResult.deleteMany({userId})` step4 ✅
- compensations.user → step4 ✅
- kpis.user → `kpi.deleteMany({userId})` step5 ✅
- competency_responses.user → step6 ✅ / competency_questions.created_by → step6 ✅
- monthly_performances.entered_by → step6 ✅ / kpi_snapshots.user → step6 ✅
- notifications.user → step7 ✅ / audit_logs.user → updateMany null step7 ✅(DB도 SET NULL) / reports(manager) → updateMany null step7 ✅(DB도 SET NULL)

**2개의 load-bearing 간접 RESTRICT(검증 핵심):**

1. **kpi_scores.kpi = RESTRICT** (migration:485). `kpi.deleteMany`(step5)가 KpiScore에 막힐 수 있음. KpiScore는 자신의 Evaluation(CASCADE, migration:482)이 지워질 때만 정리됨. 대상의 KPI는 **대상이 evaluatee인 평가에서만** 채점됨(self+downward). step3이 `evaluateeId:id` 평가를 모두 삭제→KpiScore CASCADE 제거가 **step5보다 먼저** 일어남. 대상 KPI를 채점하는데 대상이 evaluator도 evaluatee도 아닌 평가는 도메인상 존재하지 않음. → 안전. (순서 step3→step5 의존, 역전 시 FK 터짐)

2. **appeals.result = RESTRICT** (migration:506). `evaluationResult.deleteMany`(step4)가 Appeal에 막힐 수 있음. Appeal은 대상 결과(userId=id)에만 달림 — `appeals.service.ts:79-95`가 `result.userId===current.id` 강제 + `userId:current.id` 저장으로 **appeal.userId===결과소유자** 불변 보장. step2 `appeal.deleteMany({userId:id})`가 step4보다 먼저 모두 제거. → 안전.

`kpis.parentKpiId`는 DB가 SET NULL(migration:455)이라 코드의 선(先) parentKpiId null 업데이트(329-332)는 중복이나 무해(자기 그룹 내 부모 참조도 함께 정리).

**트랜잭션:** 전 과정 `$transaction`(309) 단일 원자성. 부분 실패 시 롤백.

## 5. serializer 비회귀 — PASS

- `toUserDto`(users.serializer.ts:4-25): 기존 필드 전부 유지 + `legalEntity·employmentStatus·resignedAt` **추가만**(20-22). 제거/이름변경 없음.
- 프론트 `User`(types.ts:103-124): `employmentStatus:EmploymentStatus` · `legalEntity:LegalEntity` · `resignedAt:string|null` 1:1. enum 응답은 snake_case 원형(`active|on_leave|resigned`, `energyx|mirae_plan`) — types.ts:976-978과 일치, 한글 라벨은 ui.ts 매핑.
- 전 필드 camelCase. snake_case 누출 없음(serializer가 명시 매핑).

## 6. 액션 분기/뱃지/토글/2단확인 — PASS

- 활성 행: `[수정][퇴사]`(page:1868-1882). 비활성 행: `[복직][삭제][완전삭제]`(1883-1910). 계약 §5·요구사항 일치.
- 재직 뱃지: `employmentStatusLabel[u.employmentStatus]`(1859) + `employmentBadgeStyle`(87-94)로 3값(재직/휴직/퇴사) 모두 커버. ui.ts `employmentStatusLabel`(503-506) 3값 완비.
- 비활성 포함 토글: `includeInactive` state(955)→`useUsers({includeInactive})`(963)→훅이 `'true'` 직렬화(useUsers.ts:29)→백엔드 `query.includeInactive!=='true'`면 active만(service:40). 연동 정합. 기본 ON(955).
- 완전삭제 2단 확인: purge 모달 `disabled={purgeConfirm.trim()!==purgeTarget.user.name}`(2040) — 이름 정확 일치 전 버튼 잠금. `LifecycleModal`의 `disabled`→`blocked`로 onConfirm 차단(453,497). ✅

## 7. RBAC — PASS

- 전역 `APP_GUARD`: JwtAuthGuard + RolesGuard + ForcePasswordChangeGuard(app.module.ts:82-84). 인증 없으면 401, role 불일치 403(default-deny).
- 라이프사이클 4개 + create/update/salary 전부 `@Roles(Role.hr_admin)`(controller:39,45,52,59,66,74). 프론트만 숨긴 무가드 엔드포인트 없음.
- `list`/`get`(28,33)은 의도적 무 @Roles(인증 전역 + 행수준 visibilityScope 축소) — 라이프사이클 mutation은 전부 hr_admin. 계약 일치.
- 프론트 가드: `isHrAdmin(user.role)` 아니면 `<Forbidden>`(page:1416-1418) — UI 차단이나, 백엔드 가드가 SSOT이므로 보안 결함 아님.

---

## 정보성 관찰(비차단)

- **[INFO] 기본삭제 history 키 vs 계약 문구**: `countHistory`(service:359-400)는 계약 §3-A 나열 항목 중 `comments`·`competencyQuestions`까지 모두 카운트하나, 계약 본문 캐스케이드 설명(§3-B)에 `comments`를 별도 라인으로 명시. 실제 코드·계약 일치(차이 없음) — 기록용.
- **[INFO] purge 순서는 step3→step5, step2→step4 의존이 load-bearing.** 향후 리팩터로 순서가 바뀌면 KpiScore→Kpi / Appeal→Result RESTRICT가 즉시 깨짐. service:308 주석에 의존성 보강 권장(코드 동작은 현재 정상).

## 최종 판정

**릴리스 게이트 통과(GO).** 7개 경계면 전부 PASS, 양쪽 tsc 통과, 완전삭제 cascade에서 FK(RESTRICT) 위반 가능성 0(2개 간접 RESTRICT 모두 선행 정리로 안전 입증). 차단 결함 없음.
