# RELEASE — 인사평가 솔루션(GrowthX) M1 Docker 배포 런북

> 작성: release-engineer · 2026-06-02 · 마일스톤 M1(기반 수직 슬라이스)
> 입력 게이트: `_workspace/05_qa/qa-report-m1.md` (조건부 통과 — Blocker 0, 빌드검증필요 표기)
> 스택: Postgres 16 + NestJS(api) + Next.js(web), Docker 자체 호스팅, npm workspaces 모노레포

---

## ⚠️ 선결 조건 — 최초 배포 시 반드시 빌드·스모크 1회 수행

**이 구성은 Node/Docker 미설치 환경에서 작성되어 `docker compose up --build` 스모크를 실행하지 못했다.**
Dockerfile/compose 문법·경로·포트·의존성은 소스 구조와 대조해 정합을 맞췄으나, **실제 빌드는 미검증**이다.
최초 배포 전 아래 "빌드 실패 가능 지점" 체크리스트를 통과시키고 스모크 체크리스트를 1회 완주할 것.

### 빌드 실패 가능 지점 (최초 배포 전 점검)
- [ ] **prisma generate 선행** — `apps/api/Dockerfile` build 스테이지에서 `prisma generate` 후 `nest build`. 순서 어긋나면 `@prisma/client` 타입 미해결로 빌드 실패(QA V-1).
- [ ] **마이그레이션 부재 → db push 경로** — `apps/api/prisma/migrations/` 디렉터리가 **현재 존재하지 않는다(schema.prisma + seed.ts 만)**. 따라서 entrypoint 는 `migrate deploy` 가 아니라 `prisma db push` 로 스키마를 반영한다. `group_performance`·`grade_pool`·`evaluation_result`·`appeal`·`compensation`·`notification` 등 모든 테이블이 db push 로 생성됨을 확인할 것. **운영 전환 시 `prisma migrate dev` 로 마이그레이션을 생성·커밋해 `migrate deploy` 경로를 쓰는 것을 강력 권장**(db push 는 마이그레이션 이력이 없어 롤백·드리프트 추적 불가).
- [ ] **v2 seed(순수 KPI/성과 도메인)** — seed.ts 가 조직 트리(그룹→본부→팀), RuleSet 2026(gradeScale·gradingScales 측정방식별·poolRatios·raiseRates·weightPolicy), KPI 양식(jobLevel별 category/group), GroupPerformance·GradePool, 데모 KPI(amount·count)를 넣는다. **역량(competency) 시드는 없다**(v2에서 폐기).
- [ ] **web standalone 산출물 경로** — `next.config.mjs` 에 `output:'standalone'` 설정됨(확인). monorepo standalone 은 `apps/web/.next/standalone/apps/web/server.js` 구조를 만든다. Dockerfile CMD `node apps/web/server.js` 가 이 경로와 일치해야 함. 빌드 후 경로 어긋나면 CMD 수정 필요.
- [ ] **NEXT_PUBLIC 주입 시점** — `NEXT_PUBLIC_API_URL` 은 **빌드 시점**에 번들로 인라인된다. compose `web.build.args` 로 전달되며 런타임 env 변경으로는 바뀌지 않는다. 값 변경 시 **web 이미지 재빌드 필수**.
- [ ] **public 디렉터리** — 원래 `apps/web/public` 가 없어 Docker COPY 실패를 막기 위해 `public/.gitkeep` 을 추가했다. 정적 자산을 추가해도 동일 경로 사용.
- [ ] **Prisma 엔진 바이너리(alpine/musl)** — `prisma generate` 가 build 스테이지(node:20-alpine, musl)에서 실행되어 `linux-musl` 쿼리 엔진이 생성되고, 동일 musl runtime 으로 node_modules 가 복사되므로 정합한다. 다른 베이스(예: debian-slim)로 바꾸면 `schema.prisma` generator 에 `binaryTargets` 추가 필요. alpine 에서 OpenSSL 관련 엔진 오류 시 `apk add --no-cache openssl libc6-compat` 를 runtime 에 추가.
- [ ] **package-lock.json** — 루트에 lockfile 이 있으면 `npm ci`(재현성), 없으면 `npm install` 로 폴백한다. **재현 가능한 빌드를 위해 `package-lock.json` 커밋을 권장**.
- [x] **QA 조건부 항목 — 수정 웨이브에서 해소됨** — B-1/B-2(nullable 정합: FE 타입 `| null`+가드), D-1(KPI 코멘트: approve `{comment?}`→Review 영속화, FE 와이어링 완료), E-1(목록 행수준 필터 추가)이 모두 처리됨. 스모크에서 회귀만 확인하면 된다.

---

## 1. 구성 파일

| 경로 | 역할 |
|------|------|
| `docker-compose.yml` | db→api→web 오케스트레이션, healthcheck, 포트, 볼륨 |
| `.env.example` | 환경변수 템플릿(시크릿 미포함) |
| `.dockerignore`(루트) | 빌드 컨텍스트 최소화 — **context 가 루트(`.`)라 이 파일이 적용됨** |
| `apps/api/Dockerfile` | NestJS 멀티스테이지(deps→build→runtime), node:20-alpine 핀 |
| `apps/api/docker-entrypoint.sh` | 스키마 적용(db push/migrate deploy) 후 `node dist/main` |
| `apps/api/.dockerignore` | `docker build apps/api` 직접 빌드 시 사용 |
| `apps/web/Dockerfile` | Next.js standalone 멀티스테이지 |
| `apps/web/.dockerignore` | web 직접 빌드 시 사용 |

> compose 의 두 서비스 모두 **build context 가 레포 루트(`.`)**, dockerfile 만 앱별 지정. npm workspaces 라 루트 + 워크스페이스 매니페스트가 함께 필요하기 때문. 따라서 실효 무시 규칙은 **루트 `.dockerignore`**.

---

## 2. 기동 순서 (마이그레이션 안전)

```
db (postgres:16-alpine)
  └─ healthcheck: pg_isready  → healthy
       └─ api  (depends_on db: service_healthy)
            └─ entrypoint: prisma db push|migrate deploy  (실패 시 컨테이너 exit, 기동 중단)
                 └─ node dist/main  → /api/v1/health 200 → healthy
                      └─ web (depends_on api: service_healthy)
                           └─ node apps/web/server.js → / 200 → healthy
```

- 스키마 적용은 entrypoint 에서 **서버 기동과 분리** 실행, `set -e` 로 실패 시 즉시 중단(부분 적용 방지).
- `/api/v1/health` 는 `@Public` + 글로벌 프리픽스 `api/v1` 로 인증 없이 200 반환(확인).

---

## 3. 포트 매핑

| 서비스 | 컨테이너 내부 | 호스트(기본) | env 변수 | 비고 |
|--------|--------------|--------------|----------|------|
| web | 3000 | **3000** | `WEB_PORT` | 브라우저 진입점 |
| api | 3000 | **4000** | `API_PORT` | `PORT=3000` 으로 내부 고정(main.ts 기본 4000 → env 로 3000 강제) |
| db | 5432 | 5432 | `POSTGRES_PORT` | 디버깅용; 운영에선 매핑 제거 권장 |

- web·api 컨테이너 내부 포트가 둘 다 3000 이라 **호스트에서 분리**(3000 / 4000)해 충돌 방지.
- `NEXT_PUBLIC_API_URL` 은 호스트 기준 api 주소(로컬 `http://localhost:4000`). **컨테이너 호스트명 `api` 아님** — 브라우저가 도달 가능한 공개 주소여야 함.

---

## 4. 환경변수

| 변수 | 사용처 | 비고 |
|------|--------|------|
| `POSTGRES_USER/PASSWORD/DB` | db | DATABASE_URL 과 일치 |
| `POSTGRES_PORT` | compose | 호스트 노출 포트 |
| `DATABASE_URL` | api | `postgresql://USER:PW@db:5432/DB?schema=public` — 내부망 호스트 `db` |
| `JWT_SECRET` | api(access) | 미설정 시 코드 폴백값 사용되므로 **반드시 주입** |
| `JWT_REFRESH_SECRET` | api(refresh) | auth.service 에서 사용. **반드시 주입** |
| `JWT_ACCESS_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN` | api | 선택(기본 3600s / 7d) |
| `RUN_SEED` | api entrypoint | `true` 시 1회 데모 시드. 기본 `false` |
| `NEXT_PUBLIC_API_URL` | **web 빌드타임** | build-arg. 값 변경 시 web 재빌드 |
| `WEB_PORT`/`API_PORT` | compose | 호스트 포트 매핑 |

실제 시크릿은 `.env`(gitignore 제외) 또는 배포 환경 시크릿 매니저로 주입. `.env.example` 만 커밋.

---

## 5. 배포 절차

```bash
# 0) 준비
cp .env.example .env          # 실제 시크릿 채우기 (특히 JWT_*, POSTGRES_PASSWORD)

# 1) 빌드 + 기동 (최초 — NEXT_PUBLIC_API_URL 이 build-arg 로 web 에 인라인됨)
docker compose build
docker compose up -d

# 2) 헬스 확인
docker compose ps            # db/api/web 모두 (healthy) 인지
curl -fsS http://localhost:4000/api/v1/health   # {"status":"ok",...}
curl -fsS http://localhost:3000/                # web 200

# 3) (최초 1회) 데모 시드 — 둘 중 택1
#  a) RUN_SEED=true 로 api 재기동(entrypoint 가 seed 시도; ts-node 미포함 시 실패 가능)
#  b) 권장: 일회성 컨테이너로 시드(devDeps 포함 build 스테이지 이용)
docker compose run --rm --no-deps -e RUN_SEED= api \
  sh -lc "npx prisma db seed --schema=./prisma/schema.prisma"
#  ※ 런타임 이미지에 ts-node 가 없으면 seed(ts-node 실행) 실패 → 아래 6.시드 주의 참고
```

### 버전 태깅 (운영)
```bash
docker compose build
docker tag growthx-api:latest registry.example.com/growthx-api:$(git rev-parse --short HEAD)
docker tag growthx-web:latest registry.example.com/growthx-web:$(git rev-parse --short HEAD)
docker push registry.example.com/growthx-api:<tag>
docker push registry.example.com/growthx-web:<tag>
```

---

## 6. 시드(seed) 주의

- `seed.ts` 는 **ts-node 실행**(devDependency), entrypoint 의 스키마 적용은 **prisma CLI**(devDependency) 가 필요하다.
- 따라서 **runtime 이미지는 devDeps 를 prune 하지 않고 전체 `node_modules` 를 운반한다**(prisma·ts-node 가용성 우선). 그 결과 `RUN_SEED=true` 경로로도 시드가 동작할 수 있다.
- 트레이드오프: runtime 이미지가 커진다(devDeps 포함). **후속 개선**: prisma 엔진만 남기고 seed 를 컴파일된 JS 로 만들어 슬림화(미구현 — 미검증 항목).
- **권장 시드 방법**: 최초 1회 `RUN_SEED=true` 로 api 기동하거나, 일회성 `docker compose run --rm api npx prisma db seed`.
- 데모 계정(seed 결과, 비번 공통 `Passw0rd!`):
  - `hr@energyx.co.kr` (hr_admin) / `division@energyx.co.kr` / `lead@energyx.co.kr` / `senior@energyx.co.kr` / `pro@energyx.co.kr`

---

## 7. 롤백

```bash
# 직전 이미지 태그로 재기동
docker compose down                      # 볼륨(pgdata)은 유지됨(-v 금지)
# compose 가 참조하는 이미지 태그를 직전 버전으로 교체 후
docker compose up -d
```

- **마이그레이션 주의**: 파괴적 스키마 변경(컬럼/테이블 삭제)을 동반한 릴리스는 단순 이미지 롤백으로 데이터가 복구되지 않는다. 배포 전 **`docker exec <db> pg_dump`** 로 백업하고, 롤백 시 다운 마이그레이션 또는 백업 복원.
- 현재 M1 은 마이그레이션 이력이 없고 `db push` 경로라 **롤백 추적 불가** — 운영 전 마이그레이션 도입 필수(위 선결 조건 참조).

---

## 8. 볼륨 / 백업

- 영속 볼륨: `pgdata`(Postgres 데이터). `docker compose down -v` 는 **데이터 삭제**이므로 운영에서 금지.
- 백업: `docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%F).sql`
- 복원: `cat backup.sql | docker compose exec -T db psql -U $POSTGRES_USER -d $POSTGRES_DB`

---

## 9. 스모크 체크리스트 (최초 배포 시 1회 필수)

- [ ] `docker compose build` 성공 (api·web 멀티스테이지 모두)
- [ ] `docker compose up -d` 후 **세 컨테이너 모두 `healthy`** (`docker compose ps`)
- [ ] `GET http://localhost:4000/api/v1/health` → **200** `{"status":"ok"}`
- [ ] web `http://localhost:3000/` 접속 → **로그인 화면 렌더**
- [ ] 데모 계정 로그인 성공 (`hr@energyx.co.kr` / `Passw0rd!`) — **seed 데모계정 로그인**
- [ ] 로그인 → **평가 1건 흐름**(평가 조회/제출 또는 KPI 1건) 동작
- [ ] DB 에 **마이그레이션/스키마 테이블 생성** 확인 (`docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\dt"` → users·kpi·evaluation·group_performance·grade_pool·appeal·compensation 등)
- [ ] (시드 실행 시) 조직 트리(그룹→본부→팀), RuleSet 2026 기본값(gradingScales 포함), 데모 사용자 5역할, GroupPerformance·GradePool 존재

---

## 10. 미검증(빌드 필요) 항목 — 요약

| 항목 | 상태 | 사유/대응 |
|------|------|----------|
| `docker compose up --build` 전체 스모크 | **미실행** | 개발 환경 Node/Docker 미설치. 최초 배포 시 §9 완주 필요 |
| api 멀티스테이지 빌드(prisma generate + nest build) | 미검증 | QA V-1 — generate 선행 순서는 Dockerfile 에 반영 |
| web standalone 산출물 경로(`apps/web/server.js`) | 미검증 | monorepo standalone 경로 가정. 빌드 후 경로 불일치 시 CMD 수정 |
| 스키마 적용 경로(db push) | 미검증 | migrations 디렉터리 부재 → db push 폴백. 운영 전 마이그레이션 도입 권장 |
| seed 실행(ts-node) | 미검증 | runtime 이 devDeps(ts-node·prisma) 유지 → 동작 기대. 실제 실행은 미검증. §6 |
| package-lock.json 유무 | 미확인 | 없으면 `npm install` 폴백(재현성↓). 커밋 권장 |
| QA 조건부 결함(B-1/B-2/D-1/E-1) | **해소됨** | 수정 웨이브 완료(FE nullable 가드·BE approve 코멘트·행수준 필터). 스모크에서 회귀 확인만 |
```
