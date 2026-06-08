# 6월 중간평가 · 피드백 보완 조치 — 설계안 (Design Proposal)

> 상태: **설계안만(코드 변경 없음)** · 작성 2026-06-08 · 근거: `2026년도 임직원 KPI 및 평가 운영 계획_VER3` 로드맵 1p
> 후속: 사용자 검토 → 범위 확정 → `eval-harness-orchestrator` 로 구현 착수

---

## 0. 로드맵상 6월의 위치

| 시기 | 조직 활동(상단) | 평가 단계(하단) | 성격 |
|------|------|------|------|
| 3월 | 구조 정립·목표 설정 | KPI 수립 | 목표 확정 |
| 4~5월 | 현장 적용·실행 확인 | 실행 관리 | 실행 |
| **6월** | **피드백 보완 조치** | **중간 평가** | **점검·코칭 (구속력 X)** |
| 7~11월 | 실행 지속·이슈 해소 | 성과 관리 | 실행 |
| 12월 | 등급 확정·보상 연계 | 최종 평가 | 등급·보상 (구속력 O) |

- **로드맵은 1개 연간 운영의 단일 타임라인.** 중간/최종은 별개 사업이 아니라 같은 평가의 두 체크포인트.
- **6월 중간평가의 본질** = ① 상반기 진척 점검 ② 부서장↔구성원 피드백 ③ 하반기 궤도 수정(보완 조치). **등급·연봉 미산정.**

---

## 1. ⚠️ 핵심 결정: "중간평가"를 무엇으로 모델링할 것인가

현재 코드에 **두 개의 상충하는 "중간" 개념**이 공존한다 — 이걸 먼저 정리해야 한다.

| | 위치 | 의미 |
|--|------|------|
| (a) `CycleType.MIDTERM` | [schema.prisma:140](../../apps/api/prisma/schema.prisma#L140) | **별도 주기 1벌**이 통째로 "중간평가용" |
| (b) `CycleStatus.mid_review` | [transitions.ts:16](../../apps/api/src/common/state/transitions.ts#L16) | **임의 주기의 한 단계** (active→**mid_review**→calibration→closed) |

게다가 seed는 2026 주기를 **`cycleType=MIDTERM` 인데 `status=mid_review`** 로 만들어 둠([seed.ts:419](../../apps/api/prisma/seed.ts#L419)) — 두 모델이 겹쳐 있어 "이 주기가 12월에 최종평가로 넘어갈 수 있나?"가 애매하다(주기 타입은 불변, 상태기계는 mid_review→calibration→closed 라 한 번 지나가면 끝).

### 두 가지 모델

- **Model A — 2주기 분리:** 2026에 MIDTERM 주기(6월·등급없음) + FINAL 주기(12월·등급/보상) 별도 생성. KPI를 주기 간 복제/임포트해야 함.
- **Model B — 1주기·체크포인트(권장):** 2026 = 1개 연간 주기. `mid_review` 단계 = 6월 중간 체크포인트, `calibration→closed` = 12월 최종. **같은 KPI·목표를 그대로 이어 씀**(복제 불필요).

### ✅ 권장 = **Model B**
- 로드맵의 단일 타임라인과 일치, 기존 **선형 상태기계와 그대로 부합**.
- KPI/목표가 중간→최종으로 자연 승계(중간에 조정하면 그 값이 최종에 반영). 복제·동기화 버그 원천 제거.
- `CycleType` 처리: 연간 주기는 `FINAL`(연간 운영 = 최종등급으로 귀결)로 두고, **중간평가는 "단계(mid_review)"로 표현**. `MIDTERM` 타입은 *연중 분리 운영이 필요한 조직을 위한 옵션*으로만 잔존(이번 범위에서 미사용). seed의 2026 주기는 `FINAL`+`active/mid_review`로 정정.
- → **결정 필요 사항 #1**

---

## 2. 기능 설계 (4개 블록)

### ① MIDTERM/중간단계 가드 — 등급·보상 차단 〔필수·소〕
**문제:** `results`(집계)·`compensations`(인상률)가 주기의 단계/타입을 보지 않음 → 중간 시점에 최종등급·인상률이 산정될 위험.

**설계:**
- 결과 집계 API와 보상 산정 API 진입부에서 **`cycle.status !== calibration/closed` 면 400 차단**("최종평가(calibration) 단계에서만 등급·보상을 산정할 수 있어요").
  - 트리거 위치: `results` 집계 엔드포인트, [compensations.service.ts](../../apps/api/src/modules/compensations/compensations.service.ts) 산정 진입부.
- 본인/부서장 평가 자체는 mid_review에서 **작성 가능**하되, 그 산출물은 "중간 피드백"으로만 표시되고 등급 확정/풀 배분에는 미반영.
- 이미 있는 안전장치: 중간평가 주기 역량평가 차단([competency.service.ts:58](../../apps/api/src/modules/competency/competency.service.ts#L58)) — 동일 패턴 확장.

### ② 진척 점검 대시보드 — 부서장/본인용 〔중〕
**목적:** 6월 시점 KPI별 현재 달성률·추세를 한눈에 + 부서장이 점검 완료 체크.

**데이터 재사용(신규 모델 거의 불필요):**
- 개인 KPI 진척: 기존 `Achievement`(분기 실적, [schema:387](../../apps/api/prisma/schema.prisma#L387)) Q1·Q2 누적 달성률.
- 조직 진척: 기존 `MonthlyPerformance`(월별 group/division 실적, [schema:725](../../apps/api/prisma/schema.prisma#L725)) 1~5월 누적.
- 화면: `/eval/midterm`(또는 결과화면을 단계별 분기) — KPI별 [목표 / 현재 / 달성률 / 추세 / 상태(순항·주의·위험)]. 부서장은 구성원별 점검 토글.

### ③ 피드백 보완 조치 추적 〔중·핵심〕
**문제:** 현재 피드백 수단은 `Review`(강점/개선, 분기별, [schema:516](../../apps/api/prisma/schema.prisma#L516))·`KpiScore.reviewerNote`·`Comment` 뿐 — *"피드백 → 보완 액션 → 담당/마감/완료 추적"* 루프가 없음. 로드맵의 "피드백 **보완 조치**"가 빈칸.

**설계 — 신규 엔티티 `ActionItem`(보완 조치):**
```
ActionItem {
  id, cycleId, kpiId?(연결 KPI, 선택), userId(대상 구성원),
  source: 'midterm_review',          // 어느 체크포인트에서 나온 조치인지
  title, detail,
  assigneeId(담당, 보통 본인),
  dueDate(이행 목표 시점, 보통 하반기),
  status: planned → in_progress → done,   // (+ canceled)
  createdById(부서장), createdAt, completedAt, completionNote
}
```
- **흐름:** 부서장이 중간평가에서 개선 피드백 작성 → 그 자리에서 보완 조치(액션) 등록(담당·마감) → 구성원이 하반기 진행하며 상태 갱신 → **12월 최종평가 화면에 "중간 보완 조치 이행 현황" 패널로 노출**(참고 데이터, 등급 직접 반영은 정책 선택).
- RBAC: 생성/마감판단=부서장, 진행상태 갱신=담당 본인+부서장, 조회=본인·부서장·HR.
- 감사: 생성·상태전이 `AuditLog` 기록.
- → **결정 필요 사항 #2: 보완 조치 이행률을 최종등급에 *반영* 할지, *참고만* 할지** (권장: 참고만 — 로드맵상 중간은 비구속).

### ④ 중간 KPI 목표 재조정(re-baseline) + 이력 〔중·선택〕
**목적:** 환경변화로 6월에 KPI 목표/가중치를 조정할 때, "그냥 수정"이 아니라 **변경 이력(누가·언제·사유·전/후)** 을 남김.

**설계:**
- `mid_review` 단계에서만 KPI `targetValue`/`targetText`/`weight` 수정 허용(다른 단계는 잠금 — 기존 `CycleSchedule.isLocked` 패턴 활용).
- 변경 시 기존 `KpiSnapshot`([schema:683](../../apps/api/prisma/schema.prisma#L683), 이미 "1차 확정" 스냅샷에 사용 중) 메커니즘 재사용 → label `"중간 조정 전"` 스냅샷 캡처 + `AuditLog` 사유 기록.
- UI: `/admin/cycle` 재오픈 사유 입력에 이미 "중간평가 목표 조정 반영" placeholder 존재([admin/cycle:849](../../apps/web/app/(main)/admin/cycle/page.tsx#L849)) — 이걸 실제 재조정 플로우로 연결.

---

## 3. 화면 영향 요약

| 화면 | 변경 |
|------|------|
| `/eval` 허브 | mid_review일 때 "중간평가" 카드 → 진척 점검+피드백 진입(현재 self로만 연결) |
| `/eval/midterm` (신규) | ② 진척 대시보드 + ③ 보완 조치 등록/조회 |
| 결과 화면 | mid_review에서는 등급/보상 숨기고 "중간 점검 결과"로 표시(①) |
| 최종평가 화면(12월) | ③ "중간 보완 조치 이행 현황" 참고 패널 추가 |
| `/admin/cycle` | ④ 중간 목표 재조정 진입 + 단계 잠금 |
| `/admin/rules` | 변경 없음(중간은 등급/보상 미산정) |

## 4. 데이터 모델 변경 요약
- **신규:** `ActionItem`(③). enum `ActionItemStatus`.
- **재사용:** `Achievement`·`MonthlyPerformance`(②), `KpiSnapshot`·`AuditLog`(④), `Review`/`reviewerNote`(피드백 본문).
- **정정:** seed 2026 주기 type/status 정합화(§1). 상태기계는 그대로(Model B).

## 5. 권장 구현 순서(범위 확정 후)
1. **①+§1 정정** (안전·정합, 소) — 먼저.
2. **②** (점검 대시보드, 기존 데이터 재사용).
3. **③** (보완 조치 추적 — 6월의 실제 가치).
4. **④** (목표 재조정 이력 — 선택).

## 6. 결정 필요 사항 (검토 회신용)
- **#1** 중간평가 모델: **Model B(1주기·체크포인트)** 로 확정? (권장)
- **#2** 보완 조치 이행률을 최종등급에 반영? 아니면 참고만? (권장: 참고만)
- **#3** 진척 점검을 부서장만? 아니면 본인 자가점검도? (권장: 둘 다, 본인 입력→부서장 확인)
- **#4** 이번 구현 범위: ①+② / ①②③ / 전체(①②③④) 중?
