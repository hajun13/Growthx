# 인사평가 솔루션 — M2 스코프 (신규 기능 + 미완 기능 실동작화 + RuleSet 전 구간 연결)

> 리더 확정 · 2026-06-02 · 입력 기준 SSOT: `.claude/skills/eval-harness-orchestrator/references/{domain-model,business-rules,api-contract-convention}.md`, 디자인 SSOT `DESIGN.md`(Apple/shadcn, Pretendard)
> 전제: M1 + "M2 확장" 골격은 이미 커밋(`1b507cf`)됨. 본 문서는 그 위에 **신규 기능 4종 + 미완 기능 완성 + RuleSet 완전 연결**을 얹는다. 경계면 규율(응답 봉투·camelCase·계약우선)·전역 RBAC 유지.

## 사용자 지시 원문
1. 신규 기능: **엑셀 임포트/익스포트 · 평가 알림 이메일/인앱 · HR 대시보드 위젯 · 감사 로그**
2. **RuleSet 연결 안 된 부분 다 연결** 되게.
3. **지금 부족한(미완/placeholder) 기능들 다 동작**하게.
4. **"그냥 이 시스템이 모두 완벽하게 돌아갈 수 있게"** — 모든 화면·엔드포인트가 데모 시드 데이터로 end-to-end 실동작. placeholder·죽은 버튼·미연결 훅 0. Docker 기동 후 전 라우트 200, 핵심 플로우(로그인→KPI 작성·승인→본인평가→부서장평가→결과→이의제기→보상→대시보드→설정·양식·일정→알림→감사로그→엑셀) 실제 동작 검증.

---

## A. RuleSet 완전 연결 (최우선 — 기존 결함 해소)

**현 상태:** `admin/settings`가 `raiseRates`·`weightPolicy.qualitativeMaxPercent`만 편집. `gradeScale`·`gradingScales`(측정방식별 달성률표)·`poolRatios`(그룹 풀 tier별 상한)는 읽기전용. 활성 주기에 RuleSet 미연결 시 placeholder만 표시.

**요구:**
- **BE:** 주기 생성 시 기본 RuleSet(2026 seed 값) 자동 연결 보장. `cycleId` 없는 글로벌 RuleSet → 주기 연결 RuleSet 복제/연결 경로 제공. `loadRuleSetForCycle` 폴백(주기 RuleSet 없으면 글로벌 default 사용)으로 404 방지.
- **BE:** `PATCH /rule-sets/:id`가 `gradeScale`·`gradingScales`·`poolRatios`·`raiseRates`·`weightPolicy` **전 필드** 편집 수용 + 검증(가중치 합·정성 상한·등급 구간 단조성·풀 비율 합). 변경 시 감사 로그 기록(아래 D).
- **FE:** `admin/settings` 규칙 탭에서 **5개 필드 전부 편집** — 등급 척도(S~D 구간), 측정방식별 달성률표(amount/rate 밴드·count 임계 안내), 풀 비율(tier×등급 매트릭스), 인상률, 가중치 정책. 저장 후 재산정 영향 안내.
- **수용 기준:** 설정에서 값 변경 → 해당 주기의 점수·등급·풀·인상률 산정이 즉시 그 값을 사용(하드코딩 0). `scoring.service`가 전 구간 RuleSet 경유 재확인.

## B. 미완 기능 완성 (placeholder 제거)

### B-1. KPI 양식 편집기 (`admin/settings` → KPI 양식 탭)
- **BE:** `kpi-templates` 모듈 CRUD 완성 — jobLevel별(division_head·team_lead·senior_plus·senior_minus) 양식 항목(category·group·defaultMeasureType·defaultWeight) 목록/생성/수정/삭제. 가중치 합·정성 상한 검증.
- **FE:** jobLevel 탭 → 항목 테이블(추가·편집·삭제·가중치 합계 실시간). placeholder 문구 제거.

### B-2. 일정·대상자·알림 설정 (`admin/settings` → 일정 탭)
- **BE:** 주기 단계별 일정(평가준비·본인평가·1차·2차·결과) 마감일 + 알림 트리거(D-7/D-3/D-1) 설정 저장. 대상자(평가 대상 사용자/부서) 지정.
- **FE:** 단계별 마감일 편집, 대상자 선택, 알림 on/off·리드타임 설정. placeholder 문구 제거.

### B-3. 이연된 [수용M2] 백로그 4건 (QA qa-report-m2 §4 + 알려진 한계)
- **B-3a 평가자 종합등급 직접 부여:** `Evaluation`에 `overallGrade?`(평가자 수동 종합등급, 선택) 필드 + `PATCH /evaluations/:id` 수용. 부서장평가 화면에서 자동 산정값 위에 평가자가 종합등급 오버라이드 가능(사유 코멘트 필수).
- **B-3b GradePool headcount 절대값:** `grade-pools` 응답에 `headcount`(그룹 정원) + 등급별 절대 상한(`caps:Record<Grade,number>`) 동봉. FE 추정 계산 제거, 백엔드 값 표시.
- **B-3c userName/departmentName 비정규화:** 평가 대상·결과·이의제기 응답에 `userName`·`departmentName` 동봉. FE `id.slice(0,8)` 제거 → 실제 이름 표시.
- **B-3d EvaluationResult group별 등급:** `EvaluationResult`에 `byGroup`(performance_core·collaboration_growth 각 점수·등급) 추가. 결과 요약 3박스 = 종합/성과중심/협업·성장 라벨 정확 재현.

## C. 신규 기능 4종

### C-1. 엑셀 임포트/익스포트
- **BE:** `exceljs`(또는 동등) 도입. 임포트: KPI 양식·조직/대상자·KPI 실적 일괄 업로드(.xlsx, 검증·오류 행 리포트). 익스포트: 평가결과·등급분포·보상 시뮬레이션 다운로드(.xlsx). 권한 hr_admin. multipart 업로드 + 스트림 다운로드.
- **FE:** 업로드 드롭존(검증 결과·오류 행 표시) + 다운로드 버튼(리포트/결과 화면). xlsx 양식 다운로드 제공.
- **참고:** xlsx 컬럼 명세는 `인사 평가 시스템 참고용/` KPI 양식 xlsx 구조 준용.

### C-2. 평가 알림 (이메일 + 인앱)
- **BE:** `notifications` 모듈 확장 — 실제 발송 채널. 이메일은 **nodemailer + SMTP**(env로 설정, 미설정 시 콘솔/DB로 폴백 = 개발모드). 인앱 알림(읽음/안읽음, 목록). 트리거: 일정 D-7/D-3/D-1, 본인평가 마감 임박, KPI 반려, 결과 확정, 이의제기 답변. 발송 이력 저장.
- **FE:** 상단 알림 벨(미읽음 뱃지·드롭다운 목록·읽음 처리) + 알림 센터 페이지(`/notifications`). 설정 탭의 알림 on/off 연동.
- **주의:** SMTP 시크릿은 `.env`/`.env.example`에 키만, 미설정 시 안전 폴백.

### C-3. HR 대시보드 위젯 (`/dashboard`, hr_admin)
- **BE:** `GET /dashboard/summary` — 진행률(주기 단계별 제출 현황), 등급 분포(그룹/전사), 미제출자 수, 이의제기 현황, 보상 평균 인상률을 한 응답으로 집계(`{data}` 봉투, 위젯별 필드).
- **FE:** 위젯 그리드 — 진행률 도넛/바, 등급 분포 차트(DistributionBarChart 재사용), 미제출 알림 카드, 이의제기 현황, 전사 평균 인상률. hr_admin 진입 시 기본 랜딩(또는 nav 추가).

### C-4. 감사 로그 (Audit Log)
- **BE:** 신규 `AuditLog` 모델(actorId·action·entityType·entityId·before/after JSON·createdAt·ip?). 민감 변경 시 기록 — 등급 변경/오버라이드·평가 제출·KPI 승인/반려·풀 조정·RuleSet 변경·설정 변경·이의제기 결정. NestJS 인터셉터 또는 서비스 단 명시 기록. `GET /audit-logs`(hr_admin, 필터: actor·action·entity·기간, 페이지네이션).
- **FE:** `/admin/audit`(hr_admin) — 필터 + 타임라인/테이블, before/after diff 보기.

---

## D. 비기능·경계면 규율 (유지)
- 응답 봉투 `{data}`/`{data,meta}`/`{error}`, camelCase, 계약(`02_contract/contract.md`) 우선 — 신규 엔드포인트 전부 계약에 추가 후 구현.
- 전역 RBAC(JwtAuthGuard→RolesGuard) 유지. 신규 변경 엔드포인트 `@Roles()` + 서비스 행수준 소유권.
- 디자인 SSOT `DESIGN.md`(shadcn/ui new-york·neutral, Pretendard, 라이트 고정) 준수. 신규 화면도 기존 공용 컴포넌트 재사용.
- Prisma 스키마 변경 → entrypoint `db push` 폴백 유지(마이그레이션 디렉터리 없음). seed에 신규 모델·기본 RuleSet 주기연결·데모 알림/감사 데이터 보강.
- Node v24 설치됨 → **Docker 런타임 end-to-end 검증 필수**(빌드·기동·스모크: 신규 엔드포인트 200/201, 화면 200, 알림/대시보드/감사/엑셀 동작 확인).

## E. 산출물 위치
- 계약: `_workspace/02_contract/contract.md`(M2 델타 추가)
- BE: `apps/api/`(모듈 추가: audit-logs, dashboard, 확장: notifications, rule-sets, kpi-templates, cycles, grade-pools, results, evaluations; lib: excel)
- FE: `apps/web/`(라우트 추가: /dashboard, /notifications, /admin/audit; 확장: admin/settings)
- 디자인: `_workspace/01_design/`(신규 화면 스펙 추가)
- QA: `_workspace/05_qa/qa-report-m2-features.md`
- 릴리스: `_workspace/06_release/RELEASE.md`(M2 갱신)
