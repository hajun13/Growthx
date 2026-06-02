# 프론트엔드 구현 현황 — v2 도메인 대정정 (frontend-engineer)

> 대상: `apps/web/` (Next.js 14 App Router + TS strict + Tailwind)
> 기준: `_workspace/01_design/*`(13화면·25컴포넌트), `_workspace/02_contract/contract.md`(v2 계약, 단일 기준), `references/domain-model.md`.
> **v2 정정:** 역량평가·다면(peer/upward) 폐기 → self + downward(1차 팀장·2차 본부장). 조직 4단계(group→division→team). KPI 분류(category/group/measureType). 등급 풀=그룹 단위.

## 1. 도메인 대정정 — 제거한 잔재 (self-grep 0건)

| 제거 대상 | 처리 |
|----------|------|
| `Dimension`/역량 차원 enum·`dimensionLabel`·`dimensionGrades` | 타입·ui 매핑 삭제 |
| `EvaluationItem`/`EvaluationItemInput`/`competency-items` | 타입 삭제 (평가는 `KpiScore`만) |
| 다면 `peer`/`upward`·`MultiSourceScores`·`multiSource` | `EvalType=self\|downward`로 축소, `byType={self,downward1,downward2}` |
| `RadarChart`/`ScatterPlot` | 컴포넌트 미생성(원래 없음), 화면서 미사용 |
| 본인평가 역량 탭·`GradeRadio`(본인용)·`COMMON_COMPETENCY`/`LEADERSHIP_ITEMS` | self 화면 전면 재작성 → 2탭(성과중심/협업·성장) |
| 다면(`multi`)·`dept-head` comingSoon 사이드바·`canAccessReview` | nav 재작성, `/eval/dept-head` 실라우트로 |
| `chart-peer` 토큰 | tailwind.config 에서 제거, `pool-*` 추가 |

> 검증: `grep -E "Dimension|peer|upward|competency|EvaluationItem|RadarChart|multiSource|dimensionGrades"` → 코드 잔재 0건(주석의 "제거됨" 설명만 존재).

## 2. 산출물

### 화면 (app/) — 13 라우트
| 라우트 | 파일 | 화면 | 비고 |
|--------|------|------|------|
| `/login` | `(auth)/login/page.tsx` | 로그인 | 유지 |
| `/eval` | `(main)/eval/page.tsx` | S1 메인 — ProcessFlow(평가준비→본인→1차팀장→2차본부장→결과), 주차일정, 내 할 일 + 리더 검토·부서장평가 카드 | **정정**(다면 단계 제거) |
| `/kpi` | `(main)/kpi/page.tsx` | K1 작성 — group/category/measureType Select, count 임계값, 가중치(합100·정성≤30·성과중심·협업성장 둘다 포함), 삭제(DELETE) | **정정** |
| `/kpi/review` | `(main)/kpi/review/page.tsx` | K2 검토 — KpiCard(review) 뱃지, 코멘트 필수, reject(reason+comment) | **정정** |
| `/eval/self` | `(main)/eval/self/page.tsx` | S3 본인평가 — **2탭(성과중심/협업·성장)**, KpiCard+AchievementField(실적→달성률/건수→등급 자동표시), ScoreCard, 정성=서술(등급은 부서장) | **전면 재작성** |
| `/eval/dept-head` | `(main)/eval/dept-head/page.tsx` | S6 부서장 평가 — 1차/2차, 팀원 일괄, DistributionBarChart+PoolGauge(풀 상한·소진 차단), 정성 GradeRadio, 코멘트 필수 | **신규** |
| `/eval/result` | `(main)/eval/result/page.tsx` | 본인 결과 리다이렉트 | 유지 |
| `/eval/result/[userId]` | `.../[userId]/page.tsx` | S7 상세 — byType(self/d1/d2) ComparisonBar + 전사평균 + 코멘트(레이더 없음) | **정정** |
| `/admin/group-performance` | `(main)/admin/group-performance/page.tsx` | M1 그룹 실적·풀 산정(tier 자동·DistributionBarChart) | **신규** |
| `/reports` | `(main)/reports/page.tsx` | M2 분포 모니터링 — DistributionBarChart + ResultTable(행클릭→S7) | **신규** |
| `/appeals` | `(main)/appeals/page.tsx` | M3 이의제기 — 신청(resultId)·1차 답변·HR 결정 | **신규** |
| `/admin/compensation` | `(main)/admin/compensation/page.tsx` | M4 보상 시뮬 — compute(시뮬/확정)·전사평균·초과경고 | **신규** |
| `/admin/settings` | `(main)/admin/settings/page.tsx` | M5 설정 — RuleSet(등급척도 읽기·인상률·정성상한 편집)·양식·일정 탭 | **신규** |

> **라우트 표기:** M2는 작업서의 산출물 경로(`/admin/group-performance`·`/reports`·`/appeals`·`/admin/compensation`·`/admin/settings`)를 채택. wireframes.md 의 `/group-performance`·`/monitoring` 등은 동일 화면의 별칭(작업서 경로 우선). route group `(auth)`·`(main)`은 URL에서 제거됨. **다면(multi) 라우트 삭제.**

### 컴포넌트 (components/) — 25종
**신규:** `KpiCard`(category/group/measureType 뱃지·edit/review/self 모드), `AchievementField`(측정방식별 실적→등급 자동표시), `DistributionBarChart`(등급 분포+풀 상한 점선 마커+초과 danger), `PoolGauge`(잔여/소진), `ResultTable`(직책 컬럼·행클릭), `Select`.
**재정의:** `GradeRadio`(→부서장 등급 부여 전용 + `disabledGrades` 풀 소진 차단), `ScoreCard`(measureType·count 추가), `WeightField`(group 비율 표시), `CommentThread`(round 1·2 칩), `StatusBadge`(AppealStatus·PoolTier 추가), `WeekScheduleCalendar`(phase 키에서 peer_upward 제거), `AppShell`(comingSoon 제거·divider).
**유지:** ComparisonBar(self/d1/d2 3색·이미 v2 호환), GradeChip, ProcessFlow, ProgressDonut, EvidenceUpload, Tabs, Button, TextField, Card, Modal, Toast, PageHeader, States.

### 데이터 훅 (hooks/) — 계약 1:1
- 유지·정정: `useAuth`, `useAsync`, `usePrimaryAction`, `useCycles`/`useCurrentCycle`, `useDepartments`, `useKpis`(+group/category 필터·`remove` DELETE·reject reason 정정), `useEvaluations`(downward round), `useResults`(byType detail).
- **신규:** `useGroupPerformance`, `useGradePools`, `useAppeals`, `useCompensations`, `useNotifications`, `useRuleSets`, `useUsers`. 모두 계약 엔드포인트 1:1, 실제 화면서 호출됨(죽은 훅 없음).

### lib/
- `api.ts` — 봉투 unwrap 한 곳. `apiGet`/`apiGetList`/`apiPost`/`apiPostList`(compute 목록 응답)/`apiPatch`/`apiDelete`.
- `types.ts` — 계약 v2 camelCase 1:1. KpiGroup/KpiCategory/MeasureType/EvalType(self|downward)/GroupTier/AppealStatus 추가. EvaluationResult.byType. nullable 정직 표기(coreStrategy/csf/measureMethod/targetValue/grading/parentKpiId/rejectReason, byType 전체, GroupPerformance.revenue 등).
- `ui.ts` — kpiGroup/kpiCategory/measureType/tier 라벨, appealStatusStyle, 등급·상태 색.
- `nav.ts` — 역할별 사이드바(가시성 매트릭스 wireframes G)·활성키·`canReview`/`canEvaluateDownward`/`isHrAdmin`.

## 3. 경계면 규율 (유지)
- 봉투 unwrap **한 곳**(api.ts). 단건 `{data}`, 목록 `{data,meta}`, `data ?? []` 배열 보장. 배열 가정 금지.
- 타입 camelCase 계약 1:1. 추측 캐스팅 없음.
- 모든 href/router.push 실존 라우트((main) URL서 제거). 13 라우트 ↔ 사이드바 hrefs 1:1 검증 완료.
- **총점·가중치·달성률·등급은 백엔드 응답 표시만.** 프론트 재계산 0(WeightField·가중치 합계·정성 합은 즉시 피드백 표시만). AchievementField/ScoreCard/GradeChip 전부 백엔드 산정값 표시.
- 제출 가드(프론트 UX): KPI=합100·정성≤30·성과중심·협업성장 둘 다 포함·과제명 필수. self=측정 KPI 전부 실적 입력. 부서장=정성 등급 전부+코멘트+풀 상한. 백엔드 422/400(`COMMENT_REQUIRED`/`POOL_EXCEEDED`/`VALIDATION_ERROR`/`APPEAL_WINDOW_CLOSED`) 한글 매핑.

## 4. 계약 정합성
- §2~§16 전 엔드포인트 대응 훅 존재·호출. 상태 문자열 domain-model 정확히 사용(평가·KPI·주기·이의제기·tier).
- KPI: category/group/measureType/grading(count)/rejectReason nullable 반영.
- 평가: PATCH `kpiScores:[{kpiId, achievementRate?, directGrade?, weight}]` — self=실적(achievementRate에 actual/count), 부서장=정성 directGrade. 등급·점수는 백엔드.
- 결과: byType(self/downward1/downward2) score·grade·comment nullable 가드.

## 5. 계약 협상 필요 항목 (backend-engineer)

1. **부서장 종합 등급 직접 부여 필드 부재(중요도 중):** 와이어프레임 S6은 평가자가 "종합 점수·부여 등급(GradeRadio)"을 직접 매기는 UI를 명시하나, 계약 PATCH `/evaluations/:id`는 **per-KPI `kpiScores`만** 받는다(종합 directGrade 없음). 현재 구현은 계약 범위 내에서 ① amount/rate/count KPI = self 실적 기반 백엔드 자동 등급 표시(읽기), ② **정성(qualitative) KPI만 GradeRadio로 `directGrade` 부여**, ③ 종합 점수·등급은 백엔드 산출 표시(ScoreCard)로 처리했다. 운영상 평가자가 자동 등급을 무시하고 종합 등급을 강제 부여해야 한다면, `PATCH /evaluations/:id`에 `overallGrade?: Grade` 추가 협상 필요.
2. **그룹 풀 상한 = 인원 수 계산 근거(중요도 중):** S6 풀 분포/소진 차단은 `GradePool.{s..d}Ratio`(%) × 대상 인원으로 상한 인원을 프론트가 `Math.floor` 추정. 그룹 총 정원(`GroupPerformance`/GradePool에 `headcount` 절대값)이 응답에 있으면 마커가 정확해진다. **최종 풀 강제는 백엔드 submit(422 POOL_EXCEEDED)이 책임**이므로 프론트 추정은 안내용.
3. **부서명·대상자 이름 표시(중요도 하):** User/목록 응답에 부서명·대상자 이름 비정규화 필드가 없어 `departmentId`/`userId`를 departments 조회·`slice(0,8)`로 표시 중. `userName`/`departmentName` 동봉 시 UX 개선.
4. **알림 payload 스키마(중요도 하):** `Notification.payload`를 `unknown`으로 둠. 종 배지 카운트만 사용. 인앱 알림 목록 UI 확장 시 payload shape 협상.
5. **KPI 양식 편집·일정 편집(중요도 하):** M5 설정의 KPI 양식(jobLevel별 항목)·단계별 일정·대상자 편집은 계약(`POST /kpi-templates`)은 있으나 본 단계 UI는 읽기/요약까지(플레이스홀더 안내 명시). 편집 폼은 후속.

## 6. 실행 환경
- Node 미설치(개발 머신) → 빌드 검증은 배포 단계. 코드 일관성(누락 import·미정의 타입·죽은 라우트 0)으로 정합 수동 보장. `tsconfig` strict, `noUnusedLocals` 미설정.
