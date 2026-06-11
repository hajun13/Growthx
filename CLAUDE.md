# GrowthX — 인사평가 솔루션

## 하네스: 인사평가 솔루션 풀스택 개발

**목표:** 인사평가(HR 성과평가) 솔루션 웹사이트를 와이어프레임부터 Docker 배포까지 5인 전문 에이전트(디자인·프론트·백엔드·QA·릴리스)로 개발한다. **기본 실행 = 필요한 에이전트만 띄우는 최소 범위 서브에이전트**(토큰·속도 절감), 5인 풀팀은 신규 대형 빌드에서만. 모델은 backend만 opus, 나머지 sonnet (상위 모델 일괄 상향 금지 — 속도는 병렬 팬아웃으로). 프론트 작업은 `nextjs-frontend` 스킬 필수.

**트리거:** 인사평가/성과평가/평가 시스템·솔루션 관련 개발 작업(화면 설계, 프론트엔드, 백엔드 API, 통합 QA, 배포)이나 그 부분 재실행·수정·보완 요청 시 `eval-harness-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**제품명:** **에너지엑스 인사 평가** (이전 "GrowthX" 브랜드 폐기 — UI/문서 표기는 모두 "에너지엑스 인사 평가").

**스택:** Next.js(App Router) 프론트 + **Kinetic Enterprise 디자인 시스템**(루트 `DESIGN.md`가 디자인 SSOT), **기본 글꼴 Pretendard**(한글 최적화) + NestJS/Prisma/PostgreSQL 분리형 백엔드 + Docker 자체 호스팅. 모노레포(`apps/web`, `apps/api`). 등급·풀·인상률·가중치 등 수치 규칙은 **설정 가능(`RuleSet`)**, 에너지엑스 2026 값을 기본 seed.

> **디자인 권위 변경(2026-06-11):** Toss → **Kinetic Enterprise**(`DESIGN.md`)로 전환. Primary Deep Purple `#3f2c80`(사이드바 `#564599`), Secondary Blue `#0054ca`(주요 액션·링크), Tertiary Teal(데이터 시각화·성공), 배경 `#f8f9fd`. **8px rounded** 카드·버튼(뱃지/검색바는 Pill), Soft Ambient Shadow(보라 틴트), 24px 카드 패딩. **기본 글꼴 Pretendard 유지**(한글 최적화 — 원본 스펙의 Manrope·Hanken Grotesk 대체, 위계는 크기·굵기 스케일로만). 도메인 시맨틱 색(등급 S~D)·데이터 밀도 보정은 `DESIGN.md`의 "프로젝트 적용 노트" 참조. Toss 디자인 언어(사각 모서리·#3182f6) 폐기. `tds-design-language.md` 폐기(historical, 스텁화).

**핵심 도메인(권위 자료 PPT·xlsx 확정):** 평가 = **KPI/성과 중심**(연봉·최종등급 산정은 실적만). **역량평가는 폐기 아님 — 참고용 백데이터로 존재**(연 1회 12월·10문항·S/A/B/C/D, 가중치 100점이나 **연봉·등급 미반영**, `CompetencyQuestion`/`CompetencyResponse`로 구현, 조회·연도비교 화면에 표시). 평가 유형 = **본인평가(self) + 부서장 평가(downward 1차 팀장·2차 본부장)** — 수평/상향/다면평가 **없음**. 조직 = **그룹→본부→팀→개인 4단계**(그룹 최상위). 등급 풀 단위 = **그룹**. KPI 2그룹 = 성과중심(매출액·공정액·수주&업무수행 70/80%) + 협업·성장(협업성과·자기개발 20/30%). 등급은 측정방식별(금액 달성률/건수).

**단일 진실 공급원** (`.claude/skills/eval-harness-orchestrator/references/`):
- `domain-model.md` — 엔티티·역할(4)·KPI 분류·평가 유형(self/downward)·조직(그룹→본부→팀)·상태 머신·명명
- `business-rules.md` — 등급·측정방식별 달성률·그룹 풀·KPI 가중치·인상률·캐스케이드·타임라인·RBAC (설정 가능, 2026 seed)
- `api-contract-convention.md` — 응답 봉투·경로·인증
- `reference-ui-screens.md` — 레퍼런스 솔루션 화면 인벤토리·컴포넌트 (참고용)
- 시각 언어 SSOT는 루트 `DESIGN.md`(Kinetic Enterprise). `tds-design-language.md`는 폐기 스텁(historical)

**권위 자료(따라야 할 기준):** `인사 평가 시스템 참고용/2026년도 임직원 KPI 및 평가 운영 계획_VER3 1.pptx`(운영계획 PPT)가 최우선. KPI 양식 xlsx가 평가기준 보완. **레퍼런스 솔루션 이미지는 참고용(advisory)** — 화면 아이디어 참고만, 규칙·도메인·평가차원은 PPT/xlsx 우선(역량/다면평가는 레퍼런스에서 잘못 끌어왔던 것 → 폐기). 직책 체계: 대표이사·본부장·팀장·책임·선임·프로.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-02 | 초기 구성 (에이전트 5 + 스킬 6 + 도메인/계약 레퍼런스) | 전체 | 인사평가 풀스택 개발 하네스 신규 구축 |
| 2026-06-02 | 참고 자료 반영 — 도메인 모델 전면 재작성(에너지엑스 2026 KPI), business-rules·reference-ui-screens·tds-design-language 레퍼런스 추가, 5개 스킬·4개 에이전트 갱신 | 레퍼런스 4종, 스킬·에이전트 | PPT/엑셀/요구사항/레퍼런스 UI/TDS 자료로 하네스 확고화 |
| 2026-06-02 | 권위 자료 = PPT 운영계획으로 명시(레퍼런스 이미지는 참고용 격하), 직책 체계 정정(대표이사·본부장·팀장·책임·선임·프로), 레퍼런스 화면 S9·S10 + 역량 레이더/산점도 컴포넌트 인벤토리 추가 | domain-model, business-rules, reference-ui-screens, orchestrator, 디자인 스킬·에이전트 | 사용자 피드백: PPT 우선·실제 직책 체계 반영 |
| 2026-06-02 | 1차 빌드(M1) 실행 — 모노레포 apps/api(NestJS·Prisma 20엔티티·규칙엔진)·apps/web(Next.js)·Docker. QA 조건부 통과 후 결함 수정 | apps/*, _workspace/* | "실제 개발 착수" |
| 2026-06-02 | **도메인 대정정(PPT·xlsx 재확인)** — ①역량평가 폐기(권위 자료에 없음, 레퍼런스서 오인) ②다면평가(수평/상향) 폐기 → self+downward(1·2차)만 ③조직 그룹→본부→팀→개인 4단계(그룹 최상위) ④등급 풀=그룹 단위 ⑤KPI 2그룹·측정방식별 등급(xlsx) | domain-model, business-rules, 전 스킬·에이전트, 와이어프레임, apps/* 재빌드 | 사용자 피드백: 다면평가 없음·그룹 최상위·xlsx 기준 평가기준 |
| 2026-06-02 | 빌드·배포 **실검증 완료**(Node 설치) — TS 빌드 에러 7건·Prisma OpenSSL binaryTargets·entrypoint dist 경로·seed ts-node·web healthcheck IPv6·API 프록시(API_PROXY_TARGET) 등 결함 7건 수정. Docker 스택 healthy·데모 로그인 통과. GitHub(hajun13/Growthx) 푸시 | apps/*, docker-compose, Dockerfile, .env | 사용자: "실제 개발 착수·빌드 검증·깃 업로드" |
| 2026-06-02 | **디자인 전면 재스키 (TDS→Apple)** + 브랜드 변경(GrowthX→에너지엑스 인사 평가) + UX 사용자 친화 개선. `DESIGN.md`(Apple, getdesign) 디자인 SSOT화, 글꼴 Pretendard 유지. apps/web 토큰(tailwind·globals)·공용 컴포넌트·셸/네비·로그인 재작업 | DESIGN.md, CLAUDE.md, apps/web | 사용자 피드백: "이 디자인 패턴(Apple)·Pretendard·UX 개선·브랜드 에너지엑스 인사 평가" |
| 2026-06-05 | **연도 누적(YoY) 비교 시스템** — 작년(2025) KPI 결과 DB 적재 + 연도 비교. ①스키마 보강(User.legalEntity·employmentStatus·resignedAt, EvaluationResult 조직 스냅샷) ②2025 closed 사이클·전용 RuleSet ③과거결과 임포트(평가자정리 파서·이름매칭 재직/퇴사/검토큐, 88행 적재 검증 S3·A48·B25·C8·D4 원본 일치) ④비교 API(/results/compare·/distribution) ⑤화면 `/reports/yoy`(개인 타임라인·조직 등급분포·규칙차이 배너·법인필터) ⑥QA(byType 두 shape live/import 정합). **역량평가 정정: 폐기 아님 → 참고용(연봉 미반영)** | schema.prisma, excel/results 모듈, apps/web `/reports/yoy`, CLAUDE.md | 사용자: "작년 결과 DB 적재·연도 누적 비교·미래환경플랜·퇴사자 처리" |
| 2026-06-08 | **하네스 효율화 (속도·토큰·프론트 스킬 강제)** — ①기본 실행을 5인 풀팀→**최소 범위 서브에이전트**로 전환(풀팀은 신규 대형 빌드 전용), `SendMessage` 조율 오버헤드 제거 ②**모델 차등**: backend만 opus(점수·규칙·계약), 나머지(designer·frontend·qa·release) sonnet ③**frontend-engineer는 `nextjs-frontend` 스킬 필수 선호출**(우회 구멍 "또는 그 절차를 따른다" 제거) ④각 에이전트 필요한 레퍼런스만 Read(컨텍스트 절약) | orchestrator SKILL.md, agents/* 4종, CLAUDE.md | 사용자 피드백: "시간 너무 오래 걸림·토큰 과다·프론트는 무조건 nextjs-frontend 스킬" |
| 2026-06-08 | **중간 점검 화면 재구성 (루틴 가시화·디자인 정렬·아이콘)** — 백엔드/계약 불변, 프론트만(designer→frontend→qa 서브에이전트). ①`MidtermStepper` 신규 — 역할별 단계(구성원 5: KPI확인→자가점검→피드백확인→보완조치→재조정 / 부서장 4: 진척검토→확인·피드백→보완조치등록→재조정검토)를 기존 데이터(MidtermReview·ActionItem·RebaselineRequest)로 도출, 페이지 상단 고정 — "점검→평가→검토→피드백→재조정 루틴" 가시화 ②다른 평가 페이지(eval/self·kpi)와 디자인 통일(그룹 섹션 색 #1B64DA/#029359·상태 배지·카드·PageHeader) ③`NAV_ICONS.midterm = Milestone` 누락 아이콘 추가 ④"지금 할 일" CTA·진행 표시 UX 개선. QA PASS(typecheck·build 통과, 회귀 0) | apps/web(MidtermStepper·AppShell·MidtermProgressTable·Card·eval/midterm/*), _workspace/01·04·05 | 사용자 피드백: "계획한 루틴이 안 보임·디자인 불일치·사이드바 아이콘 없음" |
| 2026-06-09 | **속도 우선 모드(옵트인) 규칙 추가** — 기본은 토큰 절약, 사용자가 "빠르게/속도 우선/병렬로" 명시 시 전환. ①병렬 팬아웃(의존성 없는 에이전트 한 메시지 동시 호출, 배리어 금지, 화면별 개별 병렬) ②컨텍스트 선적재(레퍼런스·산출물 발췌 인라인으로 Read 왕복 제거) ③중복/투기 실행(재시도 잦은 구간만 N변형 생성→판정) ④모델 상향으로 재작업 제거. 효과·구조변경 비용 순 적용, 기본은 ①②만 | orchestrator SKILL.md, CLAUDE.md | 사용자 피드백: "토큰 더 쓰더라도 속도 높이는 방법을 규칙에 넣자" |
| 2026-06-11 | **디자인 전면 재스킨 준비 — 하네스 디자인 권위 교체 (Toss→Kinetic Enterprise)** — ①루트 `DESIGN.md`를 Kinetic Enterprise 스펙으로 교체(퍼플/블루/틸 팔레트, 기본 글꼴 Pretendard[사용자 확정 — 원본 Manrope·Hanken Grotesk 대체], 8px rounded, 보라 틴트 그림자, 퍼플 사이드바) + 프로젝트 적용 노트(글꼴·등급 S~D 색 파생·데이터 밀도 보정·RBAC/hooks 유지) ②하네스 전반의 Toss/TDS 참조 갱신(orchestrator·wireframe-to-design·nextjs-frontend 스킬, product-designer·frontend-engineer 에이전트, reference-ui-screens.md) ③드리프트 해소: 06-04 폐기 선언된 `tds-design-language.md`를 실제 스텁화하고 잔존 참조 4곳 제거 — 시각 언어 SSOT를 루트 DESIGN.md로 단일화. **apps/web 코드 재스킨은 아직 미실행(다음 단계)** | DESIGN.md, CLAUDE.md, orchestrator SKILL.md, skills/wireframe-to-design·nextjs-frontend, agents/product-designer·frontend-engineer, references/tds-design-language·reference-ui-screens | 사용자: "프론트 싹 갈아엎기 — 하네스부터, DESIGN.md를 이 파일(Kinetic Enterprise)로 교체" |
| 2026-06-11 | **모델 정책 상향 → 당일 철회(원복)** — backend fable·대형 패스 opus 상향을 시도했으나 컨텍스트·토큰 소비 과다로 같은 날 원복(backend opus, 나머지 sonnet). 교훈: **속도·품질이 필요하면 모델 일괄 상향이 아니라 병렬 팬아웃(속도 우선 모드 ①)을 먼저 적용** | orchestrator SKILL.md, agents/backend-engineer.md, CLAUDE.md | 사용자: "하네스 원래대로 — 컨텍스트·토큰 너무 먹음, 병렬 팬아웃으로" |
