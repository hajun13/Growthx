---
name: deployment-pipeline
description: "인사평가 솔루션을 Docker로 컨테이너화하여 자체 호스팅에 배포. Dockerfile, docker-compose, 환경변수(.env.example), Prisma 마이그레이션 기동 순서, 헬스체크, 스모크 테스트, 배포·롤백 런북 작성 시 사용. 배포/도커/컨테이너/CI/릴리스/호스팅을 설정하거나 수정·보완할 때 반드시 사용."
---

# Docker 배포 파이프라인 (자체 호스팅)

분리형 풀스택(Next.js web + NestJS api + PostgreSQL)을 Docker로 컨테이너화하고 자체 호스팅에 배포하는 스킬. 재현 가능한 빌드·안전한 기동 순서·롤백을 보장한다.

## 선행 조건
qa-inspector의 **릴리스 게이트 통과** 후에만 최종 배포 단계로 진행한다.

## 모노레포 빌드 (Turborepo + pnpm — 목표 Phase 2~3)

> **현행(Phase 1)은 단일 Docker가 정상이다** — `apps/web`+`apps/api` 단일 compose. 아래는 `packages/`·`turbo.json`이 도입되는 Phase 2~3의 빌드 형태(`architecture.md` §8). 신규 서비스를 붙이거나 모노레포화를 실행할 때 적용한다.

- **빌드 컨텍스트 = 워크스페이스 루트** (앱 폴더가 아님). 앱이 `packages/ui`·`packages/contracts`를 의존하므로 루트에서 빌드해야 패키지가 해석된다. `pnpm install --frozen-lockfile` 후 `turbo run build`.
- **codegen 선행:** `contracts#generate`(백엔드 발행 `openapi.json` → orval 클라이언트)를 **`web#build`의 선행**으로 `turbo.json` `dependsOn`에 건다. codegen 누락 시 web 타입이 깨지므로 빌드 순서로 강제.
- **캐시:** 변경된 패키지만 재빌드(turbo 원격/로컬 캐시). CI에서도 동일 파이프라인.
- **신규 서비스(`apps/<svc>`):** compose에 서비스·헬스체크 추가, `turbo` 파이프라인에 build·lint·typecheck·test 등록(`architecture.md` §7).
- **Dockerfile:** 루트 컨텍스트 기준으로 해당 앱 + 의존 패키지만 복사하는 멀티스테이지(pnpm `--filter`로 서비스별 deploy prune 활용).

## 구성 요소

### 1. 멀티스테이지 Dockerfile

**`apps/api/Dockerfile` (NestJS):**
- 핀된 베이스(예: `node:20-alpine`). deps → build → runtime 3스테이지.
- Prisma client 생성(`prisma generate`)을 build 스테이지에.
- runtime은 빌드 산출물 + prisma 스키마만 복사.

**`apps/web/Dockerfile` (Next.js):**
- `output: 'standalone'`(next.config) 활용해 runtime 이미지 최소화.
- build 시 `NEXT_PUBLIC_*` 빌드타임 환경변수 주입.

각 앱에 `.dockerignore` (node_modules, .next, .git, _workspace 등 제외).

### 2. docker-compose.yml
서비스: `db`(postgres), `api`, `web`. 핵심:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment: [POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER"]
      interval: 5s
      retries: 10
  api:
    build: ./apps/api
    depends_on:
      db: { condition: service_healthy }
    environment: [DATABASE_URL, JWT_SECRET, ...]
    # 기동 시: prisma migrate deploy → node dist/main
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/v1/health"]
  web:
    build: ./apps/web
    depends_on:
      api: { condition: service_healthy }
    environment: [NEXT_PUBLIC_API_URL]
volumes: { pgdata: {} }
```

### 3. 기동 순서 (마이그레이션 안전)
- `db` healthy → `api`가 **`prisma migrate deploy` 먼저** 실행 후 서버 기동 → `web`.
- 마이그레이션은 런타임 진입점(entrypoint 스크립트)에서 분리 실행. 실패 시 기동 중단(컨테이너 exit).
- `api`에 `/api/v1/health` 엔드포인트가 없으면 backend-engineer에게 추가 요청.

### 4. 환경변수 (.env.example)
실제 시크릿은 커밋하지 않는다. 템플릿만 제공:
```
POSTGRES_USER=eval
POSTGRES_PASSWORD=change-me
POSTGRES_DB=eval
DATABASE_URL=postgresql://eval:change-me@db:5432/eval
JWT_SECRET=change-me
NEXT_PUBLIC_API_URL=http://localhost:3000
```
> **포트 매핑 주의:** compose에 각 서비스의 `ports:`를 명시한다. web·api 컨테이너 내부 포트가 같으면(둘 다 3000) 호스트 매핑을 분리한다(예: web `3000:3000`, api `4000:3000`). `NEXT_PUBLIC_API_URL`은 **브라우저에서 도달 가능한** 공개 주소(호스트:포트 또는 리버스 프록시 경로)여야 한다 — 컨테이너 네트워크 전용 호스트명(`api`/`db`)이 아니다. 위 healthcheck의 `localhost:3000`은 api 컨테이너 *내부* 기준이라 무관하다.

### 5. 로컬 검증 (스모크 테스트)
`docker compose up --build`로 전체 스택 기동 후:
- [ ] 세 컨테이너 모두 healthy
- [ ] `GET /api/v1/health` 200
- [ ] web 접속 → 로그인 화면 렌더
- [ ] 로그인 → 평가 1건 생성·제출 흐름 동작
- [ ] 마이그레이션이 실제 테이블 생성 확인

### 6. 배포·롤백 런북
`_workspace/06_release/RELEASE.md`에 기록:
- 배포 절차: 빌드 → 이미지 태그(버전) → compose 적용 → 헬스 확인
- 롤백: 직전 이미지 태그로 재기동, 마이그레이션 롤백 주의사항(파괴적 마이그레이션은 다운 마이그레이션 또는 백업 복원)
- 환경변수 목록, 포트 매핑, 볼륨/백업 정책

## 작성 원칙
- **재현성:** 핀된 베이스 이미지, 멀티스테이지, .dockerignore.
- **안전한 마이그레이션:** 기동 전 분리 실행, 실패 시 중단.
- **헬스체크 필수:** depends_on + condition: service_healthy로 순서 보장.
- **시크릿 비노출:** .env.example만, 실제 값은 배포 환경에서 주입.

## 산출물
- 레포 루트/앱별: `Dockerfile`, `docker-compose.yml`, `.env.example`, `.dockerignore`
- `_workspace/06_release/RELEASE.md` — 빌드·배포·롤백 런북 + 스모크 체크리스트

## 흔한 실수 (피한다)
- 마이그레이션을 기동과 동시 실행 → 레이스/부분 적용
- 헬스체크 누락 → web이 api 준비 전 기동되어 초기 요청 실패
- 시크릿 커밋 → 보안 사고
- standalone 미사용 → web 이미지 비대
