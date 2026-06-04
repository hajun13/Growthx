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

## 7. shadcn/ui 전면 재스킨 (2026-06-02, v3 외형 개편)

> **범위:** 외형/마크업/카피만 교체. 기능·API·라우팅·데이터 훅·응답 봉투 처리·`lib/api.ts`·`lib/auth.ts`·훅·`next.config.mjs`·계약 타입은 **무변경**. 공용 컴포넌트의 public prop 인터페이스 100% 유지(페이지 호출부 시그니처 보존).
- **디자인 언어:** shadcn new-york + neutral 테마 그대로(primary=near-black, 표면 흰/연회색, 헤어라인 보더, 절제된 shadow-sm). 글꼴 Pretendard 유지. 화면 색 토큰(`grade*`/`status-*`/`chart-*`/`pool-*`/`success`/`warning`/`danger`)은 데이터 시각화에 보존.
- **공용 컴포넌트 → shadcn 매핑:** Button→ui/button(variant primary/secondary/ghost/danger→default/outline/ghost/destructive, loading=lucide Loader2), Card→ui/card, Select→ui/select, TextField→ui/input+textarea+label, Tabs→ui/tabs(언더라인 트리거), Modal→ui/dialog, StatusBadge/GradeChip→ui/badge(+도메인 색 className), GradeRadio→Radix radio-group primitive(버튼형 등급셀), ResultTable→ui/table, States(Skeleton/Spinner/Empty/Error/Forbidden)→ui/skeleton+ui/alert+lucide, Toast→**sonner**.
- **데이터 시각화(재스타일만):** KpiCard/AchievementField/EvidenceUpload/CommentThread(ui/avatar)/WeightField/ScoreCard/DistributionBarChart/PoolGauge/ProgressDonut/ComparisonBar/ProcessFlow/WeekScheduleCalendar/PageHeader(ui/select) — 시맨틱 토큰(bg-card/background/muted, text-foreground/muted-foreground, border-border/input)+도메인 색으로 교체, 계산/props 불변.
- **셸:** AppShell 재작성 — 좌측 사이드바+상단바, 모바일 ui/sheet 드로어, 사용자 메뉴 ui/dropdown-menu+ui/avatar, nav 항목별 lucide 아이콘(NAV_ICONS 키 매핑, `lib/nav.ts` 구조 불변). 브랜드 "에너지엑스 인사 평가".
- **토스트 전환:** `components/Toast.tsx`의 `useToast().show({variant,message,duration})` API 시그니처 유지(전 페이지 호출부 무수정). 내부만 sonner로 — success→toast.success, danger→toast.error, info→toast. `ToastProvider`는 children 통과 + `<Toaster position=bottom-center richColors closeButton>` 렌더(=`app/providers.tsx` 무변경).
- **로그인:** ui/card+TextField+Button 중앙 카드. 데모/안내 카피 유지.
- **이모지 제거:** 📣/🔒/⚠/🗑/✓ → lucide(Megaphone/Lock/AlertTriangle/Trash2/Check, Minus) 또는 한국어 카피로 치환(0건).
- **죽은 토큰 일소:** 14개 라우트 + 공용 컴포넌트에서 옛 토큰(`bg-neutral-0/50/100`, `text-neutral-*`, `bg-primary-50`, `text-primary-700`, `text-md`, `shadow-focus`, `rounded-pill`, `duration-fast/base`, `ease-standard`)을 시맨틱 토큰으로 일괄 치환 → grep 0건.
- **사용자 노출 "GrowthX" 잔재:** 0건(내부 패키지명 `@growthx/web`만).
- **검증:** `tsc --noEmit` 통과, `next build` 통과 — **16개 라우트**(14 화면 + `/`(redirect) + `/_not-found`) 정상 생성. `app/(auth)/login`은 (auth) 그룹이라 URL=`/login`.

---

## v3 시인성 개선 + 레퍼런스 재설계 (외형/카피만, 기능·API·라우팅·훅 무변경)

레퍼런스 솔루션 이미지(주간 캘린더·본인평가 3분할·2차 부서장 평가 분포·평가 상세결과 다크요약/비교바)를 디자인만 참고. 내용은 우리 도메인(순수 KPI·self+downward1/2·그룹풀)으로 매핑. 다크모드 미추가(라이트 고정).

### 전역 시인성
- `globals.css`: 본문 foreground 대비↑(12% L), muted-foreground 45→38%, border 또렷(86%), 페이지 배경 미세 회청 틴트로 흰 카드 분리, radius 0.625rem, ring=파랑. 다크 변수 사용 안 함.
- `AppShell`: 사이드바 항목별 컬러 아이콘 타일(연배경+컬러 lucide), 활성 항목 ring+bold, header/aside `bg-card`+shadow.
- 신규 공용: `InfoBanner`(info/tip/warning/success 컬러 배너), `Breadcrumb`(← 상위로 이동 / A > B).
- `Card`/`PageHeader`: 헤더 bold·title 26px extrabold. `StatusBadge`/`GradeChip`은 기존 도메인 색 토큰 유지(이미 고대비).

### 화면별(우리 도메인 매핑)
- `/eval`: `WeekScheduleCalendar` 재설계 — 일~토 7열 그리드 + 주 전체폭 컬러 상태 바(진행중=파랑/완료=초록) + 셀 카드(배지+안내+액션). 단계=평가준비→본인평가→1차 부서장(팀장)→2차 부서장(본부장)→결과. 상단 "N개의 인사평가를 확인하세요"+공지 버튼+InfoBanner. 데이터 바인딩(selfStatus·kpiConfirmed·downwardPending) 보존, onPhaseClick→기존 라우트.
- `/eval/self`: 우측 레일 `ScoreCard prominent`(보라 그라데이션 점수 카드)+sticky, InfoBanner. 2탭(성과중심/협업·성장) 유지.
- `/eval/dept-head`: 1차/2차 맥락 InfoBanner, 종합 점수 prominent 카드, `GradeRadio` 선택 고대비(등급색 채움).
- `/eval/result/[userId]`: Breadcrumb+InfoBanner+**다크 요약 카드**(이름/직책 아바타 + 등급 박스 3개[종합/본인평가/부서장평가] + percentile/전사평균). **주의:** API(EvaluationResult)에 카테고리(성과중심/협업·성장)별 등급이 없어 박스 라벨을 데이터가 실제 표현하는 종합/본인/부서장으로 정직하게 표기(허위 카테고리 등급 미생성). 신규 `EvaluatorFlow`(본인평가→1차 팀장→2차 본부장, 아이콘·화살표·점수). 기존 `ComparisonBar`·코멘트 유지.
- `/reports`: InfoBanner + StatCard 4종(대상자/집계완료/전사평균/최다등급) + 기존 분포차트·테이블.
- `/kpi`,`/kpi/review`,`/appeals`,`/admin/settings`: InfoBanner 추가, 전역 토큰으로 가독성 정리.

### 검증
- `npm run build --workspace apps/web` ✓ (16 routes), `tsc --noEmit` ✓ EXIT=0.
- 다크모드 미추가, Pretendard 유지, "GrowthX" 사용자 노출 0, lib/api·auth·next.config·Docker·훅·라우팅 무변경.

### 남은 한계
- 결과 요약 3박스는 카테고리별 등급 API 부재로 종합/본인/부서장 라벨 사용(레퍼런스의 종합/성과/역량 3박스를 그대로 재현하려면 백엔드가 group별 grade를 응답에 추가해야 함 — backend-engineer 협의 필요).
- 결과 상세 다른 사용자 열람 시 이름/소속은 중립 표기(결과 API에 evaluatee 식별정보 미포함). 본인 결과만 실명 표시.
- 캘린더 날짜·주차는 표시용 고정 라벨(평가 일정 소스 API 없음). 단계 상태는 실데이터(self/kpi/downward) 바인딩.

---

## M2 (2026-06-04) — 신규 기능 + 미완 완성 + RuleSet 전 구간 연결

### 신규 라우트 (3)
- `/dashboard` (hr_admin) — HR 위젯 그리드. `GET /dashboard/summary`. hr_admin 로그인 기본 랜딩.
- `/notifications` (전 역할) — 알림 센터(탭 필터·읽음·일괄 읽음).
- `/admin/audit` (hr_admin) — 감사 로그 필터 + 테이블 + DiffViewer 모달.

### 확장 라우트
- `/admin/settings` — placeholder 전부 제거. 규칙(5필드 전 편집)·KPI 양식(jobLevel 탭·CRUD·엑셀 임포트)·일정(단계별 마감일·D-7/3/1·채널) 실편집.
- `/eval/dept-head` — B-3a 종합등급 오버라이드(사유 필수) 추가, B-3b GradePool.caps 직접 사용(추정 제거), B-3c userName 표시.
- `/eval/result/[userId]` — B-3d byGroup(종합/성과중심/협업·성장 3박스), B-3c userName/departmentName 표시.
- `/reports`·`/appeals` — B-3c userName 표시. `/reports`·`/admin/compensation`·`/dashboard` — ExportButton.

### 신규 컴포넌트 (10)
WidgetCard · NotificationBell · NotificationItem · ExportButton · FileDropzone · DiffViewer · AuditFilterBar · RuleSetEditor(+validateRuleSet) · TemplateEditor(+templateValid) · ScheduleEditor. AppShell 벨 슬롯 확장(NotificationBell 통합).

### 신규 훅 (5) / 변경
useDashboard · useAuditLogs · useKpiTemplates(+commands) · useSchedules(+commands) · useNotifications 확장(useUnreadCount·read→PATCH·readAll). lib/excel.ts(blob 다운로드·multipart 업로드). nav.ts(dashboard·audit 항목·landingPath). ui.ts(notification/audit/phase/jobLevel 라벨).

### 타입 (계약 1:1)
Evaluation(overallGrade·overallReason·userName·departmentName) · EvaluationResult(byGroup·userName·departmentName) · GradePool(groupName·headcount·caps) · Appeal(userName·departmentName) · Notification(payload 타입) · CycleSchedule · AuditLog · DashboardSummary · ImportResult · KpiTemplateItemInput · ScheduleItemInput.

### 빌드
`npm run build` 통과 — 19 라우트(static 18 + dynamic 1). TS strict·타입체크 클린.

### 경계면 포인트 (QA 참고)
- 익스포트(`/excel/export/*`)는 봉투 없는 .xlsx 바이너리 → lib/excel.ts에서 blob 처리(apiGet 미사용). 임포트는 정상 `{data}` 봉투.
- 감사 로그 `action`/`entity`는 계약의 raw 문자열(`rule_set.update` 등). 컴포넌트 스펙의 AuditAction enum(`ruleset_update`)과 다름 → 계약 문자열을 SSOT로 채택, ui.ts에서 한글 매핑.
- 종합등급 오버라이드: `overallGrade` 설정 시 `overallReason` 필수(미입력 시 프론트에서 제출 비활성 + 백엔드 422 방어).
- 일정 phase 키: `prep|self|downward1|downward2|result`(복수형 경로 `/cycles/:id/schedules`).
- scheduleCommands.upsert는 PATCH가 `{data,meta}` 목록 봉투 반환 → apiPatch가 `.data`(배열) 추출.

### 협상/미해결 항목 (backend-engineer)
- ~~엑셀 **양식 다운로드** 엔드포인트 부재~~ → **해결(2026-06-04)**: 백엔드 `GET /api/v1/excel/template/:kind`(`templates|org|achievements`) 추가됨. 아래 "M2 보강" 참조.
- ~~감사 로그 **엑셀 내보내기**: `/excel/export/audit` 부재~~ → **해결(2026-06-04)**: 백엔드 `GET /api/v1/excel/export/audit` 추가. /admin/audit ExportButton 배치 완료.
- 일정 **대상자(targetUserIds/targetDeptIds)**: 계약은 지원하나 UI는 채널·마감일·리드타임까지만 노출(대상자 선택 UI는 후속). 저장 시 빈 배열 기본값.

### M2 보강 — 죽은 버튼 0 (2026-06-04, 백엔드 신규 엔드포인트 연결)
**연결 1 — 엑셀 양식 다운로드 (`GET /excel/template/:kind`)**
- `components/FileDropzone.tsx`: `templateHref?`·`templateLabel?` prop 추가. 양식이 있으면 드롭존 상단에 "양식 받기" 버튼(secondary + Download 아이콘) 렌더.
  - **인증 헤더 필요**(`@Roles(hr_admin)`) → 단순 `<a href>` 링크 불가. `lib/excel.ts`의 `downloadExcel(path, fallback)` 재사용(Authorization 헤더 + blob 다운로드). 로딩 상태·실패 토스트 처리.
- `app/(main)/admin/settings/page.tsx`(KPI 양식 탭 모달): `templateHref="/excel/template/templates"` `templateLabel="KPI 양식 받기"` 연결.
- `org`/`achievements` 양식: 계약·FileDropzone는 `templateHref`로 즉시 지원하나, 현재 M2 프론트에 **org/대상자·KPI 실적 임포트용 FileDropzone 인스턴스 자체가 미렌더**(임포트 UI는 KPI 양식 1건만 존재). 추가 임포트 화면 신설 시 `templateHref="/excel/template/org"`·`"/excel/template/achievements"` 부착하면 됨(컴포넌트는 준비 완료).

**연결 2 — 감사 로그 익스포트 (`GET /excel/export/audit`)**
- `app/(main)/admin/audit/page.tsx`: PageHeader `right`에 `ExportButton` 배치(label "감사 로그 내보내기").
  - 현재 **적용된** 필터(`applied`: actorId·action·entity·from·to)를 `URLSearchParams`로 직렬화해 `path`에 부착 → 드래프트가 아닌 화면에 반영된 필터와 동일 결과를 받음.
  - `entityId`: 계약/백엔드는 수용하나 AuditFilterBar에 입력 UI 없음 → 쿼리에서 생략(전건 매칭). 후속 단건 추적 UI 신설 시 추가 가능.
  - 봉투 없는 .xlsx → `ExportButton`이 `downloadExcel`로 blob 다운로드(기존 results/distribution/compensation 익스포트와 동일 패턴).

### 빌드 (M2 보강 후 재검증)
`npm run build` 통과 — 19 라우트. TS strict·타입체크 클린. 죽은 버튼: 위 연결로 KPI 양식 다운로드·감사 익스포트 해소. 남은 미연결 없음(org/achievements 양식 버튼은 해당 임포트 화면 신설 시 한 줄로 부착 가능).

### M2 결함 수정 — 죽은 엔드포인트 0 완성 (2026-06-04, QA qa-report-m2-features.md D-1·D-2·D-3)

**[Major] D-1 — GradePool headcount·caps 직접 소비** (`app/(main)/admin/group-performance/page.tsx`)
- 제거: `pool.sRatio` 등 비율로 caps 재구성하던 `useMemo`(133-144 "100명 기준 예시" 주석 포함)와 미사용 `useMemo` 임포트.
- 적용: BE 산정값 직접 사용 — `caps = pool.caps`, `headcount = pool.headcount`. `DistributionBarChart total={headcount}`, 카드 제목 `정원 ${headcount}명 기준 상한`, 라벨 `${g} ${caps[g]}명 · … / 정원 ${headcount}명`. (`lib/types.ts` GradePool에 headcount·caps 이미 정의 — 타입 변경 없음.)

**[Minor] D-2 — 조직/실적 엑셀 임포트 UI** (`app/(main)/admin/settings/page.tsx`, 일정·대상자 탭)
- `FileDropzone` 2개 신규 렌더(기존 KPI 양식 임포트 패턴 동일·`uploadExcel`/`downloadExcel` 재사용):
  - 조직·대상자: `templateHref="/excel/template/org"` → `uploadExcel('/excel/import/org', file)`.
  - KPI 실적: `templateHref="/excel/template/achievements"` → `uploadExcel('/excel/import/achievements', file)`.
- 핸들러 `handleOrgImport`·`handleAchievementsImport`(각 importing/result state). 검증결과(`validCount/errorCount/errors`)는 FileDropzone가 그대로 표시. BE 엔드포인트·양식 kind(`org`/`achievements`) 확인 완료.
- → 위 "연결 1"의 미해결 항목(org/achievements 양식 버튼 미렌더) 해소.

**[Minor] D-3 — compensation 실명 표시** (`lib/types.ts`, `app/(main)/admin/compensation/page.tsx`)
- `Compensation` 타입에 `userName: string | null`·`departmentName: string | null` 추가(BE list·compute 응답 비정규화).
- 표 대상자 셀: `userId.slice(0,8)` → `userName ?? '-'`(주) + `departmentName` 보조표시(xs muted 2단 레이아웃).

### 빌드 (결함 수정 후 재검증)
`npm run build` 통과 — 19 라우트, TS strict·타입체크 클린. 죽은 버튼/미연결 0 (org·achievements 임포트·양식 다운로드까지 모두 실엔드포인트 연결). DESIGN.md 패턴·"~해요" 라이팅 유지.
