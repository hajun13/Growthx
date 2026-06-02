# GrowthX — 인사평가 솔루션

## 하네스: 인사평가 솔루션 풀스택 개발

**목표:** 인사평가(HR 성과평가) 솔루션 웹사이트를 와이어프레임부터 Docker 배포까지 5인 에이전트 팀(디자인·프론트·백엔드·QA·릴리스)으로 조율하여 개발한다.

**트리거:** 인사평가/성과평가/평가 시스템·솔루션 관련 개발 작업(화면 설계, 프론트엔드, 백엔드 API, 통합 QA, 배포)이나 그 부분 재실행·수정·보완 요청 시 `eval-harness-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**제품명:** **에너지엑스 인사 평가** (이전 "GrowthX" 브랜드 폐기 — UI/문서 표기는 모두 "에너지엑스 인사 평가").

**스택:** Next.js(App Router) 프론트 + **Apple 디자인 언어**(루트 `DESIGN.md`가 디자인 SSOT, `getdesign` 생성) 차용, **글꼴은 Pretendard 유지**(한글 최적화 — SF Pro/Inter 대체) + NestJS/Prisma/PostgreSQL 분리형 백엔드 + Docker 자체 호스팅. 모노레포(`apps/web`, `apps/api`). 등급·풀·인상률·가중치 등 수치 규칙은 **설정 가능(`RuleSet`)**, 에너지엑스 2026 값을 기본 seed.

> **디자인 권위 변경(2026-06-02):** TDS → **Apple 디자인 언어**(`DESIGN.md`)로 전환. 단일 액센트 Action Blue `#0066cc`, 잉크 `#1d1d1f`, 화이트/파치먼트(`#f5f5f7`) 표면, **pill 버튼**, 그림자 최소(데이터 앱이라 등급·상태 시맨틱 색은 기능상 유지), 라운드 8/11/18/pill, 본문 17px·디스플레이 음수 자간. 글꼴만 Pretendard. `tds-design-language.md`는 폐기(historical).

**핵심 도메인(권위 자료 PPT·xlsx 확정):** 평가 = **순수 KPI/성과 중심**(역량평가 없음). 평가 유형 = **본인평가(self) + 부서장 평가(downward 1차 팀장·2차 본부장)** — 수평/상향/다면평가 **없음**. 조직 = **그룹→본부→팀→개인 4단계**(그룹 최상위). 등급 풀 단위 = **그룹**. KPI 2그룹 = 성과중심(매출액·공정액·수주&업무수행 70/80%) + 협업·성장(협업성과·자기개발 20/30%). 등급은 측정방식별(금액 달성률/건수).

**단일 진실 공급원** (`.claude/skills/eval-harness-orchestrator/references/`):
- `domain-model.md` — 엔티티·역할(4)·KPI 분류·평가 유형(self/downward)·조직(그룹→본부→팀)·상태 머신·명명
- `business-rules.md` — 등급·측정방식별 달성률·그룹 풀·KPI 가중치·인상률·캐스케이드·타임라인·RBAC (설정 가능, 2026 seed)
- `api-contract-convention.md` — 응답 봉투·경로·인증
- `reference-ui-screens.md` — 레퍼런스 솔루션 화면 인벤토리·컴포넌트 (참고용)
- `tds-design-language.md` — TDS 디자인 언어 차용·토큰·라이선스

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
