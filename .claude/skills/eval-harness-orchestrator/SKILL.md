---
name: eval-harness-orchestrator
description: "인사평가(HR 성과평가) 솔루션 풀스택 웹사이트를 디자인→프론트엔드(Next.js)→백엔드(분리형 API)→QA→Docker 배포까지 에이전트 팀으로 조율하여 개발하는 오케스트레이터. 인사평가/성과평가/평가 시스템/평가 솔루션/HR 플랫폼/다면평가/360 평가 웹사이트·앱·기능 개발 요청 시 반드시 이 스킬을 사용. 와이어프레임 제작, 화면 설계, API 구현, 통합 QA, 배포 요청도 포함. 후속 작업: 평가 솔루션 결과 수정, 화면/API/배포 부분 재실행, 업데이트, 보완, 다시 실행, 기능 추가, 이전 결과 개선, '디자인만 다시', '백엔드만 수정', '배포만' 같은 부분 요청 시에도 반드시 이 스킬을 사용."
---

# 인사평가 솔루션 개발 오케스트레이터

인사평가 솔루션 풀스택 웹사이트를 **와이어프레임부터 Docker 배포까지** 5인 에이전트 팀으로 조율하여 개발하는 통합 스킬.

## 실행 모드: 작업 규모로 분기 (기본 = 최소 범위 서브에이전트)

**이 레포는 이미 빌드되어 있다.** 대부분의 요청은 일부 화면·API·규칙의 수정/보완/추가다. 매번 5인 풀팀(`TeamCreate`+`SendMessage`)을 띄우면 팀 조율 메시지가 토큰·시간을 폭식한다. 따라서 **작업 규모로 실행 모드를 분기한다:**

| 작업 규모 | 실행 모드 | 누구를 띄우나 |
|----------|----------|--------------|
| **부분 수정/보완/추가** (기본·대다수) | **서브에이전트** — 필요한 에이전트만 `Agent` 도구로 직접 호출, 독립 작업은 `run_in_background:true`로 병렬 | 영향받는 에이전트만 (예: 화면만 → frontend / API+화면 → backend+frontend+qa) |
| **신규 대형 빌드 / 다수 모듈 동시 신설** | 에이전트 팀 (`TeamCreate`) — 계약 경계면 실시간 조율 필요 | 5인 풀팀 |

**판단 기준:** 한 요청이 ①단일 영역(화면만/API만/배포만)이거나 ②2~3개 모듈의 국소 수정이면 **서브에이전트**다. 계약 자체를 새로 설계하거나 다수 화면+API를 동시에 신설하는 "처음부터 만들기" 수준일 때만 풀팀. **확신이 안 서면 서브에이전트로 시작**하고, 경계면 조율 필요가 드러나면 그때 팀으로 승격한다.

**모델 차등 (토큰·속도 절감):** 추론 깊이가 정확도를 좌우하는 backend만 opus, 나머지는 sonnet. Agent/TeamCreate 호출 시 아래 값을 그대로 쓴다. (상위 모델 일괄 상향은 2026-06-11 시도 후 토큰·컨텍스트 과다로 철회 — 속도가 필요하면 모델 상향이 아니라 **병렬 팬아웃**을 먼저 쓴다.)

| 에이전트 | 모델 | 이유 |
|---------|------|------|
| backend-engineer | **opus** | 점수계산·가중치·상태전이·계약 설계 — 추론 정확도가 핵심 |
| product-designer | sonnet | 디자인 시스템(Kinetic Enterprise·루트 DESIGN.md) 확정 — 토큰 적용 위주 |
| frontend-engineer | sonnet | 확정 계약·스펙 기반 화면 배선 |
| qa-inspector | sonnet | 양쪽 동시 읽기·경계면 대조 |
| release-engineer | sonnet | Docker·compose 설정 |

**프론트엔드 스킬 강제:** frontend-engineer를 스폰할 때 프롬프트 첫 줄에 **"코드를 건드리기 전에 `nextjs-frontend` 스킬을 Skill 도구로 반드시 먼저 호출하라 (예외 없음)"**를 명시한다. 우회 금지.

**컨텍스트 절약:** 각 에이전트는 **자기 작업에 필요한 레퍼런스만** Read한다. 전체 레퍼런스 다발을 무조건 읽지 않는다 (예: 배포 작업에 domain-model.md 불필요). 부분 재실행 시 이전 산출물 경로를 프롬프트에 직접 주어 재탐색 비용을 없앤다.

## 속도 우선 모드 (토큰↑·벽시계↓ 옵트인)

**기본은 위의 토큰 절약 모드.** 단, 사용자가 **"빠르게/속도 우선/시간 급함/병렬로"** 등 속도를 명시하거나, 데드라인이 걸린 작업이면 **속도 우선 모드**로 전환한다. 토큰을 1.3~1.8배 더 쓰는 대신 벽시계 시간을 절반 이하로 줄이는 게 목표다. 적용 순서는 효과·구조변경 비용 순:

1. **병렬 팬아웃 (1순위·항상 적용).** 의존성 없는 에이전트는 **한 메시지에서 동시에** `Agent` 호출(독립 작업은 `run_in_background:true`). 벽시계 = 에이전트들의 합 → 가장 느린 한 명으로 줄어든다.
   - 의존 경계(계약/스키마 선행)만 직렬: API shape이 바뀌면 backend 먼저 → 그다음 frontend·qa **동시**.
   - 화면이 여러 개면 화면별 frontend 에이전트를 **개별 병렬** 스폰(파일 충돌 영역이 겹치면 `isolation:"worktree"`).
   - 단계마다 전원 대기(배리어)를 만들지 않는다. A가 QA 중이면 B는 디자인 중일 수 있게 둔다.

2. **컨텍스트 선적재 (2순위).** 에이전트가 Read로 왕복할 레퍼런스·이전 산출물을 **프롬프트에 발췌 인라인**으로 박아 순차 tool 왕복을 제거한다. (토큰↑, 라운드트립↓) 단 발췌가 길면 경로만 주는 게 낫다 — 핵심 규칙·계약 스니펫만 인라인.

3. **중복/투기 실행 (3순위·재시도 잦은 구간만).** 디자인 정렬·점수 계산 엣지처럼 "틀리면 다시" 라운드가 잦은 영역은 **N개 변형을 병렬 생성 → 판정 후 최선 채택**. 재시도 라운드를 1회로 압축. 단순 배선엔 쓰지 않는다(낭비).

4. **모델 상향으로 재작업 제거 (선택).** 1회 통과율이 낮아 재시도가 반복되는 에이전트는 sonnet→**opus**로 올린다. 토큰 단가는 오르지만 재시도 라운드(=벽시계)가 사라지면 결과적으로 더 빠르다. backend는 이미 opus. (일괄 상향 금지 — 재시도가 실제 반복된 구간에만)

**확신이 안 서면 ①병렬 팬아웃 + ②선적재만** 적용한다(구조변경 최소·효과 최대). ③④는 재시도가 실제로 잦았던 구간에만. 속도 우선 모드로 돌렸으면 보고 시 "병렬 N개 동시 실행" 등 무엇을 병렬화했는지 한 줄 명시한다.

## 기술 스택 (확정)

| 영역 | 스택 |
|------|------|
| 프론트엔드 | Next.js (App Router) + React + TypeScript |
| 디자인 | **Kinetic Enterprise 디자인 시스템** — 루트 `DESIGN.md`가 SSOT(퍼플/블루/틸, 기본 글꼴 Pretendard, 8px rounded) → 자체 토큰(Tailwind) |
| 백엔드 | **분리형 API 서버** — NestJS + Prisma + PostgreSQL (기본) |
| 배포 | **Docker** 자체 호스팅 (Dockerfile + docker-compose) |
| 구조 | 모노레포 권장 — `apps/web`(프론트), `apps/api`(백엔드) |
| 규칙 | 등급·풀·인상률·가중치 등 수치 규칙은 **설정 가능(`RuleSet`)**, 에너지엑스 2026 값을 기본 seed |

## 에이전트 구성 (팀원 5명 + 리더)

| 팀원 | 에이전트 타입 | 모델 | 역할 | 스킬 | 산출물 위치 |
|------|-------------|------|------|------|------------|
| `product-designer` | 커스텀 | sonnet | 와이어프레임 → UI 디자인 시스템 → 컴포넌트 스펙 | `wireframe-to-design` | `_workspace/01_design/`, `apps/web` 스타일 |
| `backend-engineer` | 커스텀 | **opus** | API 계약 → NestJS API + Prisma 스키마 + RBAC | `api-backend` | `apps/api/` |
| `frontend-engineer` | 커스텀 | sonnet | Next.js 화면 + 훅 + 상태관리 (계약 기반) | `nextjs-frontend` (**필수 호출**) | `apps/web/` |
| `qa-inspector` | 커스텀 (general-purpose 기반) | sonnet | 통합 정합성 교차 검증 (점진적) | `integration-qa` | `_workspace/05_qa/` |
| `release-engineer` | 커스텀 | sonnet | Dockerfile + compose + CI + 배포 게이트 | `deployment-pipeline` | `_workspace/06_release/`, repo 루트 |
| 리더(오케스트레이터) | (메인) | — | 요구사항 정리, 계약 합의 주재, 팀 조율, 보고 | 이 스킬 | `_workspace/00_input/` |

### 권위 자료 & 단일 진실 공급원

**최우선 권위 자료(따라야 할 기준):** `인사 평가 시스템 참고용/2026년도 임직원 KPI 및 평가 운영 계획_VER3 1.pptx`(운영계획 PPT). KPI 양식 xlsx·요구사항 정의서·사용자 스토리가 보완. 아래 레퍼런스 문서들은 이 자료를 정제·체계화한 것이며, 충돌 시 PPT가 이긴다.

| 레퍼런스 | 지위 | 내용 |
|----------|------|------|
| [references/domain-model.md](references/domain-model.md) | 권위 | 엔티티·역할(4)·직책(6)·KPI 분류·평가 유형·상태 머신·명명 |
| [references/business-rules.md](references/business-rules.md) | 권위 | 등급·달성률·그룹 풀·가중치·인상률·캐스케이드·타임라인·RBAC (설정 가능, 2026 seed) |
| [references/api-contract-convention.md](references/api-contract-convention.md) | 권위 | 응답 봉투·경로·인증·camelCase 규약 |
| 루트 [DESIGN.md](../../../DESIGN.md) | 권위 | 시각 언어 SSOT — Kinetic Enterprise 팔레트·타이포·라운드·컴포넌트 + 프로젝트 적용 노트(한글 폴백·등급 색) |
| [references/reference-ui-screens.md](references/reference-ui-screens.md) | **참고용(advisory)** | 타사 화면 인벤토리·컴포넌트 — 아이디어 참고만. 규칙·도메인은 위 권위 자료 우선 |

**원본 자료:** `인사 평가 시스템 참고용/` — 운영계획 pptx(권위), KPI 양식 xlsx, 요구사항 정의서, 사용자 스토리(US/UC), 레퍼런스 이미지(참고용). 에이전트는 필요 시 원본을 Read로 확인한다.

## 워크플로우

### Phase 0: 컨텍스트 확인 (후속 작업 지원)

작업 시작 시 `_workspace/` 존재 여부로 실행 모드를 결정한다:

1. `_workspace/` 디렉토리 존재 확인
2. 모드 결정:
   - **미존재** → 초기 실행. Phase 1로 진행
   - **존재 + 부분 수정 요청** (예: "디자인만 다시", "결제 API 수정", "배포만") → **부분 재실행**. 해당 팀원만 스폰하고, 그 팀원의 산출물 + 직접 영향받는 경계면(QA)만 갱신. 다른 산출물은 보존
   - **존재 + 새 요구사항** → **새 실행**. 기존 `_workspace/`를 `_workspace_{YYYYMMDD_HHMMSS}/`로 이동 후 Phase 1
3. 부분 재실행 시: 이전 산출물 경로를 팀원 프롬프트에 포함하여 기존 결과를 읽고 피드백만 반영하도록 지시

### Phase 1: 준비 (리더)

1. 사용자 요구사항 분석 — 평가 유형(본인 self/부서장 downward 1차 팀장·2차 본부장), KPI 분류(category·group performance_core/collaboration_growth·measureType), 조직 계층(그룹→본부→팀→개인), 역할(hr_admin·division_head·team_lead·employee), 필요 화면(reference-ui-screens 기준), 적용 규칙(business-rules의 RuleSet)을 파악
2. `_workspace/` 및 하위 디렉토리 생성:
   ```
   _workspace/
   ├── 00_input/        # 요구사항 정리, 화면 목록, 도메인 범위
   ├── 01_design/       # 와이어프레임, 디자인 토큰, 컴포넌트 스펙
   ├── 02_contract/     # API 계약 (openapi.yaml / contract.md) — FE+BE 공유
   ├── 03_backend/      # 백엔드 진행 노트 (실제 코드는 apps/api)
   ├── 04_frontend/     # 프론트 진행 노트 (실제 코드는 apps/web)
   ├── 05_qa/           # QA 리포트
   └── 06_release/      # 배포 설정·릴리스 노트
   ```
3. 요구사항을 `_workspace/00_input/requirements.md`에 저장 (도메인 모델의 엔티티/상태/권한 기준으로 정규화)

### Phase 2: 에이전트 스폰 (리더) — 작업 규모로 분기

**2-A. 부분 수정/보완/추가 (기본·대다수) — 서브에이전트:**

`TeamCreate`를 쓰지 않는다. 영향받는 에이전트만 `Agent` 도구로 직접 호출하고, 모델은 위 차등표대로 지정한다. 독립 작업은 `run_in_background:true`로 병렬, 의존 작업은 순차. 프롬프트에 **이전 산출물 경로**(부분 재실행)와 **필요한 레퍼런스만** 명시한다.

```
# 예: "KPI 화면 등급 분포 막대 색 보완" → frontend만
Agent(subagent_type:"frontend-engineer", model:"sonnet",
  prompt:"먼저 nextjs-frontend 스킬을 Skill 도구로 반드시 호출하라(예외 없음). 그 후 apps/web의 KPI 화면 등급 분포 막대 색을 _workspace/01_design 토큰에 맞게 보완하라. 기존 apps/web/_workspace/04_frontend/progress.md를 읽고 변경 부분만 수정.")

# 예: "평가 제외 API 추가 + 화면 반영" → backend(opus)+frontend(sonnet)+qa(sonnet)
Agent(subagent_type:"backend-engineer", model:"opus", prompt:"...계약 갱신 후 apps/api 구현...")
# 계약 확정 후 frontend·qa 순차 스폰
```

스폰 규칙: ①frontend-engineer 프롬프트는 **항상 "nextjs-frontend 스킬 먼저 호출(필수)"로 시작** ②API shape이 바뀌면 backend→frontend→qa 순서(계약이 선행) ③단일 영역 수정은 해당 에이전트 1명만.

**2-B. 신규 대형 빌드 — 에이전트 팀:**

다수 모듈을 동시에 신설하거나 계약을 처음부터 설계할 때만 `TeamCreate`로 5인 팀을 구성한다. 모델은 차등표대로(backend opus, 나머지 sonnet):

```
TeamCreate(
  team_name: "eval-dev-team",
  members: [
    { name: "product-designer",  agent_type: "product-designer",  model: "sonnet", prompt: "wireframe-to-design 스킬과 루트 DESIGN.md(Kinetic Enterprise·시각 언어 SSOT), reference-ui-screens.md, domain-model.md를 읽고 와이어프레임→디자인 시스템을 설계하라. _workspace/00_input/requirements.md가 입력." },
    { name: "backend-engineer",   agent_type: "backend-engineer",   model: "opus",   prompt: "api-backend 스킬과 domain-model.md, business-rules.md, api-contract-convention.md를 읽고 API 계약 합의 후 NestJS+Prisma API(규칙은 RuleSet 설정값)를 apps/api에 구현하라." },
    { name: "frontend-engineer",  agent_type: "frontend-engineer",  model: "sonnet", prompt: "코드를 건드리기 전에 nextjs-frontend 스킬을 Skill 도구로 반드시 먼저 호출하라(예외 없음). 그 후 디자인 스펙·API 계약을 읽고 Next.js 화면을 apps/web에 구현하라." },
    { name: "qa-inspector",       agent_type: "qa-inspector",       model: "sonnet", prompt: "integration-qa 스킬을 읽고 각 모듈 완성 직후 경계면 교차검증(점진적 QA)을 수행하라." },
    { name: "release-engineer",   agent_type: "release-engineer",   model: "sonnet", prompt: "deployment-pipeline 스킬을 읽고 Docker 빌드·compose·배포 게이트를 준비하라." }
  ]
)
```

작업 등록(`TaskCreate`) — 의존성을 `depends_on`으로 명시:

```
TaskCreate(tasks: [
  { title: "디자인 시스템",      assignee: "product-designer" },
  { title: "API 계약 초안",      assignee: "backend-engineer" },
  { title: "API 계약 검토",      assignee: "frontend-engineer", depends_on: ["API 계약 초안"] },
  { title: "백엔드 구현",        assignee: "backend-engineer",  depends_on: ["API 계약 검토"] },
  { title: "프론트 구현",        assignee: "frontend-engineer", depends_on: ["API 계약 검토", "디자인 시스템"] },
  { title: "점진적 QA",          assignee: "qa-inspector",      depends_on: ["백엔드 구현", "프론트 구현"] },
  { title: "배포 파이프라인",    assignee: "release-engineer",  depends_on: ["점진적 QA"] }
])
```

### Phase 3: 디자인 (파이프라인 선행)

**담당:** product-designer · **참조:** 다른 팀원은 진행 중 디자인 스펙을 미리 검토

1. product-designer가 요구사항 → 와이어프레임(화면 흐름) → 디자인 토큰(색/타이포/간격) → 컴포넌트 스펙 생성
2. 산출물을 `_workspace/01_design/`에 저장 (wireframes.md, design-tokens.md, component-spec.md)
3. 완료 시 `SendMessage`로 frontend-engineer에게 통지 (프론트 구현의 입력)

### Phase 4: API 계약 합의 (경계면 — 가장 중요)

**담당:** backend-engineer(주도) ↔ frontend-engineer(검토) · **리더 주재**

1. backend-engineer가 도메인 모델 기반으로 API 계약 초안 작성 → `_workspace/02_contract/contract.md`(또는 openapi.yaml)
2. frontend-engineer가 계약을 읽고 화면이 필요로 하는 데이터 shape과 대조, 부족/불일치를 `SendMessage`로 협상
3. 합의된 계약을 확정. **이 계약이 양쪽 구현의 단일 기준.** 이후 변경은 api-contract-convention.md §6 프로토콜을 따른다
4. 리더는 계약에 응답 봉투(`{data}`/`{data,meta}`/`{error}`)·camelCase·권한이 명시됐는지 확인

### Phase 5: 구현 (팬아웃 — 병렬)

**담당:** backend-engineer ∥ frontend-engineer 동시 진행

- backend-engineer: Prisma 스키마 → 마이그레이션 → NestJS 모듈(컨트롤러·서비스·RBAC 가드) → 계약대로 응답 직렬화 → `apps/api`
- frontend-engineer: 디자인 스펙 + 계약 기반으로 페이지·컴포넌트·데이터 훅(계약 타입과 1:1) → `apps/web`
- 두 팀원은 계약 변경·블로커를 `SendMessage`로 실시간 공유. 한 모듈(예: 평가 주기 CRUD)이 양쪽 다 끝나면 즉시 QA에 통지

### Phase 6: 점진적 QA (생성-검증)

**담당:** qa-inspector · **방식:** 전체 완성 후 1회가 아니라 **모듈 완성 직후마다**

1. 각 모듈 완성 통지를 받으면 qa-inspector가 해당 API route + 대응 프론트 훅을 **동시에 읽고** 경계면 교차검증 (응답 shape↔훅 타입, 라우팅, 상태전이, 권한 가드)
2. 결함 발견 시 양쪽 담당 에이전트에게 `파일:라인 + 수정방법`을 `SendMessage`로 즉시 전달
3. 검증 리포트를 `_workspace/05_qa/qa-report-{module}.md`에 누적
4. 모든 모듈 통과 시 릴리스 게이트 통과를 리더 + release-engineer에게 통지

### Phase 7: 배포 (파이프라인 종단 게이트)

**담당:** release-engineer · **선행:** QA 게이트 통과

1. `apps/web`·`apps/api`의 Dockerfile + docker-compose 작성 (postgres는 공식 이미지로 compose에 구성)
2. 환경변수/시크릿 템플릿(`.env.example`), 헬스체크, 마이그레이션 실행 순서 구성
3. 로컬 `docker compose up`으로 빌드·기동 검증 (스모크 테스트)
4. 배포 절차·롤백 절차를 `_workspace/06_release/RELEASE.md`에 기록

### Phase 8: 정리 및 보고 (리더)

1. 모든 팀원 작업 완료 확인 (`TaskGet`)
2. 팀원에게 종료 통지 후 `TeamDelete`
3. `_workspace/` 보존 (감사 추적)
4. 사용자에게 산출물 요약 보고 + **피드백 수집(하네스 진화)** — 개선점 질의 후 에이전트·스킬·규칙에 반영

## 데이터 흐름

```
[리더] 요구사항 → 00_input/
   │
   ├─ TeamCreate(5인)
   │
   ▼
[product-designer] ──01_design/──┐
[backend-engineer] ─┐            │
   │ 계약 협상 ↕ SendMessage     │
[frontend-engineer]─┘            │
   │                            │
   ├─ 02_contract/ (FE+BE 공유 단일 계약)
   │
   ├─ apps/api (BE) ∥ apps/web (FE)  ←01_design/ 입력
   │        │           │
   │        └──모듈완료──┴──→ [qa-inspector] 경계면 교차검증 → 05_qa/
   │                              │ (결함 → SendMessage로 양쪽 수정)
   │                              ▼ 게이트 통과
   └──────────────────────→ [release-engineer] Docker → 06_release/
                                   ▼
                            [리더: 통합 보고]
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| 팀원 1명 실패/중지 | 리더가 유휴 알림 감지 → `SendMessage`로 상태 확인 → 재시작 또는 대체 스폰 |
| 팀원 과반 실패 | 사용자에게 알리고 진행 여부 확인 |
| 계약 불일치 발견(QA) | 삭제·추측 금지. 계약 파일을 기준으로 잘못 구현한 쪽을 수정. 계약 자체가 모호하면 리더가 중재 |
| QA 결함 무한 핑퐁 | 동일 결함 2회 재발 시 리더가 계약/스펙을 재확정하고 양쪽에 단일 지시 |
| Docker 빌드 실패 | release-engineer가 로그 첨부하여 원인 모듈 담당에게 통지, 1회 재시도 후 누락 명시 |
| 타임아웃 | 현재까지 산출물로 진행, 미완료 항목을 보고서에 명시 |

## 테스트 시나리오

### 정상 흐름
1. 사용자: "KPI 성과평가 솔루션 만들어줘 (본인평가 + 부서장 1·2차 평가 + 그룹 등급 풀 + HR 대시보드)"
2. Phase 1: 요구사항을 도메인 모델로 정규화 → requirements.md
3. Phase 2: 5인 팀 + 7개 작업 등록
4. Phase 3: 디자인 시스템 + 와이어프레임
5. Phase 4: API 계약 합의 (`{data}` 봉투, camelCase, RBAC 명시)
6. Phase 5: 백엔드(NestJS)·프론트(Next.js) 병렬 구현
7. Phase 6: 모듈마다 경계면 QA 통과
8. Phase 7: Docker compose 빌드·기동 검증
9. 예상 결과: 실행 가능한 모노레포 + `docker compose up`으로 기동, `_workspace/` 산출물 보존

### 에러 흐름
1. Phase 6에서 QA가 `평가목록 API가 배열 직접 반환(봉투 누락)` 발견
2. qa-inspector가 backend-engineer에게 `파일:라인 + {data} 봉투로 감싸라` 통지
3. 동일 결함이 다른 엔드포인트에서 재발
4. 리더가 계약 §1(응답 봉투)을 재확정하고 backend-engineer에게 전 엔드포인트 일괄 적용 지시
5. frontend-engineer에게도 `res.data` unwrap 일관 적용 통지
6. 재검증 통과 후 Phase 7 진행

## 후속 작업 / 부분 재실행

- "디자인만 다시" → product-designer만 스폰, `_workspace/01_design/` 갱신, frontend-engineer에 변경 통지
- "OO API 추가/수정" → 계약 갱신(§6 프로토콜) → backend-engineer + frontend-engineer + qa-inspector 스폰
- "배포 설정만" → release-engineer만 스폰
- 항상 Phase 0에서 기존 `_workspace/`를 읽고 변경 최소 범위만 재실행한다
