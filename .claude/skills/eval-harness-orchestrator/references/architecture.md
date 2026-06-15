# 멀티서비스 아키텍처 (SSOT)

이 문서는 **에너지엑스 플랫폼**의 코드 구조·경계·관례에 대한 단일 진실 공급원이다. 새 서비스를 붙이거나, 모듈을 추가하거나, 파일을 배치할 때 이 문서가 이긴다. 시각 언어는 루트 `DESIGN.md`, API 계약 형식은 `api-contract-convention.md`, 외부 연동은 `integration-adapter.md`가 담당하고, 이 문서는 **"무엇을 어디에 두는가"** 와 **"왜 그렇게 자르는가"** 를 정의한다.

## 0. 설계 동인 (왜 이 구조인가)

세 가지 제약이 구조를 결정한다. 결정을 내릴 때 이 셋과 충돌하지 않는지 본다.

| 동인 | 구조적 답 |
|------|-----------|
| **AI 가독성** (바이브 코딩 — AI가 파일을 읽고 고침) | 수직 슬라이스 + 파일당 ~200줄 상한 + 모듈 매니페스트(README). 한 파일은 한 가지 일만, 한 모듈은 한 폴더 안에 자기완결. |
| **서비스가 계속 늘어남** | 모노레포 + 서비스별 모듈러 모놀리식. 모듈 경계 = 미래의 절단선. |
| **외부/타 서비스 API를 붙임** | OpenAPI 계약우선 + integration 어댑터(부패방지). |

## 1. 레포 토폴로지 — Turborepo + pnpm 모노레포

서비스가 늘어도 **단일 저장소**에서 관리한다(1인 유지보수 최적: 원자적 커밋, 단일 CI, 끊김 없는 코드 점프). 폴리레포로 가지 않는다.

```
energyx-platform/                  # 모노레포 루트
├── apps/                          # 배포 가능한 앱 (서비스 = 여기에 폴더 하나 추가)
│   ├── web/                       # 인사평가 프론트 (Next.js App Router)
│   ├── api/                       # 인사평가 백엔드 (NestJS · 모듈러 모놀리식)
│   └── <new-service>/             # 신규 서비스는 여기에 추가 (스캐폴드 체크리스트 참조)
├── packages/                      # 워크스페이스 공유 패키지
│   ├── ui/                        # Kinetic Enterprise 디자인 시스템 (공유 컴포넌트·토큰)
│   ├── contracts/                 # OpenAPI 스키마 → codegen 타입·클라이언트 (계약 SSOT)
│   ├── auth/                      # 공유 인증/세션 (멀티서비스 공통 도메인)
│   ├── config/                    # eslint·tsconfig·tailwind preset 공유 (파일상한 룰 포함)
│   └── db/                        # Prisma 공유 래퍼 (선택)
├── turbo.json                     # build·lint·typecheck·test·generate 파이프라인+캐시
├── pnpm-workspace.yaml            # apps/*, packages/*
└── package.json                   # 루트 스크립트
```

**규칙:**
- 앱(`apps/*`)은 **배포 단위**, 패키지(`packages/*`)는 **공유 단위**. 앱은 패키지를 의존하지만 앱이 앱을 직접 import하지 않는다(앱 간 연동은 HTTP+OpenAPI로).
- 패키지는 `@energyx/<name>`으로 명명(예: `@energyx/ui`, `@energyx/contracts`).
- `turbo.json`의 `dependsOn`으로 빌드 순서를 선언한다: `contracts#generate` → `web#build`. 캐시를 적극 활용해 변경된 패키지만 재빌드.

> 기존 인사평가 앱은 `apps/web`+`apps/api`로 이미 한 서비스다. **억지로 쪼개지 않는다.** "신규 서비스 = `apps/` 폴더 하나 + OpenAPI 연동"만 새 규칙이다.

## 2. 서비스 내부 — 모듈러 모놀리식 (바운디드 컨텍스트)

한 백엔드 앱은 **여러 바운디드 컨텍스트(모듈)** 로 구성된 하나의 배포물이다. 마이크로서비스로 쪼개지 않되, **언제든 쪼갤 수 있게** 경계를 긋는다.

```
apps/api/src/
├── main.ts                        # 부트스트랩 (ValidationPipe·전역 인터셉터·예외 필터·Swagger)
├── common/                        # 횡단 관심사 (가드·인터셉터·필터·직렬화)
└── modules/
    └── <context>/                 # = 바운디드 컨텍스트 1개
        ├── README.md              # ★ 모듈 매니페스트 (AI 길찾기용 — §4)
        ├── <context>.module.ts
        ├── <context>.controller.ts
        ├── <context>.service.ts
        ├── <context>.mapper.ts    # DB(snake) ↔ API(camel) 변환
        ├── dto/                   # 요청/응답 DTO (@nestjs/swagger 데코레이터)
        └── __tests__/
```

**모듈 경계 규칙 (미래의 절단선):**
- **모듈 간 DB 직접 조인 금지.** A 모듈이 B의 데이터가 필요하면 B의 **서비스 인터페이스**를 호출한다(B의 테이블을 직접 쿼리하지 않는다). 이래야 나중에 B를 별도 서비스로 떼어낼 때 호출부만 HTTP로 바꾸면 된다.
- **모듈 간 import는 public API만.** 각 모듈은 `index.ts`(배럴)로 외부에 노출할 것만 export. 다른 모듈의 내부 파일을 깊은 경로로 import하지 않는다.
- **Postgres schema 네임스페이스로 데이터 분리.** 모듈마다 스키마(`evaluation.*`, `org.*`, `compensation.*`)를 두고 교차 참조는 ID로만. 나중에 서비스별 DB로 분리할 때 절단선이 이미 그어져 있다.
- **공유 도메인은 `packages/`로.** 인증·조직·사용자처럼 여러 서비스가 공유하는 개념은 서비스 안에 중복 구현하지 말고 `packages/auth` 등으로 끌어올린다.

## 3. 수직 슬라이스 & 파일 크기 (AI 가독성의 핵심)

AI가 파일을 통째로 읽고 안전하게 고치려면 파일이 작고 자기완결적이어야 한다.

- **수직 슬라이스:** 한 기능에 필요한 것(컨트롤러·서비스·DTO·매퍼·테스트)을 **한 모듈 폴더 안에** 모은다. 레이어별(controllers/, services/ 전부 한 폴더)로 흩지 않는다 — 기능 하나 고치려고 5개 폴더를 헤매지 않게.
- **파일당 ~200줄 상한.** ESLint `max-lines`(경고 200·에러 300)·`max-lines-per-function`으로 강제. 넘으면 책임을 쪼갠다(서비스가 비대하면 use-case별 파일로, 컴포넌트가 비대하면 하위 컴포넌트로).
- **한 파일 = 한 책임.** 한 컴포넌트/한 서비스/한 DTO 그룹. "유틸 잡동사니" 파일을 만들지 않는다.
- **이름이 곧 위치.** `<context>.service.ts`, `<feature>.controller.ts`처럼 파일명이 역할과 소속을 드러내게.

## 4. 모듈 매니페스트 (README) — AI 길찾기

각 모듈/패키지 루트에 `README.md`를 둔다. AI가 코드 전체를 읽지 않고도 **"이 모듈이 무엇이고 어디에 무엇이 있는지"** 를 30초에 파악하게 하는 지도다. 최소 항목:

```markdown
# <module> 모듈
- **책임:** 한 문장. 이 모듈이 소유한 도메인.
- **공개 API:** 외부에 노출하는 서비스 메서드/엔드포인트 (다른 모듈이 쓰는 진입점).
- **소유 데이터:** Postgres schema·주요 테이블.
- **의존:** 호출하는 다른 모듈/패키지 (인터페이스 경유).
- **핵심 파일:** controller/service/주요 로직 위치.
- **불변식:** 이 모듈이 지키는 규칙 (예: 가중치 합=100, 상태전이 맵).
```

프론트 `features/*`도 동일한 매니페스트를 둔다(책임·소비 API·주요 컴포넌트).

## 5. 프론트엔드 구조 — Feature-Sliced + 공유 UI 패키지

```
apps/web/
├── app/                           # Next.js App Router (라우팅 전용 — 얇게)
│   └── (group)/<route>/page.tsx   # page는 feature를 조립만
├── features/                      # 기능 단위 수직 슬라이스 (화면 로직·훅·컴포넌트)
│   └── <feature>/{ui, hooks, model, README.md}
├── entities/                      # 도메인 엔티티 표현 (등급 배지, KPI 카드 등 재사용)
├── shared/                        # 앱 전역 유틸 (api 래퍼, 포맷터)
└── (디자인 시스템은 packages/ui에서 import)
```

- **레이어 의존 방향:** `app → features → entities → shared`. 역방향 import 금지(shared가 feature를 모름).
- **디자인 시스템은 `packages/ui`.** Kinetic Enterprise 토큰·프리미티브는 패키지로 공유해 여러 앱이 같은 UI를 쓴다. 앱 안에 디자인 토큰을 중복 정의하지 않는다.
- **API 호출은 생성된 클라이언트로.** 손으로 fetch 타입을 쓰지 않는다 → `packages/contracts`의 orval 클라이언트 사용(`api-contract-convention.md` 참조).

## 6. 데이터베이스 — 단일 Postgres · 모듈별 스키마 분리

- 지금은 **DB 하나**, 모듈마다 Postgres **schema** 네임스페이스(`evaluation`, `org`, `compensation`, `reports`).
- 교차 컨텍스트 참조는 **외래키가 아니라 ID + 서비스 호출**. 스키마를 넘는 조인을 만들지 않는다.
- Prisma는 모듈별로 모델을 그룹화(`schema.prisma`의 `@@schema`). 마이그레이션은 `prisma migrate`.
- 미래: 한 컨텍스트의 부하가 커지면 그 schema를 별도 DB로 분리 → 경계가 이미 schema로 그어져 있어 비용이 작다.

**⚠ 리포팅/조회 read-model 예외 (현실 규약):** "모듈 간 DB 직접 조인 금지"는 **쓰기(명령)·트랜잭션 경계**에만 엄격 적용한다. `results`/`reports`/YoY처럼 여러 컨텍스트를 가로지르는 **읽기 전용 집계**는 다음을 허용한다 — (a) 조회 전용 **리포팅 컨텍스트(`reports`)** 가 여러 소유 schema를 읽는 read model/뷰, 또는 (b) **쓰기 시점 비정규화 스냅샷**(권장: `EvaluationResult`의 `group/division/teamSnapshot`처럼 결과 확정 시 조직 정보를 박아 조직 변동에도 시점 보존). ID+서비스호출만 강제하면 리포팅 경로에서 N+1이 폭증하므로, 핵심 조회는 read model로 명시적으로 모델링한다.

**⚠ Prisma multiSchema 제약 (Phase 2~3 착수 전 결정):** Prisma의 `@@schema`는 교차 schema **relation에 외래키를 생성**한다. "진짜 절단"(서비스 분리 대비)을 원하면 relation 필드를 제거하고 ID-only로 가야 하며, **그 시점에 기존 `include` 조인이 모두 깨진다**(영향 파일 인벤토리 선행 필수). 공유 enum(`Grade`·`Role` 등)의 schema 귀속도 분리 전에 결정해야 한다. 현행은 단일 schema라 즉각 위험은 없고, Phase 2~3 모듈 분리 착수 시 이 전환을 한 단계로 다룬다.

## 7. 신규 서비스 스캐폴드 체크리스트

새 서비스를 붙일 때(`apps/<svc>/`):

1. `apps/<svc>/` 생성, `package.json` name = `@energyx/<svc>`.
2. 백엔드면 §2 모듈 구조 + `common/`(봉투 인터셉터·예외 필터·RBAC 가드는 `packages/`에서 공유 가능), 프론트면 §5 구조.
3. **공유 도메인 연결:** 인증은 `packages/auth`, 디자인은 `packages/ui`, 계약 타입은 `packages/contracts`를 의존으로 추가(중복 구현 금지).
4. **OpenAPI 발행 설정:** 백엔드는 `@nestjs/swagger`로 `openapi.json` 발행, 소비처는 `packages/contracts`에 codegen 등록(`api-contract-convention.md`).
5. **외부 API를 소비/제공**하면 `integration` 모듈 + `integration-adapter.md` 규약 적용.
6. `turbo.json` 파이프라인에 새 앱의 build·lint·typecheck·test 등록.
7. 각 모듈에 매니페스트 README(§4), ESLint 파일상한 룰(`packages/config`) 상속.

## 8. 마이그레이션 단계 (현재 → 목표)

이 문서는 **목표 구조**다. 기존 코드를 한 번에 갈아엎지 않는다.

- **Phase 1(완료 대상):** 하네스 문서·레퍼런스·에이전트·스킬을 이 표준으로 정렬(코드 불변).
- **Phase 2a — 패키지 매니저 전환(별도 위험 단계, 단독 게이트):** 현행 **npm → pnpm**. ⚠ 가볍게 보지 말 것 — ①`pnpm-lock.yaml` 생성·hoisting 차이로 의존 해석이 달라짐 ②Dockerfile deps 스테이지가 `npm ci`/`package-lock.json` 전제라 재작성 필요 ③pnpm symlink 구조가 Next `standalone`·NestJS `dist` 복사 경로에 영향 ④`docker-compose` 빌드 컨텍스트. **`packages` 분리 전에 "pnpm 전환만으로 web·api 단독 빌드·스모크 통과"를 게이트로 통과**시킨 뒤 다음으로.
- **Phase 2b:** `turbo.json` 도입, `apps/web`·`apps/api`를 워크스페이스로 편입(코드 이동 최소), `packages/config`(ESLint 파일상한)·`packages/ui` 분리. 소비는 `workspace:*`(web은 `transpilePackages`, api는 tsconfig paths/turbo `dependsOn`로 빌드 순서). 외부 publish 버저닝은 비대상(내부 전용).
- **Phase 3:** `apps/api`에 `@nestjs/swagger` 발행 → `packages/contracts` orval 클라이언트로 프론트 점진 전환, `integration` 어댑터 1개 실증. (Prisma 모듈 schema 분리는 §6 multiSchema 제약 인벤토리 선행.)

**CI 게이트(release 소유):** 최소 1개 — `typecheck + build + contracts#generate diff`. `contracts#generate`는 web/api build의 **선행**이며, 생성물 diff가 비어 있어야 한다(**계약 드리프트 = 빌드 실패**). 이 게이트가 "계약 깨지면 빌드가 잡는다"를 실제로 보장한다. 테스트 커버리지 임계·관측성 등은 1인 유지보수 맥락상 당장 신설하지 않는다.

각 Phase는 빌드·QA 게이트를 통과해야 다음으로 넘어간다.
