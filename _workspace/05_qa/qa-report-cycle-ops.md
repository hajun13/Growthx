# QA 리포트 — 평가 운영 단계 모델 개편 (Cycle Ops)

- 검증일: 2026-06-05
- 기준 계약: `_workspace/02_contract/contract-cycle-ops.md`
- 검증 방식: 생산자(백엔드)·소비자(프론트) 양쪽 동시 읽기 + 타입체크
- **판정: PASS (블로커 0건)** — 경미 2건(문서 주석/일관성, 기능 영향 없음)

---

## 1. 단계 모델 / seed — PASS

| 항목 | 결과 | 근거 |
|------|------|------|
| seed cycleSchedule 정규 키 5개 | PASS | `apps/api/prisma/seed.ts:313` — `kpi_selection/execution_h1/mid_review/execution_h2/final_review` 정확히 5개 |
| 날짜 연속·비겹침 | PASS | 03/01~03/31 → 04/01~06/09 → 06/10~06/30 → 07/01~11/30 → 12/01~12/31. 빈틈/겹침 없음 |
| 기본 잠금값 | PASS | execution_h1·execution_h2 = true, 나머지 false (계약 §1 표와 일치) |
| 옛 키(preparation/prep) 잔존 | PASS | seed에 `preparation` 없음. `cycleSchedule`은 seed 초기화 deleteMany 대상(seed.ts:185)이라 고아 없음 |
| ui.ts `schedulePhaseLabel` 5개 키 일치 | PASS | `apps/web/lib/ui.ts:334-338` 정규 키 5개 = seed/DEFAULT_PHASES와 1:1 (오타 없음). 하위호환 라벨(prep/preparation/self/downward1/downward2/result)은 계약 §1 지시대로 별도 유지 |
| `admin/cycle/page.tsx DEFAULT_PHASES` 일치 | PASS | `page.tsx:30-36` 5개 키 동일 |

## 2. 재오픈 사유 — PASS

| 항목 | 결과 | 근거 |
|------|------|------|
| setLock: 열기+사유공백 → 400 VALIDATION_ERROR | PASS | `schedules.service.ts:86-92` — `reason?.trim() \|\| undefined` 후 누락 시 `BadRequestException({code:'VALIDATION_ERROR', message:'재오픈 사유를 입력해 주세요.'})` |
| 잠그기는 reason 없이 동작 | PASS | `isLocked=true` 분기에서 사유 미검사 |
| audit after.reason 기록 | PASS | `schedules.service.ts:113` — `after:{ isLocked, reason: trimmedReason ?? null }` |
| 컨트롤러 dto.reason 전달 | PASS | `cycles.controller.ts:86` — `setLock(id, phase, dto.isLocked, user, dto.reason)` |
| 프론트 재오픈 사유 모달 | PASS | `page.tsx:164-210` — 열기 시 모달, 빈 사유 차단(`submitReopen` + Modal `disabled: reopenReason.trim().length===0`). 잠그기는 즉시(`doSetLock(phase,true)`) |
| setLock 커맨드 reason 전달 | PASS | `useSchedules.ts:24` setLock 시그니처에 `reason?` 포함, `page.tsx:177`에서 전달 |

## 3. current-phase / 배너 — PASS

| 항목 | 결과 | 근거 |
|------|------|------|
| 응답 schedules[].startDate 포함 | PASS | `schedules.service.ts:157-162` map에 startDate 포함 |
| nextOpen{phase,startDate}\|null | PASS | `schedules.service.ts:138-149` — 잠금 중일 때 `startDate ?? dueDate > now`인 가장 이른 열림 단계, 없으면 null |
| 프론트 CurrentPhase 타입 1:1 | PASS | `types.ts:629-644` PhaseScheduleLite/CurrentPhase가 계약 §5와 동일. nextOpen 옵셔널(`?`) 폴백 |
| PeriodBanner shape 소비 | PASS | `PeriodBanner.tsx:59-66` — `locked && phase.nextOpen` 가드, startDate 폴백(`? fmtDate : ''`), camelCase 일치 |

## 4. 스냅샷 / diff — PASS

| 항목 | 결과 | 근거 |
|------|------|------|
| 라우트 3개 경로/메서드/권한 | PASS | `cycles.controller.ts:95-121` — POST `kpi-snapshots`(@Roles hr_admin), GET `kpi-snapshots?userId=`(인증), GET `kpi-snapshots/:snapshotId/diff`(인증) |
| 프론트 호출 URL 일치 | PASS | `useKpiSnapshots.ts:18,35,48` — `/cycles/${id}/kpi-snapshots`, `?userId`, `/${snapshotId}/diff` 정확 |
| diff 응답 shape | PASS | `snapshots.service.ts:177-188` added/removed/changed/unchangedCount + changed[].fields[].{field,before,after} = 계약 §4 + `types.ts:674-683` 1:1 |
| 봉투: 단건 {data}, 목록 {data,meta} | PASS | create/diff `{data}`, list `{data,meta}`(snapshots.service.ts:138). 프론트 apiGet(단건 unwrap)·apiGetList(목록) 일관(api.ts:147,156,169) |
| 행수준 권한 403 | PASS | list/diff 모두 `assertCanView`→`canViewUser`(access.util.ts:58). 타인 스냅샷 비가시 시 403 FORBIDDEN |
| Prisma 모델/마이그레이션 | PASS | `schema.prisma:603` KpiSnapshot + `migrations/20260605020000_kpi_snapshots/migration.sql` 존재(인덱스·FK cascade 포함) |
| 모듈 등록 | PASS | `cycles.module.ts:12` providers에 SnapshotsService 등록 |
| kpi 화면 diff 패널 | PASS | `kpi/page.tsx:182-192,772-779,917-935` — 최신 스냅샷 diff 렌더, 없으면 미표시 폴백 |

## 5. 빌드 / 타입 건전성 — PASS

| 항목 | 결과 | 근거 |
|------|------|------|
| `apps/api` tsc --noEmit | PASS | exit 0, 에러 0 |
| `apps/web` tsc --noEmit | PASS | exit 0, 에러 0 |
| ROLE_ORDER / NAV_ROLE_LABELS 에러 | **무효(phantom)** | `ROLE_ORDER`·`NAV_ROLE_LABELS`는 apps/web 전체에 **정의도 참조도 없음**(grep 0건). admin/permissions/page.tsx에서도 미사용. 이번 변경과 무관하며 현재 트리에 존재하지 않는 에러 — 빌드 차단 아님. frontend 엔지니어 보고는 이미 해소되었거나 다른 작업본 기준으로 추정 |

---

## 경미 결함 (블로커 아님 — 기능 영향 없음)

### [경미-1] schedule.dto.ts startDate 주석이 스키마와 불일치
- 파일: `apps/api/src/modules/cycles/dto/schedule.dto.ts:43`
- 원인: 주석 "스키마 미보유 — 수용만 하고 무시"이지만, 실제로는 `schema.prisma:584`에 `startDate DateTime?`가 있고 `schedules.service.ts:36,48`에서 정상 persist됨. 코멘트만 stale.
- 영향: 기능 정상(startDate 저장·조회·nextOpen 산출 모두 동작). 오해 유발 문서 결함뿐.
- 수정방법(백엔드): 주석을 "단계 시작일(ISO 8601). CycleSchedule.startDate에 저장"으로 갱신.

### [경미-2] 일괄 upsert는 isLocked를 더 이상 전송하지 않음 (의도된 분리, 확인용)
- 파일: `apps/web/app/(main)/admin/cycle/page.tsx:131-139` (payload에 isLocked 제외)
- 상태: 계약 §2 "일괄저장은 날짜·알림만, isLocked는 단건 토글로 분리" 지시와 **정확히 일치**. 백엔드 upsert는 `s.isLocked !== undefined`일 때만 갱신(schedules.service.ts:58)이라 프론트 미전송 시 기존 잠금 유지 — 안전.
- 조치 불요. 정합성 확인 완료로 기록.

---

## 종합

- 경계면(생산자↔소비자) 5개 영역 전부 정합. 응답 봉투·camelCase·라우트·행수준 권한·상태값 일치.
- 양쪽 tsc 통과. frontend 보고된 ROLE_ORDER/NAV_ROLE_LABELS 에러는 현 트리에 부재(phantom).
- **릴리스 게이트: 통과.** 경미 2건은 후속 정리 권장(릴리스 차단 아님).
