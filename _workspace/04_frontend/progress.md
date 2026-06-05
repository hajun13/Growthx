# 프론트엔드 구현 현황 — v2 도메인 대정정 (frontend-engineer)

> **[2026-06-05] 내 평가표 실데이터 구현 + KPI 작성 미사용 훅 2종 연동** — 스텁/미연동 정리.
> - **`eval/my/page.tsx`(내 평가표):** `useResultDetail`만 쓰던 결과중심 화면에 실데이터 진행현황 추가. ① `useCurrentPhase(cycleId)`로 **현재 단계 배너**(PHASE_LABEL 매핑 + dueDate·D-day). `daysRemaining`은 BE shape에 없음 → `dueDate-now` 프론트 산출(types.ts §620 주석대로). ② `useKpis({cycleId,userId:me})` **내 KPI 요약**(확정/제출·승인/작성중/반려 4집계 + 가중치 합, `/kpi` 작성 링크). ③ `useEvaluations({cycleId,evaluateeId:me})` 기반 **평가 프로세스**(본인/1차팀장/2차본부장 done·진행중·대기 — byType 점수 또는 evaluation status). ④ 본인 결과 상세 링크 `/eval/result/[me]`. **결과 404(캘리브레이션 전)에 early-return 하지 않고** KPI요약+진행현황을 항상 노출하도록 재구성(403만 Forbidden 차단, 결과 외 에러만 ErrorState).
> - **`kpi/page.tsx`(KPI 작성) — 미사용 훅 2종 연동:** ① `useKpiCategoryAllowed`가 `allowedCategories`만 계산하고 **JSX 미사용**이던 것 → 직급별 허용 카테고리 **안내 배너**(allowed<5일 때, `allowedPolicy.label` + 허용 카테고리 라벨) + 그룹 select `<option disabled>`(`isGroupAllowed`=그룹 내 허용 카테고리 0개면 비활성 "(작성 불가)"). ② `useKpiTemplates({cycleId,jobLevel:user.jobLevel})` 신규 연동 → 양식 존재 시 헤더 **"양식 불러오기"** 버튼(`loadTemplate`: 허용 카테고리 항목만 빈 draft 행으로 프리필 — group/category/measureType/csf(sampleStrategy)/weight/isQualitative, title·target 공란 유지). 기존 폼 흐름 비파괴(append만).
> - **사용 API(QA 대조):** `GET /kpis?cycleId&userId`, `GET /evaluations?cycleId&evaluateeId`, `GET /cycles/:id/current-phase`, `GET /results/:userId?cycleId`(404 graceful), `GET /kpi-category-policy/allowed?userId`(필드 `allowed[]`·`label`·`position`), `GET /kpi-templates?cycleId&jobLevel`(items[] `category`·`group`·`sampleStrategy`·`defaultMeasureType`·`defaultWeight`·`isQualitative`). 모두 camelCase·lib/api unwrap.
> - **검증:** `npx tsc --noEmit` EXIT 0. 추측 캐스팅 없음(daysRemaining 미참조). 토큰/컴포넌트(T.*·Card·States·Modal·Toast) 재사용, borderRadius 0 유지.

> **[2026-06-05] 보상 화면 전면 재구성 — 디자인 파일 CompSimul.tsx 1:1(레이아웃·컬럼·출력)** — `admin/compensation/page.tsx` 전면 재작성. 슬라이더·스택 바차트·"대상자 인상률 산출" 섹션 전부 제거.
> - **제거 요소:** `recharts`(BarChart/Bar/XAxis/YAxis/CartesianGrid/Tooltip/ResponsiveContainer) import·차트 전부, 시뮬레이션 파라미터 슬라이더 2개(bonusPct/raiseCapPct), "대상자 인상률 산출" 섹션(compute/compensationCommands·meta·comps·busy state·SummaryCard·MetaCell 헬퍼)·클라이언트 재계산(GRADE_MULT) 전부 삭제. → 화면이 백엔드 응답만 표시(프론트 재계산 없음).
> - **데이터:** `useTeamCompensationSimulation({cycleId})` + `useCurrentCycle()`. 봉투 unwrap `teamSim?.data ?? []`. 데모 데이터 없음(레퍼런스의 하드코딩 employees 배열 미사용 → 실제 행으로 대체).
> - **types.ts:** `CompensationSimulation`에 4필드 추가 — `position: Position` / `previousSalary: number|null` / `divisionName: string|null` / `teamName: string|null`. 기존 9필드 유지.
> - **화면(레퍼런스 동일):** 헤더(보상 현황+부제, 출력 Printer / 다운로드 Download 검정 #191f28) · 노랑 접근배너(Lock, 본인·그룹대표·본부장·관리자) · 등급별 인상률 기준(byGrade의 실 raiseRate 뱃지, S~D 정렬, 행 없으면 생략) · 요약 4카드(총인원/평균인상률/총인건비증가 억원/S등급, currentSalary·grade 없는 인원 합계 제외) · 본부 필터(distinct divisionName) · 테이블 8컬럼(이름·본부·팀/직급/평가등급/전년도/금년도/→/차기년도/인상액율, 만원 변환, 양수녹 음수빨 0회색, hover #f9fafb, 빈상태). 등급 S/A/B/C/D(B+ 폐기), gradeBg(S #7C3AED…D #d22030).
> - **출력(handlePrint):** page.tsx 내 `handlePrint`. window.open→document.write HTML표→win.print(). 제목 "에너지엑스 차기년도 보상 현황", 9컬럼(본부/팀/이름/직급/전년도/금년도/평가등급/차기년도/인상액율), 만원 표기, null "-", 등급/인상액 색, 레퍼런스 <style> 그대로(border #e5e8eb, th #f9fafb). font Pretendard.
> - **다운로드:** ExportButton 외형 커스텀 불가(Button 고정) → `downloadExcel('/excel/export/compensation?cycleId=...')` 직접 onClick 으로 검정 버튼 구현(레퍼런스 외형 일치). 권한 `isHrAdmin` 유지(Forbidden), 배너 문구는 레퍼런스대로.
> - **검증:** `npx tsc --noEmit` EXIT 0. recharts 등 제거 의존성 정리 완료.

> **[2026-06-05] 역량관리 섹션 2개 신규 페이지 — 디자인 파일(CompItems/CompEval) 1:1 + 백엔드 연결** — 풀스택(스키마→DTO→서비스→타입→훅→nav→AppShell→페이지).
> - **백엔드:** `CompetencyQuestion`에 `category(기본 전문성)`·`weight(Int 기본 0)`·`appliedLevel(기본 전 직급)` 3필드 추가. ① schema.prisma ② 수동 migration `20260605000000_add_competency_fields/migration.sql`(DB 미가동 `db:5432` → `migrate dev` 실패, `ADD COLUMN IF NOT EXISTS` 수동 작성 후 `prisma generate`) ③ DTO Create/Update에 3필드(`@IsOptional`) ④ service `createQuestion`(?? 기본값)·`updateQuestion`(?? undefined)·`toQuestionDto` 반영 ⑤ seed 5문항에 category/weight/appliedLevel 부여.
> - **타입/훅:** `types.ts` `CompetencyQuestion`·`CompetencyQuestionInput`에 3필드 추가(`CompetencyQuestionPatch`는 Partial<Omit>로 자동 포함). `useCompetency.ts`에 `scoreToGrade`/`gradeToScore`(1~5 ↔ D~S 매핑) 추가 — 별도 `useCompetencyQuestions.ts` 파일 생성 안 함(기존 훅에 동일 export 이미 존재 → 이름 충돌 회피, 기존 `competencyQuestionCommands`/`competencyResponseCommands` 재사용).
> - **nav/AppShell:** `nav.ts` `self` 앞에 `competency-items`(/admin/competency/items, hr_admin)·`competency-eval`(/competency/eval) 삽입 + `activeKeyForPath` 매핑(`/admin/competency`→items, `/competency/eval`→eval). `AppShell.tsx` `Brain`/`ClipboardCheck` 아이콘 import + NAV_ICONS 매핑. permConfig는 신규 키 부재 시 `!==false`=노출(기본 표시).
> - **CompItems** `admin/competency/items/page.tsx`(신규): hr_admin 가드(Forbidden)·`useCurrentCycle().current.id`로 cycleId. 통계 4카드·카테고리 탭(전체+4)·검색·테이블(grid `1fr 100px 100px 80px 80px 80px`)·카테고리 색배지(catColors)·활성 토글(`update isActive`)·편집/삭제. 추가/편집 Modal(text/hint/category 버튼/weight/appliedLevel select/isActive). 최대 10문항.
> - **CompEval** `competency/eval/page.tsx`(신규): 활성 문항만 노출. 1~5 점수버튼(라벨 매우미흡~매우우수)→`scoreToGrade`로 Grade 변환 후 `bulkSave`(submit:false)/`bulkSubmit`(submit:true). 기존 응답 `gradeToScore`로 초기화. **`submittedAt!=null` 1건이라도 있으면 전체 입력 잠금**(버튼·textarea disabled, success 배너). 평균/카테고리별 평균/완료 N개 통계, 카테고리 필터 탭, MIDTERM 주기 안내.
> - **검증:** `tsc --noEmit` web/api 모두 EXIT 0. 봉투 unwrap(`data?.data`)·camelCase 1:1. `apiPost<CompetencyResponse[]>`는 BE `{data,meta}` 목록봉투를 apiPost가 `.data`로 unwrap(일치). borderRadius 0(직각, 배지/점수칩만 999).

> **[2026-06-05] 그룹실적/등급풀 페이지 전면 개선 — 디자인 파일 1:1 + 인터랙티브 풀 편집** — `admin/group-performance/page.tsx` 전면 재작성 + 훅/타입 3건 추가.
> - **인라인 헤더:** `PageHeader`(cycles/onSelectCycle 토글 포함) 제거 → 인라인 `<h1>그룹실적 / 등급풀</h1>` + 우측 네이티브 `<select>`(그룹 선택). 사이클 토글 삭제(`useCurrentCycle`은 `current`만 사용). 인라인 `T` 객체 제거 → `import { T } from '@/lib/toss'`.
> - **섹션2 등급풀 설정(인터랙티브):** 디자인 GroupPerf.tsx의 Grade pool editor 1:1 포팅. `poolRows: {grade,pct,count,locked}[]` 로컬 state를 서버 `pool`(sRatio…dRatio·caps) 로드 시 `useEffect`로 초기화. **−5/+5 버튼**(잠금 시 비활성·회색 배경 `T.grey50`), **🔓/🔒 잠금 토글**, 큰 %숫자+프로그레스바+`N명 예상`(=headcount×pct/100, 표시 전용). 합계≠100%면 상단 경고 배너. **저장 버튼**(헤더 우측, `poolDirty && poolSum===100`만 활성) → `gradePoolCommands.update(pool.id, {sRatio…})` = `PATCH /grade-pools/:id`.
>   - **중요 단위 정정:** 백엔드는 ratio를 **0~100 퍼센트**로 저장(grade-pools.service.ts: `caps = ceil(sRatio/100 × headcount)`, DTO `@Min(0)@Max(100)`). 기존 페이지가 `ratios[g]*100` 으로 잘못 표기하던 것을 `Math.round(pool.sRatio)` 직접 사용으로 교정. 파이/저장 모두 동일 퍼센트 기준.
> - **섹션3 파이:** 범례를 **명수→%**로 변경(디자인 기준). `pieData = poolRows.pct`. Tooltip `${v}%`.
> - **섹션4 부서별 등급 현황(신규):** `DeptGradeTable` 컴포넌트. 헤더 탭(전체+부서명, 클릭 필터)·컬럼 `부서|S|A|B|C|D|전체`(grid `1fr 60px×5 80px`)·등급 셀=등급색 배지. `useGradeDistribution({cycleId,groupId})` → `GET /evaluations/grade-distribution`.
> - **신규 훅/타입:** `useEvaluations.ts` 하단 `useGradeDistribution`, `types.ts` `GradeDistributionRow{deptId,deptName,S,A,B,C,D,total}`, `useGradePools.ts` `gradePoolCommands.update`.
> - **⚠ 백엔드 협상 필요(backend-engineer):** `GET /evaluations/grade-distribution?cycleId=&groupId=`는 **현재 미구현**(evaluations.controller에 없음). 프론트는 에러 시 `EmptyState`("아직 확정된 등급 현황이 없어요.")로 graceful degrade — 페이지 크래시 없음. 엔드포인트는 `ApiListEnvelope<GradeDistributionRow>` 봉투로 반환 요청. `PATCH /grade-pools/:id`는 검증 완료(존재·`@Roles(hr_admin)`·UpdateGradePoolDto 일치).
> - **검증:** `tsc --noEmit` 에러 0. 봉투 unwrap(`poolData?.data[0]`·`distData?.data`)·camelCase 1:1. borderRadius 0(직각 유지).

> **[2026-06-04] 권한 관리 페이지 전면 개선 — 인라인 직접 편집 + 컴팩트** — `admin/permissions/page.tsx` 단일 수정(신규 파일 없음).
> - **인라인 권한 편집:** 수정 버튼(Edit2)·`editId` state 제거. 권한 레벨이 행마다 `select`로 직접 표시(배경=권한색 `roleCfg[role].bg`, 흰 글자). onChange→ `userCommands.update(id,{role})`(PATCH) 즉시 호출, `value` controlled(낙관적 X — 성공 시 `reload()`, 실패 시 `ApiError.message` 토스트). 저장 중 `disabled`+cursor:wait.
> - **권한 라벨 정정:** `roleLabel`(="HR 관리자") 대신 권한관리 전용 라벨을 `roleCfg`에 추가 — hr_admin=전체관리자 (HR) / division_head=그룹/본부관리자 / team_lead=팀관리자 / employee=일반사용자. 필터칩·인라인 select·매트릭스 모두 동일 출처 사용.
> - **기준 단위(조직/직급/직책):** 3버튼 토글 컬럼 신규. **API에 해당 필드 없음** → 프론트 로컬 state(`orgUnitOverrides: Record<userId, OrgUnit>`), 미설정 시 `defaultOrgUnit(u)`(position/role 기반 추론)로 표시. 직무 단위 없음(조직·직급·직책만). 서버 미전송(주석 명시).
> - **컬럼 재구성:** `이름/부서 | 직위 | 권한레벨(select) | 기준단위(3버튼) | 가시범위`. "마지막 수정"은 API 타임스탬프 없어 미채택, 대신 실데이터 `visibilityScope`(SCOPE_LABEL 한글)로 대체. 비활성 사용자 opacity 0.5.
> - **컴팩트 패스:** 안내 배너 간소화(`8px 12px`·1줄). 3탭 모두 패딩 20→16, 행 패딩 12~16→10px. 가시성 범위카드 gap 12→8(가로 1줄 유지), 경쟁구조 inline 배너화. 외곽 gap 20→12.
> - **디자인 제약:** borderRadius 0(아바타 없음). 파스텔·그라데이션 0건. 색은 기존 `T` 토큰만(spec의 permColor와 일치 — division=blue#3182f6/team=green#03b26c).
> - **검증:** `tsc --noEmit -p apps/web` 에러 0. `editId/roleLabel/Edit2` grep 0건(이전 progress의 미정의 에러 해소). 봉투 unwrap(`usersData?.data`)·camelCase 1:1 유지.

> **[2026-06-04] 사용자 관리에 "조직 구조" 탭 추가 — 그룹/본부/팀 CRUD** — `admin/users/page.tsx` 단일 수정(신규 파일 없음).
> - **탭 도입:** `사용자 목록` | `조직 구조` 2탭(`tab` useState). 헤더 우측 버튼·설명 문구가 탭에 따라 분기(사용자 추가 ↔ 그룹 추가). 사용자 목록 콘텐츠(통계·필터·테이블)는 `tab==='users'` 프래그먼트로 래핑.
> - **조직 구조 탭:** `useOrgChart`(이미 폼 select 용으로 로드돼 있던 훅) 의 `chart.children`(=그룹들)을 들여쓰기 트리(`OrgTreeRow`, depth 0=그룹/1=본부/2=팀, 펼치기·접기)로 렌더. 각 행 인라인 액션 `+본부`/`+팀`·`이름 수정`·`삭제`. 별도 `/departments` GET 추가 호출 없이 기존 org-chart 트리 재사용(인원수 totalCount 표시).
> - **CRUD 배선:** `departmentCommands.create({name,type,parentId})`·`.rename(id,name)`·`.remove(id)`(이미 존재, 추가 안 함). 백엔드 `PATCH /departments/:id` 가 name 만 받으므로 update 대신 `rename` 사용. 추가/이름변경은 기존 공용 `OrgNodeModal`(부모→자식 타입 자동 결정: 없음→group, group→division, division→team) 재사용, 삭제는 공용 `Modal` 확인. 쓰기 후 `reloadChart()`. 에러는 `ApiError.message` 토스트(하위/구성원 있으면 BE가 CONFLICT → "구성원이나 하위 조직이 있어 삭제할 수 없어요").
> - **사용자 폼 조직 데이터:** 이미 실 API(`useOrgChart`→`org.groups/divisions/teams`) 사용 중이었음(하드코딩 GROUPS/DEPTS/TEAMS 없음). User 생성 시 `resolveDeptId`=teamId||divisionId||groupId → `departmentId` 전송(name 아님). 요구 #1·#4 는 기존 구현으로 이미 충족 — 변경분은 탭+조직 트리 CRUD UI 뿐.
> - **RBAC:** 페이지 진입 `isHrAdmin` 가드(아니면 `<Forbidden>`). 조직 트리 인라인 액션·삭제는 `editable={isAdmin}` 로 hr_admin 에게만 노출. BE 컨트롤러도 `@Roles(hr_admin)` 로 POST/PATCH/DELETE 보호.
> - **디자인 제약:** borderRadius 0(트리 타입 점·아바타만 `is-circle`), 파스텔·그라데이션 0건. 색은 기존 `T` grey/blue/red 토큰만.
> - **검증:** `tsc --noEmit -p apps/web` — `admin/users/page.tsx` 에러 0(무관한 기존 `admin/permissions/page.tsx` editId/Edit2 미정의 에러는 본 작업 범위 밖·미수정).

> **[2026-06-04] 신규 페이지 — UserMgmt + PermMgmt (Agent G)** — `admin/users/page.tsx`·`admin/permissions/page.tsx` 2파일 신규 생성(디자인 UserMgmt.tsx·PermMgmt.tsx 레이아웃 포팅 + 실 API 연동). Agent A가 nav에 추가했으나 page 미존재였던 404 라우트 2개를 채움.
> - **공통:** `'use client'`, `fontFamily: 'Pretendard, sans-serif'`, 인라인 스타일(디자인 inline 그대로). `borderRadius`/`rounded-*` 0건(`is-circle` 아바타만 원형 허용). 파스텔·그라데이션 0건(배경 #f9fafb/#f2f4f6 grey·#fff). lucide-react 아이콘 사용.
> - **데이터 소스:** `useUsers({pageSize:500})`(목록, `data?.data` 봉투 unwrap)·`useOrgChart`(그룹/본부/팀 합성). 디자인의 하드코딩 GROUPS/DEPTS/TEAMS·initialUsers mock **미채택** → 실 조직 트리(`flattenOrg`+`deptPath`)로 합성. 디자인 `title`(직급)→`User.position`(`positionLabel` 한글), `group/dept/team`→`departmentId` deptPath로 도출.
> - **users 페이지:** 검색(이름·이메일·팀·본부)·그룹 필터칩 useState 실동작. CRUD = `userCommands.create/update/deactivate`(POST/PATCH/DELETE `/users`). 폼은 그룹→본부→팀 종속 select(id 기반, org 트리 필터), 직급 10값 Position select. 추가/수정/삭제(soft-delete=비활성화) 모달. RBAC `isHrAdmin` 가드(아니면 `<Forbidden>`). 통계 4카드(전체/이사이상/본부장·팀장/팀원)는 position 기준 집계. 비활성 사용자 opacity 0.5+"(비활성)" 배지.
> - **permissions 페이지:** 탭3(사용자별 권한·권한 매트릭스·가시성 설정). **사용자별 권한** = 실데이터, role 인라인 select 수정 → `userCommands.update(id,{role})`(PATCH). 디자인 PermLevel(6) → API Role(4) 매핑: 전체관리자=hr_admin / 그룹·본부관리자=division_head / 팀관리자=team_lead / 일반·조회=employee. role 필터칩·검색 실동작. visibilityScope는 칩 표시(읽기). **권한 매트릭스**=정적 안내(Role별 기능 허용표). **가시성 설정**=정적 mock(백엔드 없음 — Eye 토글 로컬 state, "저장 미연동" 명시).
> - **경계면:** 봉투 unwrap(`usersData?.data`)·camelCase 타입(`User`/`Role`/`Position`/`CreateUserRequest`/`UpdateUserRequest`) 1:1. 추측 캐스팅 없음(폼 select value만 `as Position`/`as Role` — enum 옵션 한정). 라우트 `/admin/users`·`/admin/permissions`는 nav.ts·activeKeyForPath와 일치.
> - **검증:** `tsc --noEmit -p apps/web` 에러 0. `borderRadius`/`rounded-` grep 0건.

> **[2026-06-04] 사각 모서리 정밀 패스 — GroupPerf·MonthlyPerf·DistMonitor (Agent E)** — `admin/group-performance/page.tsx`·`reports/page.tsx`(DistMonitor + MonthlyPerf 탭) 2파일 스타일 패스.
> - **목적:** borderRadius 전면 제거(0). 두 파일에서 inline `borderRadius`(등급 pill 20·차트 Tooltip contentStyle 8) 전부 삭제, Tailwind `rounded-xl`/`rounded-lg`/`rounded-sm`/`rounded-full` 클래스 전부 제거. 카드·요약카드·아이콘박스·등급 분포 바·범례 dot·탭·등급 pill 모두 직각.
> - **보존:** 라이브 훅 로직·도메인 타입·RBAC(`canReview`/`isHrAdmin`/그룹·본부장 가드)·봉투 unwrap 전부 그대로. 핵심 주의사항 준수 — DistMonitor/Results는 목록 봉투 `data?.data`(배열), MonthlyPerfSummary는 단건 unwrap 훅이라 `const summary = data ?? null`(`data?.data` 아님) 유지. 등급·달성률·정원·상한·점수는 모두 BE 산정값 표시만(프론트 재계산 없음). `router.push('/eval/result/:userId?cycleId=')` 실존 라우트.
> - **디자인 mock 미채택:** 디자인 파일의 폐기 도메인(부서별 +/− 등급풀 편집기·임의 부서 mock·B+ 5등급 변형·RadarChart 적합도·deviation 알림 mock·팀원 mock 테이블)은 채택하지 않고 기존 도메인-정확 구현(그룹 단위 풀·BE caps 읽기·실제 results/summary) 유지(이 패스는 styling-only).
> - **금지 항목 확인:** 파스텔 배경 0건(쓰인 배경은 #f9fafb/#f2f4f6 grey·#fff 뿐), 그라데이션 0건, 잔여 `rounded`/`borderRadius` 0건(grep). `T.blue50`=#f2f4f6(grey)로 파스텔 아님.
> - 검증: `tsc --noEmit -p apps/web` 에러 0.

> **[2026-06-04] 사각 모서리 정밀 패스 — Appeals·CompSimul·Settings·AuditLog (Agent F)** — 4파일 styling-only 패스.
> - **목적:** `rounded-*` Tailwind 클래스·`borderRadius` 인라인 전면 제거(0). 4파일에서 `rounded-xl`/`rounded-lg`/`rounded-full`/`rounded` 카드·배지·버튼·input·select·아이콘 타일·필터칩 클래스 전부 삭제 → 직각. compensation 차트의 Tooltip `borderRadius: 8`·Bar `radius={[4,4,0,0]}`도 제거.
> - **보존:** 라이브 훅 로직(`useAppeals`/`appealCommands`·`useCompensations`/`compute`·RuleSet/template/schedule/policy 에디터·`useAuditLogs`)·도메인 타입·RBAC 가드·검증 게이트·봉투 unwrap(`res.data`/`res.meta`)·`useSetPrimaryAction`·`ExportButton`·`DiffViewer` 전부 그대로. 검색/필터/페이지네이션 useState 실동작 유지. **프론트 재계산 없음**(보상 금액·인상률은 BE 산정값 표시만).
> - **금지 항목 확인:** 파스텔 배경(`#ebf3fe`/`#ecebfb`) 0건, 그라데이션 0건, 잔여 `rounded`/`borderRadius` 0건(grep). 배지는 `padding: "2px 8px"`류로 직각 유지.
> - 검증: `tsc --noEmit -p apps/web` 에러 0.

> **[2026-06-04] 사각 모서리 정밀 패스 — HRMain·KPIWrite·KPIReview (Agent C)** — `eval/page.tsx`·`kpi/page.tsx`·`kpi/review/page.tsx` 3파일 스타일 패스.
> - **목적:** borderRadius 전면 제거(0). 3파일에서 inline `borderRadius`(카드 16·input 8·badge 20·calendar 12·dot 50%·textarea 8·todo card 8 등) 전부 삭제, Tailwind `rounded-full`/`rounded-xl`/`rounded-lg`/`rounded` 클래스 전부 제거. 배지·버튼·카드·아바타·상태 dot·캘린더 단계 바 모두 직각.
> - **보존:** 라이브 훅 로직·도메인 타입·RBAC·검증 게이트·봉투 unwrap(`res.data`)·`router.push` 실존 라우트 전부 그대로. 디자인 mock의 폐기 도메인(다면평가·역량평가·BSC 재무/고객 카테고리·부장/차장 mock·5등급 B+)은 채택하지 않고 기존 도메인-정확 구현 유지(이 패스는 styling-only).
> - **금지 항목 확인:** 파스텔 배경(#ebf3fe/#ecebfb/#e7f8ef/#fef6e6/#fdecec) 0건, 그라데이션 0건, 잔여 `rounded`/`borderRadius` 0건(grep). `T.blue50`=#f2f4f6(grey)로 파스텔 아님.
> - 검증: `tsc --noEmit` (apps/web) 에러 0.

> **[2026-06-04] AppShell + nav 업데이트 (Agent A)** — `lib/nav.ts` + `components/AppShell.tsx`.
> - **nav.ts:** 최상단(그룹 없음)에 `user-mgmt`(→`/admin/users`, tone `core`)·`perm-mgmt`(→`/admin/permissions`, tone `alert`) 신규 추가, 둘 다 `roles: ['hr_admin']`. `org`(조직도) **nav 항목 제거**(라우트 `/org` page.tsx는 유지·직접 접근 가능). `activeKeyForPath`에 `/admin/users`→`user-mgmt`·`/admin/permissions`→`perm-mgmt` 매핑 추가(`/org` 매핑은 무해하게 유지). 역량관리(comp-items/comp-eval) 미존재 유지. `visibleNav(role)`은 기존 로직대로 hr_admin 전체·그 외 `roles` 필터.
> - **AppShell.tsx:** `NAV_ICONS`에 `'user-mgmt': Users`·`'perm-mgmt': Shield` 추가, `Shield` lucide import 추가. 사이드바·헤더 스타일은 이미 디자인 스펙과 일치(아이콘 박스 24×24 square·활성 `bg-toss-grey100`+`borderLeft 2px #3182f6`·활성 텍스트 `text-toss-blue700`(=#1b64da) 600·비활성 `text-toss-grey700`(=#4e5968)·뱃지 `#f04452` square·그룹 라벨 10px uppercase 0.7px·검색 32h minWidth172 border square·벨 32×32 border square, borderRadius 0). 토큰 검증: `toss-grey100=#f2f4f6`·`toss-blue700=#1b64da`·`toss-grey700=#4e5968`·`toss-grey400=#b0b8c1`·`toss-grey200=#e5e8eb` 1:1.
> - **미해결(다른 에이전트 의존):** `/admin/users`·`/admin/permissions` 라우트 page.tsx 미존재 — nav 항목은 스펙대로 추가했으나 해당 페이지 생성 전까지 클릭 시 404. 사용자 관리·권한 관리 화면 담당 에이전트 작업 필요.
> - 검증: `tsc --noEmit -p apps/web` 에러 0.

> **[2026-06-04] Toss 디자인 교체 — KPI·평가 화면 4개 (Agent C)** — 4파일 재작성 + `lib/toss.ts` 신설.
> - **공통:** Toss 팔레트를 `lib/toss.ts`로 단일화(`T` + `groupChip`/`categoryChip`/`gradeChipColor`). `'use client'` 상단, `fontFamily: 'Pretendard, sans-serif'`. 인라인 스타일 카드(radius 16·border `grey200`)·요약 통계카드·pill 배지·상태색으로 레퍼런스 포팅. **모든 훅 로직·도메인 타입·검증·RBAC·봉투 unwrap(`res.data`) 유지**, 추측 캐스팅 없음.
> - **kpi/page.tsx (KPIWrite):** 헤더 합계칩·과제추가·제출 버튼을 인페이지로(기존 `useSetPrimaryAction` 플로팅 제거 — 레퍼런스가 헤더 제출 버튼). 도메인 그대로: `KpiGroup`/`KpiCategory`/`MeasureType` Select, 그룹↔카테고리 보정, RBAC 카테고리 차단(직책자·정책 매트릭스), 최대 4카테고리, 가중치 100%·정성 ≤30%·성과중심+협업성장 게이트. `kpiCommands.create/update/remove/submit`·`useCurrentPhase`(잠금)·`useMyGroupPerformance`(읽기전용)·`useKpiCategoryAllowed` 유지. 카테고리/그룹/측정방식은 디자인의 재무·고객(BSC) 폐기 → 실제 도메인 5카테고리.
> - **kpi/review/page.tsx (KPIReview):** 좌측 팀원 목록(검색·상태배지)+우측 검토 상세(과제 카드·검증 요약·코멘트 필수·승인/반려/수정요청). `byUser` 그룹핑·`canReview` 가드·`kpiCommands.approve/reject`(reason+comment)·검토 모달 유지. 상태칩=계약 `KpiStatus` 6종 매핑(디자인의 부장/차장 mock 폐기).
> - **eval/self/page.tsx (SelfEval):** 2탭(성과중심/협업·성장) 유지, 과제 카드 안에 도메인-정확한 `AchievementField`(amount/rate/count/qualitative) 임베드 + 과제 점수(BE 산정 표시) 사이드. 디자인의 별점(score 1-5)·역량 탭 폐기(평가=KPI 실적, 등급은 BE). `useEvaluations(type:self)`·`useEvaluationDetail`·`useKpis`(confirmed)·`patch/submit/create`·미입력 가드 유지. **프론트 점수 재계산 없음**.
> - **eval/dept-head/page.tsx (DeptEval):** 좌측 팀원 테이블(상태·최종등급)+우측 평가 패널(종합점수 BE표시·과제별 성과 읽기·정성 KPI 등급부여·코멘트 필수·종합등급 오버라이드+사유). 등급 분포 바·풀 상한 점선 마커는 인라인 Toss화(`gradeChipColor`). 디자인의 KPI/역량 별점 폐기 → `round`(팀장1·본부장2)·`directGrades`·`soldOutGrades`(풀 상한)·`useGradePools`·`canEvaluateDownward` 유지. 등급은 도메인 S/A/B/C/D.
> - 검증: `tsc --noEmit` — 4파일 + `lib/toss.ts` 에러 0(잔여 에러는 무관한 `reports/page.tsx` 선재 결함, Agent C 범위 외).

> **[2026-06-04] Toss 디자인 교체 — 관리 화면 4개 (Agent E)**
> - `appeals/page.tsx`: Appeals 포팅 — 요약 4카드·상태 필터칩·목록 카드(상태 배지)·우측 상세 패널(① 사유 ② 1차 답변 ③ HR 최종 결정 + 역할별 폼). 기존 `useAppeals`/`appealCommands`·역할 가드·봉투 unwrap·`APPEAL_WINDOW_CLOSED` 유지. 상태값은 계약 AppealStatus(submitted/under_review/answered/closed) 매핑.
> - `admin/compensation/page.tsx`: CompSimul 포팅 — RuleSet 인상률 카드·요약 3카드(meta)·recharts BarChart(백엔드 산정값 표시만)·팀/대상자 테이블. 훅·`compute`·HR 가드·SalarySimCard 유지. **프론트 재계산 없음**.
> - `admin/settings/page.tsx`: Settings 좌측 메뉴 IA 차용 — 기능 탭 5개를 220px 아이콘 메뉴 + 우측 콘텐츠 그리드로 재배치. 기존 훅·에디터·모달·`useSetPrimaryAction` 전부 보존.
> - `admin/audit/page.tsx`: AuditLog 포팅 — 요약 4카드·검색·entity 필터칩·테이블·서버 페이지네이션·DiffViewer 모달. `useAuditLogs`·`ExportButton`·봉투 unwrap 유지. **라우트: nav.ts의 `/admin/audit`에 적용**(`/audit` 신규 생성 안 함).
> - 검증: `tsc --noEmit -p apps/web` — 4파일 에러 0(잔여 에러는 무관한 `reports/page.tsx` 선재 결함).

> **[2026-06-04] 결과·실적·모니터링 화면 디자인 교체 (Toss DS, Agent D)** — 3파일 재작성.
> - `app/(main)/eval/result/page.tsx`: EvalResults.tsx 포팅 — 등급 분포(가로 바)+등급별 인원 BarChart(recharts)+등급/부서 칩 필터+점수순 결과 테이블(아바타·percentile·등급 pill). 데이터는 `useResults({cycleId})` 봉투 unwrap(`data.data`). **권한 분기 유지**: `canReview(role)` 아니면(임직원) 기존대로 본인 상세(`/eval/result/[userId]`)로 redirect. 행 클릭→`/eval/result/[userId]?cycleId=`. 등급은 실데이터 S/A/B/C/D(디자인의 B+ 5등급 매핑 폐기). 내보내기=hr_admin `ExportButton`.
> - `app/(main)/admin/group-performance/page.tsx`: GroupPerf.tsx 포팅 — 그룹 실적 입력/조회 카드 + 등급풀 분포(등급별 상한 바, 비율) + 분포 PieChart(recharts). **기존 로직 100% 유지**: `useGroupPerformance`·`useGradePools`·`savePerformance`·`applyPool`·`useSetPrimaryAction`·`isHrAdmin` 편집 분기. 풀은 편집형 슬라이더가 아닌 **BE 산정 caps/headcount/ratios 표시 전용**(재계산 금지 원칙). tier→`tierLabel`/`StatusBadge`.
> - `app/(main)/reports/page.tsx`: **탭 2개**("분포 모니터링"|"월별 실적"). 분포=DistMonitor.tsx 포팅(요약카드 4·전사 분포 스택바·부서별 분포 바·점수순 결과표, `useResults` 집계는 BE 등급의 표시용 집계만). 월별=MonthlyPerf.tsx 포팅(`useMonthlyPerformanceSummary` — KPI카드 4·월별 달성률 LineChart(목표선 ReferenceLine 100%)·카테고리별 누적표; hr_admin 월별 실적 입력 폼 `monthlyPerformanceCommands.create`). 부서 Select(group/division).
> - 공통: `'use client'` 상단, Pretendard 상속(inline style에 font-family 미지정), Toss 팔레트 상수 `T`, 봉투 항상 `res.data`로 unwrap, `as T` 추측 캐스팅 없음, router.push 경로는 실존 라우트.
> - **검증 보류:** Bash/PowerShell 권한 거부로 `tsc --noEmit` 미실행. 사용 컴포넌트/훅 prop·타입을 소스 대조로 확인(ExportButton에 icon prop 없음→제거, Select/TextField/Button/StatusBadge/States prop 일치, ApiError.code 존재, EvaluationResult.departmentName/userName/finalGrade/finalScore/percentile·GradePool.caps/headcount/sRatio~dRatio·MonthlyPerformanceSummary.byCategory/monthlyTrend 1:1).

> **[2026-06-04] 화면 디자인 교체 (Toss DS, Agent B)** — `dashboard/page.tsx`·`org/page.tsx`·`eval/page.tsx` 3파일 + `package.json`(recharts 추가).
> - **공통:** Toss 색상 팔레트(`T` 상수)·인라인 스타일 직접 포팅. `'use client'` 유지. 폰트 `Pretendard, sans-serif`로 통일. mock→실데이터 교체(없으면 mock fallback). 디자인의 `onNavigate` 패턴 → `useRouter().push(route)`로 교체. **다면(peer)평가 단계 제거**(도메인: self+downward만).
> - **dashboard:** Dashboard.tsx 포팅. 완료율 도넛=`progress.self`(submitted/total), 4지표=`unsubmittedCount`·`appeals`·`progress.downward1`, 부서별 막대=`groupGrades[].achievementRate`, 추이 LineChart(recharts)=`monthlyTrend[].achievementRate`, 전사 달성률 바=`companyAchievement`. 권한(`role!=='employee'`)·로딩·에러·미접근 상태 유지. "인사평가 메인" 버튼→`/eval`.
> - **org:** OrgChart.tsx 포팅. chart/list/visibility 3탭. 조직도 트리는 `useOrgChart`의 `OrgChartNode`(group→division→team) 재귀 카드(인원수 뱃지·직속/총원). 목록=그룹·본부 통계행. 가시성=권한 정책 매트릭스(mock UI·역량점수 필드 제거). 기존 데이터 fetching·CRUD(노드 추가/이름변경/삭제·구성원 추가) 로직·모달 전부 유지, hr_admin만 editable.
> - **eval:** HRMain.tsx 포팅. 주차 캘린더(8열 그리드·단계 바·할일 상세) + 단계 범례 + 내 할 일 카드. 단계=기준설정/본인/1차 팀장/2차 본부장(다면 없음). 상태=`selfEval.status`·`myKpis` confirmed 여부·`downwardEvals` 미평가 수. 단계 클릭→실라우트(`/kpi`·`/eval/self`·`/eval/dept-head`·`/eval/result/[userId]`).
> - **recharts** `^2.15.4` 신규 의존성 추가·설치. 검증: `tsc --noEmit` — 3파일 에러 0(기존 `reports/page.tsx` 에러는 무관·선재).

> **[2026-06-04] Foundation 디자인 교체 (Toss DS, Agent A)** — `tailwind.config.ts`·`globals.css`·`AppShell.tsx`·`nav.ts` 4파일.
> - `tailwind.config.ts`: `colors.toss.*` 팔레트 추가(blue/grey/green/red/orange). 기존 grade/status/chart/pool/shadcn 토큰 유지.
> - `globals.css`: `:root` Toss 팔레트로 교체 — `--background #f9fafb` / `--card #fff` / `--primary #3182f6` / `--border #e5e8eb` / **`--radius: 0rem`(사각형)**. Pretendard 폰트 유지.
> - `AppShell.tsx`: 레퍼런스 Sidebar(216px·흰배경·로고 Zap·그룹 collapsible·아이콘 24x24 square·활성 좌측 2px 파랑보더·하단 사용자카드) + Header(52px·브레드크럼·검색버튼·알림벨·사용자카드) 포팅. 기존 로직(props 인터페이스·`visibleNav(role)`·`NotificationBell`·`onLogout`·`primaryAction`·모바일 Sheet 드로어) 전부 유지. 레이아웃을 sidebar|content flex 행으로 전환.
> - `nav.ts`: 역량관리 그룹(`competency-admin`/`competency`) 완전 제거. `NavItem`에 `group`(인사평가·실적관리·모니터링·기타)·`tone`(core/eval/admin/alert) 추가, `NAV_GROUP_ORDER` 신설. `kpi-review` 항목에 미확인 알림수 뱃지. (competency 페이지/훅 파일은 잔존하나 네비 미연결.)
> - 검증: `tsc --noEmit` 통과(에러 0).

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

---

## M3 (2026-06-04) — 회의 녹취록 신규 기능 (Items 4-10)

> 기준: `_workspace/00_input/requirements-m3.md`. **백엔드 M3 API는 구현 중** — 훅/타입은 requirements 명세를 선반영하고, 계약 `M3 델타` 절(contract.md 끝)에 동일 shape를 문서화했다(백엔드 구현 시 1:1 일치 필요). 봉투·camelCase·재계산 금지 규율 동일.

### 신규 라우트 (4)
- `/admin/monthly-performance` (hr_admin·division_head 입력 / team_lead 조회) — Item 4. 그룹/본부·카테고리(revenue/construction/orders) 선택 → 1~12월 목표/실적 입력 테이블 + 누적 요약(달성률 게이지·현재 등급). division_head는 본인 본부만 후보(프론트 UX 가드, 행수준은 백엔드).
- `/admin/competency` (hr_admin) — Item 6. 역량평가 문항 CRUD(추가/수정/삭제 모달·순서 번호 수동·활성 토글).
- `/eval/competency` (전 역할) — Item 6. "연봉 미반영" info 배너 + 활성 질문별 GradeRadio(S/A/B/C/D)+코멘트 textarea + 우하단 일괄 제출(usePrimaryAction).

### 확장 라우트 (5)
- `/admin/settings`(일정 탭) — Item 5. ScheduleEditor에 "평가 기간 관리(잠금/열기)" 카드 추가: 단계별 시작/마감일 + 잠금 토글(pill 버튼·Lock/LockOpen). 저장 시 `isLocked`·`startDate` 포함 upsert.
- `(main)/layout.tsx` — Item 5. `PeriodBanner`(현재 phase+마감일+D-day, 잠금 시 warning). `current-phase` 미배포 시 조용히 미표시.
- `/kpi` — Item 5+10. ① 잠금 가드: `useCurrentPhase` isLocked 시 저장/제출 토스트 "현재 KPI 작성 기간이 아닙니다" + 제출 비활성 + warning 배너. ② 소속 그룹 매출 목표 읽기전용 카드(`useMyGroupPerformance` — 목표/달성/달성률 게이지/등급). ③ revenue/construction/orders 카테고리 비직책자(employee) Select 옵션 disabled("직책자만 설정 가능").
- `/dashboard` — Item 7. groupGrades 카드(그룹별 등급+달성률 게이지), teamGoal 카드, monthlyTrend(SVG 라인). 모두 응답 옵셔널 필드 존재 시에만 렌더(역할별 가시성은 백엔드가 응답에 담는 필드로 제어).
- `/admin/compensation` — Item 8+9. 개인 연봉 시뮬 대상자 선택→`SalarySimCard`(현재연봉→등급→인상률→예상연봉 + 등급별 비교표), 팀 연봉 영향 테이블, 전체 결과 Excel 버튼.
- `/eval/result/[userId]` — Item 9. `ResultExportButton`(PDF/Excel 드롭다운). PDF=인증 fetch→blob→새 탭(인쇄), Excel=blob 다운로드.

### 신규 컴포넌트 (5)
- `AchievementGauge` — 누적 달성률 가로 게이지(≥100 success/≥90 primary/else warning).
- `MonthlyTrendChart` — 월별 달성률 SVG 라인(100% 기준선·차트 라이브러리 없이).
- `PeriodBanner` — 임직원 상단 현재 기간 배너(잠금/D-day).
- `SalarySimCard` — 개인 연봉 시뮬 + 등급별 예상 연봉 비교표.
- `ResultExportButton` — 결과 PDF/Excel 드롭다운(ui/dropdown-menu).

### 신규 훅 (3) / 확장 (3)
- 신규: `useMonthlyPerformance`(+summary·commands), `useCompetency`(questions/responses·commands), `useCurrentPhase`.
- 확장: `useGroupPerformance`(+`useMyGroupPerformance`), `useCompensations`(+`useCompensationSimulation`·`useTeamCompensationSimulation`·`setSalary`), `useDashboard`(타입 확장만 — 호출부 무변경).

### 타입 (계약 M3 델타 1:1, camelCase)
- 신규: `MonthlyPerformance`/`Summary`/`Input`, `CurrentPhase`, `CompetencyQuestion`(+Input/Patch), `CompetencyResponse`(+Input), `GroupGrade`/`TeamGoal`/`MonthlyTrendPoint`, `CompensationSimulation`/`GradeRow`, `MyGroupPerformance`.
- 확장: `CycleSchedule`(+`isLocked?`·`startDate?` — 백엔드 미배포 시 `?? false`/`?? ''` 폴백), `ScheduleItemInput`(+동일), `DashboardSummary`=`DashboardSummaryBase & DashboardM3Extension`(M3 필드 전부 옵셔널).
- `lib/ui.ts`: `fmtAmount`(억/만 단위)·`fmtSalary`·`monthLabel` 추가. `lib/nav.ts`: monthly-performance·competency(admin/employee) 항목+activeKey. `lib/excel.ts`: `fetchBlob`(인증 blob — PDF 새탭용).

### 경계면 규율 (M3 유지)
- 봉투 unwrap api.ts 한 곳. 단건 `apiGet`/목록 `apiGetList`. 익스포트(Item 9 PDF/Excel)만 봉투 없는 바이너리 → `fetchBlob`/`downloadExcel` blob 처리.
- **재계산 금지:** 누적 달성률·현재 등급·예상 연봉은 모두 백엔드 산정 표시. 월별 입력 테이블의 "월 달성률"·SalarySimCard 등급별 비교행만 입력값 미리보기(저장 전 안내용 — 백엔드 확정값 아님 명시).
- 잠금: 프론트 UX 가드(토스트·비활성)는 안내, 강제는 백엔드 423 LOCKED.
- 라우트: 신규 4개 + 사이드바 hrefs 1:1. route group `(main)` URL 제거.

### 빌드
`tsc --noEmit` EXIT 0. `npm run build` 통과 — **22 라우트**(static 21 + dynamic 1[result/[userId]]). 신규 4 라우트 정상 생성.

### 협상 필요 (backend-engineer) — 계약 M3 델타 절 참조
1. **백엔드 M3 엔드포인트 미구현** — 위 훅이 호출하는 경로(`/monthly-performance*`·`/cycles/:id/current-phase`·`/competency-*`·`/compensations/simulation*`·`/users/:id/salary`·`/group-performance/my-group`·`/results/:userId/export`)와 응답 shape를 계약 M3 델타와 정확히 맞춰 구현 필요. 미배포 동안 프론트는 404/네트워크 에러를 빈 상태로 흡수(배너·섹션 미표시).
2. **CycleSchedule.isLocked·startDate** — 기존 `PATCH /cycles/:id/schedules` 응답/요청에 추가 필요. 없으면 잠금 토글 저장이 무효.
3. **User.currentSalary** — Item 8 시뮬 입력. `PATCH /users/:id/salary` + User 응답 필드.
4. **Dashboard 확장 필드(groupGrades/teamGoal/monthlyTrend)** — 역할별 가시성을 응답 필드 포함 여부로 제어(팀장=teamGoal, 관리자/본부장=groupGrades). 프론트는 존재 시에만 렌더.
5. **KPI category RBAC** — `POST /kpis`에서 revenue/construction/orders를 employee가 작성 시 403. 프론트 비활성은 UX 가드.

---

## M3 Items1-3 + 조직도 (frontend-engineer, 2026-06-04)

> 범위: 온보딩/초기비번(Item1)·RBAC 가시성 오버라이드(Item2)·KPI 카테고리 직급제한(Item3)·조직도(W1~W5). 계약 SSOT = `contract.md` "## M3 델타 (Items 1-3 + 조직도)". 타 스트림(Items 4-10) 화면 미수정. **`npm run build` 통과·24 라우트.**

### 신규 라우트 (2)
| 라우트 | 파일 | 화면 | 접근 |
|--------|------|------|------|
| `/org` | `(main)/org/page.tsx` | W1 조직도 — 좌 트리 + 우 인물 카드/리스트, 검색·재직필터·뷰토글, hr_admin CRUD·소속이동·role/scope 편집, 헤더 명부 일괄 등록 모달 | 전 역할 열람·hr_admin 편집 |
| `/onboarding/password` | `app/onboarding/password/page.tsx` | W3 초기 비번 강제 변경 — 셸 없는 풀스크린 게이트(라우트 그룹 밖) | mustChangePassword=true |

### 변경 라우트
- `(main)/admin/settings/page.tsx` — 탭 2개 추가: **KPI 권한**(W4 CategoryPolicyMatrix), **명부 온보딩**(W2 RosterImportPanel). 두 탭은 주기 없이도 동작(주기 의존 탭만 cycle 가드).
- `(main)/kpi/page.tsx` — W5/Item3: `GET /kpi-category-policy/allowed?userId=` 로 차단 카테고리 비활성(Item10 role 제한과 병합) + 422 `CATEGORY_NOT_ALLOWED`·423 `PERIOD_LOCKED` 방어 토스트.
- `(main)/layout.tsx` · `(auth)/login/page.tsx` — `mustChangePassword=true` 시 `/onboarding/password` 로 강제(셸 미렌더로 403 FORCE_PASSWORD_CHANGE 호출 차단).
- `lib/nav.ts` · `AppShell.tsx` — `org` nav 항목(전 역할)·`Network` 아이콘·`#ECEBFB/#4B43BD` 틴트·`activeKeyForPath`.

### 신규 컴포넌트 (9)
`OrgTree`(+OrgTreeNode, role=tree·검색 자동펼침·hr_admin ⋯ 메뉴)·`OrgPersonCard`·`OrgViewToggle`·`PersonEditModal`(W5 scope 통합)·`ScopeSelect`·`RosterImportPanel`(FileDropzone 래퍼)·`PasswordChangeGate`·`PasswordPolicyChecklist`·`CategoryPolicyMatrix`. 전부 DESIGN.md 기존 토큰만(신규 색/radius 0).

### 신규 훅·데이터층
- `hooks/useOrgChart.ts`(`GET /org-chart`, 단건 봉투=회사 루트 노드)·`useUsers` 확장(`userCommands.create/update/deactivate`, includeInactive·pageSize)·`useKpiCategoryPolicy`(+`useKpiCategoryAllowed`·`kpiCategoryPolicyCommands.update`).
- `useAuth` — `changePassword`(POST /auth/change-password → **새 토큰 교체**)·`logout`(POST /auth/logout 베스트에포트).
- `lib/types.ts` — Position 10값 확장·`VisibilityScope`·`OrgChartNode`·`OrgPerson`·`KpiCategoryPolicyEntry`·`KpiCategoryAllowed`·`Create/UpdateUserRequest`·`ChangePassword*`. User에 `mustChangePassword·visibilityScope·isActive`(+currentSalary?) 추가.
- `lib/ui.ts` — `positionLabel` 10값 + `POSITION_LABEL`·`SCOPE_LABEL`·`SCOPE_DESC` 단일 정의.
- `lib/org.ts` — 트리 평탄화·deptPath·하위 deptId 집합·직급→자동 role/scope(override 판정용).

### 계약 대비 결정·협상 노트
1. **`GET /org-chart` shape** — 계약(SSOT)은 `{ data: OrgChartNode(가상 회사 루트 id:'company'), meta }`(단건). 요구문서의 `{companyLabel,totalCount,nodes}` 가 아닌 **단일 루트 노드**로 구현. 루트 `name`=회사 라벨·`totalCount`=117 사용. (`lib/types.ts` `OrgChartNode`)
2. **`GET /users` = 표준 User[]** — 계약 §3/Item2 는 `/users` 가 `User[]` 반환(OrgPerson[] 아님). 디자인 `OrgPerson`(deptPath·roleIsOverride·phone·avatarUrl)은 **프론트 합성**: deptPath=org 트리, override=직급 자동기본과 비교, **phone/avatarUrl 은 계약에 없어 항상 null/미등록 표시**(추측 필드 0). (`app/(main)/org/page.tsx` `userToPerson`)
3. **조직 노드 CRUD(노드 추가/이름변경/이동/삭제)** — 계약에 엔드포인트 없음(요구 "여력 시"). 트리 ⋯ 메뉴는 두되 **죽은 호출 대신 안내 토스트**("명부 일괄 등록으로 반영")로 명시 처리. 백엔드 노드 CRUD 계약 확정 시 연결.
4. **roster 임포트 = 단일 호출 멱등 업서트** — 계약 `POST /excel/import/roster` 는 dry-run/commit 분리 없음. RosterImportPanel 은 `showCommit=false`(업로드=반영). ImportResult `{validCount,errorCount,imported,errors,ok}` 표시.
5. **`PATCH /kpi-category-policy` 응답** — 목록 봉투(`{data:[],meta}`)지만 `apiPatch` 가 `data`(배열)만 반환 → 전체 매트릭스로 정상 사용(meta 불요).

### QA 경계면 포인트
- **봉투 unwrap**: org-chart=단건(`apiGet`), users=목록(`apiGetList`), kpi-category-policy GET=목록·allowed=단건·PATCH=배열. 전부 unwrap 경유(배열 가정 0).
- **camelCase 1:1**: User 신규 필드(mustChangePassword/visibilityScope/isActive)·OrgChartNode(directCount/totalCount/parentId)·KpiCategoryPolicyEntry(allowed) 계약과 일치. 추측 캐스팅 0.
- **라우트 정합**: `/org`·`/onboarding/password` 실제 `app/` 경로 존재. route group `(main)` URL 제거 확인. `/onboarding/password` 는 그룹 밖(셸 미상속) 의도.
- **403 FORCE_PASSWORD_CHANGE / mustChangePassword 게이트**: 셸 진입 전 차단(layout 가드 + 미렌더). 탈출구=로그아웃. change-password 성공 시 새 토큰 교체 후 랜딩.
- **422 CATEGORY_NOT_ALLOWED / 423 PERIOD_LOCKED**: kpi 작성/제출 토스트 방어. 프론트 카테고리 비활성은 UX(최종 강제는 백엔드).
- **검증 의존**: 백엔드 Items1-3 엔드포인트(org-chart·users CRUD·change-password·logout·excel/import/roster·excel/template/roster·kpi-category-policy[/allowed])가 계약 shape대로 배포돼야 동작. 미배포 시 ErrorState/EmptyState 로 흡수.

## 조직도 노드 편집 활성화 + 카드 UI 정리 (2026-06-04)

- **OrgPersonCard 재작성** (`components/OrgPersonCard.tsx`): Apple 디자인 언어 적용. 연락처(phone) 행 제거(항상 미등록), 가로 레이아웃 유지·padding/gap 최적화, 카드 hover `shadow-md`, 권한 배지 compact(text-[11px], 수동=primary 강조), `deptPath` 마지막 2 세그먼트만 표시(`shortDeptPath`). 직급은 배지→인라인 텍스트로 위계 정리.
- **OrgNodeModal 신규** (`components/OrgNodeModal.tsx`): create/rename 모드. 타입 자동결정(부모 없음=group, group→division, division→team) 읽기전용 표시. 기존 Modal+TextField 사용. 열릴 때 입력 초기화·rename 프리필.
- **departmentCommands 추가** (`hooks/useDepartments.ts`): `create`/`rename`/`remove` — 계약 `POST/PATCH/DELETE /departments`(hr_admin 가드) 1:1. 봉투 unwrap, remove 는 `{id}` 반환·CONFLICT(구성원/하위 존재) throw 방어.
- **org/page.tsx**: "명부 일괄 등록" 버튼·Modal·RosterImportPanel·uploadExcel·import 상태 전부 제거. `handleNodeAction(action, node)` 실구현 — rename/addChild→OrgNodeModal, delete→inline 확인 Modal(deleteTarget). 팀 하위 추가는 차단(3단계). 노드 submit/삭제 후 `reloadChart()`. 삭제 노드가 선택중이면 selection 해제.
- **OrgTree.tsx**: 빈 상태 문구 "명부를 올려 시작해요"→"아래 버튼으로 추가해요".
- 검증: `apps/web` 전체 `tsc --noEmit` 0 에러. 제거 심볼 잔재 grep 0건.

## 내 평가표(my-eval) 화면 추가 (2026-06-05)

- **레퍼런스 정합**: 기준 디자인 파일(`Downloads/인사 평가 사이트 UIUX 디자인 (2)`)의 `MyEvaluation.tsx`+`EvalReport.tsx`("내 평가표" `my-evaluation`)를 프로젝트 도메인/데이터에 맞춰 이식. 레퍼런스의 수평평가·역량(KPI/역량 카드) 구성은 본 도메인(self+downward, byGroup 성과중심/협업·성장)으로 치환 — 시각 구조는 동일 유지.
- **nav**: `lib/nav.ts` 에 `{ key:'my-eval', label:'내 평가표', href:'/eval/my', group:'인사평가', tone:'core' }` 추가(전 역할 노출). `activeKeyForPath` 에 `/eval/my`→`my-eval` 매핑(`/eval` catch 앞). `AppShell` 아이콘 `FileCheck`. `permConfig.DEFAULT_NAV_VISIBILITY` 전 역할 `'my-eval':true`.
- **page** (`app/(main)/eval/my/page.tsx`): `useAuth().user.id`+`useCurrentCycle`+`useResultDetail(userId,cycleId)` 로 본인 결과 조회. 열람제한 배너·결과요약 3카드(종합/성과중심/협업·성장 등급·점수)·전사 상위%/평균·평가 프로세스(self→1차 팀장→2차 본부장, byType 점수 유무로 완료/대기)·상세 평가표 보기. 다운로드는 기존 `ResultExportButton`(PDF/Excel) 재사용. auth/cycle/result 로딩 가드, 403/404/빈상태 분기.
- **component** (`components/EvalReport.tsx`): 인쇄 가능한 상세 평가표 모달. 인물요약·평가자 플로우(본인→팀장→본부장)·섹션(종합 단계별 비교 + 성과중심 + 협업·성장 가로막대, 전사 평균 마커)·코멘트(팀장/본부장)·푸터. 등급색은 tailwind grade 토큰 hex 인라인(인쇄창 별도 document). 점수 0~100 척도(seed gradeScale 기준).
- **백엔드**: 신규 엔드포인트 불필요 — 기존 `GET /results/:userId?cycleId=`(`canViewUser` 본인 `current.id===targetUserId` 허용) + `/results/:userId/export` 그대로 연결.
- 검증: `apps/web` 전체 `tsc --noEmit` 0 에러.
