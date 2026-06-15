---
name: nextjs-frontend
description: "인사평가 솔루션의 프론트엔드(Next.js App Router + React + TypeScript)를 구현. 디자인 스펙·API 계약 기반으로 페이지·컴포넌트·데이터 훅·타입·역할별 화면 분기·폼 검증 구현 시 사용. 화면/UI/프론트엔드/Next.js/React 컴포넌트를 만들거나 수정·추가·보완할 때 반드시 사용."
---

# 인사평가 프론트엔드 (Next.js App Router)

디자인 스펙을 화면으로, API 계약을 타입 안전한 데이터 훅으로 구현하는 스킬. 경계면 규율로 런타임 크래시를 차단한다.

## 단일 진실 공급원
- **코드 구조(feature-sliced·파일상한·`packages/ui`): `eval-harness-orchestrator/references/architecture.md`**
- 디자인: `_workspace/01_design/*` (wireframes, design-tokens, component-spec)
- 화면·컴포넌트: `eval-harness-orchestrator/references/reference-ui-screens.md`
- 시각 언어(SSOT): 루트 `DESIGN.md` — **Kinetic Enterprise** (퍼플/블루/틸, 기본 글꼴 Pretendard, 8px rounded) + 하단 "프로젝트 적용 노트". 공유 컴포넌트·토큰은 `packages/ui`에서 import
- API 계약: `_workspace/02_contract/*` + `eval-harness-orchestrator/references/api-contract-convention.md` (OpenAPI 발행 → orval codegen)
- 도메인·규칙: `eval-harness-orchestrator/references/domain-model.md`, `business-rules.md`

## 절차

### 1. 프로젝트 구조 (App Router)

> **⚠ 현행(Phase 1) vs 목표(Phase 2~3).** 아래 트리는 **현행 구조**다(`apps/web` 안 `components/`·`hooks/`·`lib/`). `architecture.md` §5의 feature-sliced(`features/`·`entities/`·`shared/`)와 공유 `packages/ui`는 **목표 구조**로, `packages/`·`features/`는 **아직 없다**. 기존 화면 부분수정은 현행 트리를 따르고(없는 경로 import 금지), 신규/대형 리팩터만 목표로 수렴한다.

레퍼런스 화면 기준 현행 레이아웃:
```
apps/web/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (main)/
│   │   ├── layout.tsx                  # AppShell: 상단탭 + 역할별 사이드바
│   │   ├── evaluation/page.tsx         # S1 인사평가 메인 (주차별 일정 캘린더)
│   │   ├── evaluation/self/...         # S3 본인평가 (KPI 2그룹: 성과중심/협업·성장 탭)
│   │   ├── evaluation/dept-head/...    # S6 부서장 평가(downward 3단계: 팀장·본부장·그룹대표, 분포)
│   │   ├── kpis/...                    # KPI 작성·검토·실적
│   │   ├── results/...                 # S7 평가 상세결과(self+downward 비교)
│   │   ├── reports/...                 # 등급 분포 모니터링
│   │   └── admin/...                   # S8 규칙·양식·일정 설정 (hr_admin)
│   └── layout.tsx
├── components/                  # component-spec 기반 (GradeRadio, ComparisonBar 등)
├── hooks/                       # 계약 1:1 데이터 훅
├── lib/
│   ├── api.ts                   # fetch 래퍼 (봉투 unwrap)
│   └── types.ts                 # 계약 응답 타입 (camelCase)
└── tailwind.config.ts           # DESIGN.md(Kinetic Enterprise) design-tokens 반영
```
> route group `(main)`·`(auth)`는 URL에서 제거됨에 유의 (링크는 `/evaluation`, `/results` 등).

### 2. 디자인 토큰 반영 (Kinetic Enterprise — 루트 DESIGN.md)
`design-tokens.md`(없으면 루트 `DESIGN.md` frontmatter)의 토큰을 `tailwind.config.ts`(또는 CSS 변수)로 옮긴다. 색(primary 퍼플·secondary 블루 액션·tertiary 틸·surface 계열)·간격·타이포·반경(기본 8px, 뱃지/검색바 Pill)·그림자(보라 틴트 soft)를 토큰명과 일치시켜 디자이너 스펙과 픽셀 일관성을 유지. 등급 시맨틱 색(S~D)·평가 상태 색을 전역 토큰으로. **글꼴은 Pretendard 기본**(`DESIGN.md` 적용 노트 §1의 font stack 그대로). 사이드바는 Primary Purple 배경 + 좌측 4px Teal 활성 바.

### 3. API 레이어 (경계면 규율의 핵심)

**목표: 계약은 codegen으로 받는다 (손으로 타입 안 씀).** 백엔드가 `@nestjs/swagger`로 발행한 `openapi.json`을 `packages/contracts`에서 **orval**로 생성한 타입·react-query 훅 클라이언트를 import한다. 계약이 바뀌면 codegen 재실행 → 타입 불일치가 컴파일 에러로 드러난다. 봉투 unwrap·인증 헤더는 orval **mutator(공용 fetch 래퍼)** 한 곳에서 처리한다:
```ts
// packages/contracts/src/mutator.ts — orval custom instance
export async function mutator<T>(config: RequestConfig): Promise<{ data: T; meta?: Meta }> {
  const res = await fetch(`${BASE}/api/v1${config.url}`, { ...config, headers: authHeader() });
  const json = await res.json();
  if (!res.ok) throw new ApiError(json.error);   // {error} 봉투
  return json;                                    // {data} 또는 {data, meta}
}
```
- **절대** 봉투를 무시하고 응답을 배열로 가정하지 않는다 (`.filter is not a function` 방지) — mutator가 봉투를 일관 처리.
- codegen 도입 전 과도기에는 동일 규율의 수동 `lib/api.ts` 래퍼를 쓰되, 새 엔드포인트는 생성 클라이언트로 수렴시킨다.

### 4. 타입 정의 (계약 1:1)
`lib/types.ts`의 타입은 API 계약 응답과 **정확히** 일치(camelCase). 추측 캐스팅(`as T`)으로 불일치를 숨기지 않는다. 계약이 바뀌면 타입을 함께 갱신.

### 5. 데이터 훅
계약 엔드포인트마다 훅을 만든다 (`useEvaluations`, `useCycle` 등). 훅의 제네릭 타입은 계약 응답과 1:1. 모든 API 엔드포인트에 대응 훅이 있고 실제로 호출되는지 확인 (죽은 엔드포인트/누락 호출 방지).

### 6. 라우팅 정합성
- 모든 `href`/`router.push`/`redirect`는 실제 존재하는 `app/` 경로를 가리킨다.
- route group `(main)`·`(auth)`는 **URL에서 제거**됨 — 링크에 `(main)`을 넣지 않는다. 메인 내부 페이지는 `/cycles`, `/results` 등.
- 동적 세그먼트 `[id]`는 올바른 파라미터로 채운다.

### 7. 역할·상태 분기
- 역할(role)별 메뉴·화면 가시성을 권한 매트릭스대로. (단, 보안은 백엔드 가드가 책임 — 프론트는 UX 차원)
- 평가 상태(not_started/in_progress/submitted/finalized)별 UI 분기. 분기 조건의 상태 문자열이 도메인 모델과 일치.
- 401→로그인 리다이렉트, 403→권한 안내 표시.

### 8. 폼·계산
- 평가 작성 폼: 임시저장(in_progress)·제출(submitted). 제출 후 읽기전용.
- 가중치 합계는 **표시만** (검증은 백엔드). 총점은 백엔드 응답을 표시 — 프론트 재계산 금지(불일치 방지).

## 산출물
- `apps/web/` — Next.js 소스
- `_workspace/04_frontend/progress.md` — 현황·결정 노트

## 흔한 실수 (피한다)
- 봉투 unwrap 누락 → 배열 가정 크래시
- snake_case/camelCase 혼용 타입 → 필드 undefined
- `(group)`을 URL에 포함 → 404
- API 엔드포인트에 대응 훅 누락 → 기능 동작 안 함
- 프론트에서 총점 재계산 → 백엔드와 불일치
