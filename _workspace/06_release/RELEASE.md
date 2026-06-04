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

---
---

# M2 — 신규 4기능 + RuleSet 완전연결 + 미완기능 완성 (Docker 런타임 실증)

> 작성: release-engineer · 2026-06-04 · 마일스톤 M2
> 검증 환경: **실제 Docker 빌드·기동 완료**(Docker 29.5.2 / Compose v5.1.4, Server OSType linux). M1 의 "미검증" 한계는 본 M2 라운드에서 **end-to-end 실증으로 해소**.
> 기존 docker/compose 구조 유지(db→api→web, entrypoint db push 폴백, web 빌드타임 `API_PROXY_TARGET` 프록시). 변경은 api Dockerfile **2줄(nested node_modules 복원/병합)** 만.

## M2-1. 빌드 결과

- `docker compose build` → **api·web 양쪽 이미지 빌드 성공**(`growthx-api:latest`·`growthx-web:latest`).
- `prisma generate` build 스테이지 선행 정상(Prisma Client v5.22.0 생성). alpine libssl 경고는 무해(런타임 `apk add openssl` 로 해소).
- 신규 npm 의존성 `exceljs`·`nodemailer`·`@types/nodemailer` 설치 확인 — 단, **결함 R-M2-1 발견·수정**(아래).

### 결함 R-M2-1 (Blocker, 수정 완료) — nodemailer 모듈 미해결로 api 빌드 실패
- **증상:** `nest build` 단계에서 `src/modules/notifications/mail.service.ts:2 TS2307: Cannot find module 'nodemailer'` 로 api 이미지 빌드 실패.
- **원인:** `package-lock.json` 상 `nodemailer`·`@types/nodemailer` 는 버전 de-dup 으로 **루트가 아닌 `apps/api/node_modules/` 에 nested 설치**된다(`exceljs` 는 루트 `node_modules` 로 hoist 되어 영향 없었음). build 스테이지의 `COPY apps/api ./apps/api`(빌드 컨텍스트엔 `.dockerignore` 로 node_modules 제외) 가 deps 단계의 `apps/api/node_modules` 를 덮어써 nested 패키지가 소실 → 컴파일·런타임 require 실패.
- **수정(`apps/api/Dockerfile`, 최소 변경 2줄):**
  - build 스테이지: `COPY apps/api ./apps/api` **직후** `COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules` 로 nested 트리 복원(nest build 가 워크스페이스 nested 모듈 해소).
  - runtime 스테이지: `COPY --from=build /repo/apps/api/node_modules ./node_modules` 로 nested 패키지를 `/app/node_modules` 에 **병합**(런타임은 `/app/dist/src/main` 에서 실행 → `require('nodemailer')` 가 `/app/node_modules` 를 탐색하므로 거기에 있어야 해소됨).
- **재빌드 결과:** 양 이미지 빌드 성공, 런타임 nodemailer require 정상(MailService dev-fallback 로그로 실증).
- **후속 권장:** 재현성·이미지 슬림화를 위해 `nodemailer` 의존 버전 정렬로 루트 hoist 유도 검토(현 수정으로도 정상 동작·재현 가능).

## M2-2. 기동 & 스키마(db push) 결과

- `docker compose up -d` → **db·api·web 3 컨테이너 모두 `healthy`**(depends_on service_healthy 순서 보장).
- entrypoint 로그: `no migrations found -> prisma db push (schema sync)` → **신규 스키마 자동 반영 확인**.
- **db push 로 생성된 신규 테이블/컬럼(실측 `psql \dt`/`\d`):**
  - 신규 테이블 `cycle_schedules`, `audit_logs`
  - 신규 컬럼 `evaluations.overall_grade`(enum `Grade`), `evaluations.overall_reason`(text), `evaluation_results.by_group`(jsonb)
- **seed(`RUN_SEED=true`) → `✅ Seed 완료`.** clean 볼륨 기준 실측 행수: `cycle_schedules=5`, `audit_logs=2`, `notifications=3`, `users=5`, `kpi_templates=2`, `rule_sets=1`(주기 연결).
  - 주의(운영 무관): seed.ts 는 **비멱등**(User email unique). 기존 `pgdata` 볼륨 위에서 `RUN_SEED=true` 재기동 시 `Unique constraint (email)` 으로 seed 가 중단되고 entrypoint 가 이를 흡수(`|| echo skipped`)한 뒤 정상 기동된다. 그 경우 seed 후반의 신규 데이터(cycle_schedules 등)가 안 들어가므로, **M2 데모 데이터 완전 적재는 clean 볼륨(`down -v`) 1회 seed** 로 보장했다. 운영에선 `RUN_SEED=false` 고정.

## M2-3. HTTP 스모크(런타임 실증) — 전 항목 PASS

| # | 검사 | 결과 |
|---|------|------|
| 1 | `GET /api/v1/health` | **200** `{data:{status:"ok",timestamp}}` |
| 2 | 데모 로그인 `hr@energyx.co.kr`/`Passw0rd!` | **200**, accessToken·refreshToken 발급 |
| 3 | `GET /api/v1/dashboard/summary`(인증) | **200**, 위젯 필드(cycleId·cycleStatus·progress.self/downward1/downward2·gradeDistribution.company/byGroup·appeals·avgRaiseRate) |
| 4 | `GET /api/v1/notifications` / `/unread-count` | **200** `{data,meta}` / **200** `{data:{count}}` (사용자 스코프 정상) |
| 5 | `GET /api/v1/audit-logs` | **200** `{data:[…],meta}` (cycle.schedule.update 감사로그 포함) |
| 6 | `GET /api/v1/excel/template/templates` | **200**, `content-type: …spreadsheetml.sheet`, **봉투 없음**(raw xlsx, PK 매직바이트, 8778B) |
| 7 | `GET /api/v1/excel/export/results` | **200**, xlsx, PK 매직, 6547B |
| 8 | `GET /api/v1/cycles` → `:id/schedules` | **200**/**200** (schedules 5행: phase·dueDate·notifyOffsets·targetDeptIds) |
| 9 | `GET /api/v1/kpi-templates` | **200** (jobLevel·items 포함) |
| 10 | web `GET /login` | **200**, "에너지엑스 인사 평가" 렌더 |
| 11 | web `/dashboard`·`/notifications`·`/admin/audit`(미인증) | **200**(SSR 셸) — **클라이언트 사이드 인증 가드**: 셸 HTML 에 보호 데이터 미노출(9KB 셸), 브라우저 JS 가 토큰 없으면 `/login` 리다이렉트 |
| 12 | web→api **same-origin 프록시** `GET /api/v1/health` | **200** (Next rewrite → `http://api:3000` 정상) |
| 13 | **SMTP 콘솔 폴백** `POST /notifications/generate`(kind=d7) | **201** `{count:5,emailMode:"console"}`, MailService `[MAIL:dev-fallback] to=…` 5건 로그, **크래시 없음** |
| 14 | 알림 end-to-end | generate 후 hr unread-count **0→1**, 목록에 d7 알림 반영 |

> #11 인증 가드: 미인증 요청에도 페이지 HTTP 200 인 것은 정상이다(Next App Router 클라이언트 컴포넌트 가드 — SSR 은 빈 셸을 반환하고, 보호 데이터는 토큰이 있어야 클라이언트 fetch 로 채워짐). 셸 HTML 에 평가/감사 데이터가 인라인되지 않음을 확인.

## M2-4. SMTP 폴백 동작 확인

- `.env` 에 `SMTP_*` **미설정** 상태로 기동 → MailService 가 **콘솔 폴백 모드**(`emailMode:"console"`)로 동작, 발송 대상별 `[MAIL:dev-fallback] to=… subject=…` 로그만 남기고 **예외/크래시 없음**.
- `SMTP_HOST` 등을 주입하면 nodemailer 실발송 경로로 전환(코드 분기 존재). 미설정 시 크래시 금지 요구사항 충족.
- `.env.example`(루트)·`apps/api/.env.example` 모두 `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` 키 **존재 확인**(주석 처리된 템플릿) — 추가 작업 불필요.

## M2-5. 운영 전 체크리스트 (배포 게이트)

- [ ] **시크릿 교체** — `JWT_SECRET`·`JWT_REFRESH_SECRET`·`POSTGRES_PASSWORD`(및 `DATABASE_URL` 동기화)를 강한 운영 값으로. 현 `.env` 는 smoke 전용(`smoke-test-*`).
- [ ] **`RUN_SEED=false`** — 데모 시드 비활성(현재 smoke 위해 true). 운영 DB 에 데모 계정/데이터 유입 금지.
- [ ] **SMTP 실값 주입** — 실제 이메일 발송 필요 시 `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` 설정. 미설정 시 콘솔 폴백(발송 안 됨)으로 동작함을 인지.
- [x] **마이그레이션 도입(완료, M2.5)** — 베이스라인 `init` 마이그레이션 생성·커밋, entrypoint 를 `migrate deploy` 로 전환. 상세는 §M2-7. `db push` 폴백 폐기.
- [ ] **DB 외부 포트(5432) 차단** — compose `db.ports` 매핑 제거(디버깅용).
- [ ] **`.env` 비커밋 유지** — `.gitignore` 에 `.env` 포함 확인됨(커밋 금지). 사내 기밀 `인사 평가 시스템 참고용/` 도 비커밋.
- [ ] **web 이미지 재빌드 규칙** — `API_PROXY_TARGET` 은 빌드타임 인라인. 변경 시 web 재빌드.

## M2-6. 남은 한계

- ~~`db push` 경로(마이그레이션 이력 없음)~~ → **해소(§M2-7)**: 베이스라인 `init` 마이그레이션 이력화·`migrate deploy` 전환.
- seed.ts 비멱등 — 기존 볼륨 위 재시드 시 부분 실패(흡수됨). 운영은 `RUN_SEED=false` 이므로 영향 없음.
- 런타임 이미지에 devDeps(prisma CLI·ts-node) 포함 유지(entrypoint db push·seed 가용성 우선) → 이미지 슬림화는 후속 개선.
- excel `import/*`·`PATCH /rule-sets/:id`(전필드)·`kpi-templates` CRUD 쓰기 경로는 라우트 매핑·인증 가드까지 실증했으나, 본 스모크는 읽기/생성 중심 — 대량 import 회귀는 QA 통합 시나리오에서 추가 검증 권장.

---

## M2-7. 마이그레이션 이력화 (`db push` → `prisma migrate deploy`)

**배경:** M1·M2 동안 entrypoint 가 `prisma db push` 폴백으로 `schema.prisma` 를 직접 반영해 왔다(마이그레이션 디렉터리 부재). 운영 데이터가 없는 데모/seed 단계에서 베이스라인 마이그레이션을 생성하고 배포 기동을 `migrate deploy` 로 전환했다.

### 생성된 마이그레이션
- 경로: `apps/api/prisma/migrations/20260604001028_init/migration.sql`
- 락 파일: `apps/api/prisma/migrations/migration_lock.toml` (`provider = "postgresql"`)
- 생성 방식: `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` (실행 중인 운영 스택 미접속 — 안전). 적용 검증은 아래 클린 볼륨 기동에서 `migrate deploy` 로 실증.
- 내용 요약(전체 schema = M2 포함): **20 테이블**(users…notifications + `cycle_schedules`·`audit_logs`), **15 enum**, **34 FK**, 모든 `@@unique`/`@@index`, snake_case `@map` 컬럼 정확. M2 신규 컬럼 `evaluations.overall_grade`/`overall_reason`, `evaluation_results.by_group` 포함 확인.

### entrypoint 변경 (`apps/api/docker-entrypoint.sh`)
- `db push` 폴백 **삭제**. 항상 `npx prisma migrate deploy --schema=./prisma/schema.prisma`.
- 마이그레이션 디렉터리가 비어 있으면(이미지 COPY 누락 등) `exit 1` 로 **즉시 중단**(부분 적용 방지·안전망).
- seed 순서 유지: `migrate deploy` → (`RUN_SEED=true` 시) seed. `RUN_SEED` 플래그 동작 불변.
- **Dockerfile 변경 없음** — `COPY --from=build /repo/apps/api/prisma ./prisma`(L48)가 `prisma/migrations` 하위까지 통째로 런타임 이미지에 복사. `.dockerignore` 도 migrations 미제외. 이미지 내 `/app/prisma/migrations/20260604001028_init/migration.sql` 존재 확인.

### 클린 볼륨 재검증 (실행 결과: PASS)
1. `docker compose down -v` (pgdata 볼륨 삭제) → `docker compose build api` → `RUN_SEED=true docker compose up -d`.
2. api 로그: `prisma migrate deploy` → `1 migration found` → `Applying migration 20260604001028_init` → `All migrations have been successfully applied.` → `✅ Seed 완료` → API 기동.
3. `_prisma_migrations` 테이블에 `20260604001028_init` (applied=t) 1행 — 이력 추적 확립.
4. db·api·web **3 컨테이너 모두 healthy**.

### 스모크(축약) — 전부 PASS
| # | 항목 | 결과 |
|---|------|------|
| 1 | `GET /api/v1/health` | **200** `{status:"ok"}` |
| 2 | 데모 로그인 `POST /auth/login`(hr@energyx.co.kr) | **200**, `accessToken` 발급 |
| 3 | `GET /api/v1/audit-logs` (M2 테이블) | **200** (`audit_logs` 2행 실재) |
| 4 | `GET /api/v1/dashboard/summary` (M2) | **200** |
| 5 | web `GET /login` | **200** |
| 6 | M2 테이블 실재 | `audit_logs`·`cycle_schedules`(5행) psql 카운트 확인 |

### 향후 스키마 변경 절차 (표준화)
1. **로컬:** `schema.prisma` 수정 후 깨끗한 로컬/도커 postgres 대상으로
   `cd apps/api && npx prisma migrate dev --name <변경요약>`
   → `prisma/migrations/<ts>_<name>/migration.sql` 생성·로컬 적용·client 재생성.
2. **검토·커밋:** 생성된 `migration.sql` 을 리뷰(파괴적 변경 여부·데이터 보존)하고 **migrations 디렉터리를 커밋**.
3. **배포:** 이미지 재빌드 → 기동 시 entrypoint 의 `prisma migrate deploy` 가 **미적용분만** 순서대로 자동 적용. 마이그레이션 누락 시 컨테이너 `exit 1`.
4. **롤백:** 파괴적 마이그레이션은 다운 마이그레이션이 자동 생성되지 않으므로, 배포 전 **DB 백업** 필수. 롤백 시 직전 이미지 태그로 재기동 + 백업 복원(또는 보정 마이그레이션 전진 적용). 비파괴적 추가(컬럼·테이블 add)는 직전 이미지로 재기동만으로 호환되는 경우가 많음.

> **주의:** `migrate dev` 는 로컬 전용(개발 DB 리셋 가능). 운영/CI 기동 경로에서는 **절대 `migrate dev` 를 쓰지 않는다** — `migrate deploy` 만 사용. `db push` 는 폐기(스키마 프로토타이핑 한정).

---

## M3 Items1-3 — 실 117명 명부 교체 배포 (2026-06-04, release-engineer 검증)

### 결정/범위
- **데이터 교체(사용자 결정):** 데모 평가 주기/결과/보상/감사 등 평가 트랜잭션 데이터는 **전량 폐기**, 조직/인원만 실 명부로 신규 적재. 평가 도메인 **코드는 유지**.
- 권위 입력: `에너지엑스_임직원명부(조직도연동).xlsx`(컬럼 그룹|본부|팀|직급|이름|이메일, 117행).
- M3 신규 마이그레이션 `20260604120000_m3_items1_3`(additive: `User.mustChangePassword·visibilityScope·isActive·currentSalary`, `Position` enum 확장, `VisibilityScope` enum, `KpiCategoryPolicy` 등 모델).

### 빌드·기동·마이그레이션 (전부 PASS)
1. `docker compose down -v` — 기존 M2 스택·`pgdata` 볼륨 제거(데모 평가데이터 폐기).
2. `docker compose build` — `growthx-api`·`growthx-web` 재빌드 성공.
3. `RUN_SEED=true docker compose up -d` — db→api→web 순차 기동. **세 컨테이너 모두 healthy.**
4. entrypoint `prisma migrate deploy`: `20260604001028_init` + `20260604120000_m3_items1_3` **2건 적용 성공**("All migrations have been successfully applied").
5. 시드: 부트스트랩 hr_admin(`hr@energyx.co.kr`) + `KpiCategoryPolicy` 기본 10행 생성("✅ Seed 완료"). 전 모듈(OrgChart·KpiCategoryPolicy 포함) 정상 init.

### 실 117명 교체 임포트 (PASS — 데이터 교체 핵심)
- 부트스트랩 hr_admin 로그인 → `POST /api/v1/excel/import/roster`(multipart, field `file`)로 xlsx 업로드.
- 응답 **201** `{ validCount: 117, errorCount: 0, imported: 117, ok: true }`.
- **주의(클린 교체 처리):** 현 시드는 부트스트랩 전용이 아닌 **풀 데모 시드**라 데모 조직/25명·평가 트랜잭션이 함께 생성됨. 사용자의 "교체" 결정에 맞춰 임포트 후 **데모 전용 데이터를 트랜잭션으로 일괄 폐기**함:
  - 평가 트랜잭션 테이블 전량 `TRUNCATE ... CASCADE`(cycles·evaluations·results·compensations·kpis·grade_pools·audit_logs·notifications 등).
  - 데모 시드 사용자(`mustChangePassword=false`) 삭제, **부트스트랩 hr_admin(`hr@energyx.co.kr`) 1명만 fallback 유지**.
  - 부트스트랩 hr_admin 을 실 임포트 `인사총무팀`으로 재배치 → 데모 전용 부서 서브트리 제거.
- **최종 실 조직 트리(임포트 결과): 그룹 5 / 본부(division) 10 / 팀 24.** (검증: imported 사용자에서 부모로 재귀 집계 → 정확히 5/10/24)
- 사용자 합계 **118** = 실 117 + 부트스트랩 hr_admin 1. `GET /org-chart` 루트 `totalCount=118`.

### end-to-end 스모크 (전부 PASS)
| # | 항목 | 기대 | 결과 |
|---|------|------|------|
| 1 | `GET /api/v1/health` | 200 | **200** `{status:"ok"}` |
| 2 | `GET /api/v1/org-chart`(트리·directCount/totalCount) | 200, 합 = 실인원 | **200**, root `totalCount=118`(실 117 + admin 1) |
| 3 | 임포트 HR 인물 로그인(초기 `1234`) | 토큰 발급(`mustChangePassword:true`) | **201**, 게이트 토큰 |
| 4 | 위 토큰으로 보호 엔드포인트(`/org-chart`) 접근 | 403 FORCE_PASSWORD_CHANGE | **403** `FORCE_PASSWORD_CHANGE` |
| 5 | `POST /auth/change-password`(1234→신규) | 200, 새 토큰(`mustChangePassword:false`) | **201** |
| 6 | 새 비번 토큰으로 `/org-chart` | 200(게이트 해제) | **200**; 구 `1234` 로그인 **401**(거부) |
| 7 | scope 가드: division_head `GET /users` | 본인 본부만, 형제 본부 미포함 | **200**, 본인 division 서브트리만(타 division head·타 본부 사용자 미포함) |
| 8 | KPI 카테고리: pro의 `revenue` 작성 | 422 CATEGORY_NOT_ALLOWED | **422** `CATEGORY_NOT_ALLOWED` |
| 9 | KPI 카테고리: pro의 `development` 작성 | 201 | **201** |
| 10 | web `GET /login` | 200 | **200** |
| 11 | web `GET /org` | 200(가드 동작) | **200** |
| 12 | web `GET /onboarding/password` | 200(가드 동작) | **200** |

> KPI 작성 스모크 주의: `assertKpiWritable(cycleId)` 가 카테고리 게이트보다 선행 → 임시 cycle 1건 생성 후 테스트, 검증 후 cycle·KPI·스모크용 사용자 비번을 **원상복구**(3인 → 초기 `1234`+`mustChangePassword=true`)해 "갓 임포트된" 상태 유지. 잔여 평가 데이터 0건.

### 발견·수정 결함
- **결함 없음(코드 변경 0).** 모든 신규 엔드포인트·게이트·마이그레이션 정상 동작. 타 스트림(Items 4-10) 모듈 불가침.
- 운영 메모(설계상 정상): 현 `seed.ts` 는 부트스트랩 전용이 아닌 **풀 데모 시드**라 클린 교체 시 데모 데이터 사후 폐기가 필요. 향후 `SEED_MODE=bootstrap`(hr_admin+정책만) 옵션을 backend 에 추가하면 교체 절차가 단순화됨 — **후속 개선 항목(backend)**.

### 운영 체크리스트
- [ ] **부트스트랩 admin 비번 즉시 교체:** `hr@energyx.co.kr` 초기 비번 `Passw0rd!` → 운영 비번으로 변경.
- [ ] **데모 hr 계정 비활성 권고:** 실 명부 임포트·실 HR 담당(`인사총무팀`) 온보딩 완료 후 부트스트랩 `hr@energyx.co.kr` 는 `isActive=false` 또는 삭제 권고(임시 부트스트랩 용도).
- [ ] **실 인원 온보딩:** 임포트된 117명은 초기 비번 `1234`+`mustChangePassword=true`. 최초 로그인 시 보호 리소스 접근이 403 FORCE_PASSWORD_CHANGE 로 막히며 `/onboarding/password`(또는 `POST /auth/change-password`)로 변경 후 정상 사용.
- [ ] **시크릿:** `.env`(JWT/DB 시크릿) 비커밋 유지. 운영은 배포 환경 주입.
- [ ] **백업:** 실 데이터 적재 후 `pgdata` 정기 백업 — 파괴적 마이그레이션 전 필수.

### 접속 안내
- web: `http://<host>:3000` (`WEB_PORT`), api: `http://<host>:4000/api/v1` (`API_PORT`).
- **부트스트랩 HR 관리자(fallback):** `hr@energyx.co.kr` / `Passw0rd!` (운영 전 비번 교체·이후 비활성 권고).
- **임포트된 실 계정:** 명부 이메일 / 초기 비번 **`1234`** (최초 로그인 시 강제 비번변경). 예: `인사총무팀` HR `hjin3542@energyx.co.kr` 등.

### 커밋 대상(커밋은 리더)
- 코드 변경 없음 — 본 라운드는 **배포·데이터 교체·검증**. 산출물은 `_workspace/06_release/RELEASE.md`(본 절) 갱신뿐.
- M3 BE 산출물(이미 작업트리 존재, 커밋은 리더): `apps/api/prisma/migrations/20260604120000_m3_items1_3/`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/api/src/modules/excel/*`, `org-chart`·`users`·`kpi-category-policy`·`auth(change-password)` 관련 모듈, `apps/web`(`/org`·`/onboarding/password` 등). `.env`·명부 xlsx(사내기밀)는 **비커밋 유지**.

---

## 실 명부 영구 전환 (2026-06-04, live Docker 볼륨 대상 — 영구화)

이전 라운드 이후 컨테이너 재기동 시 `.env`의 `RUN_SEED=true`로 인해 **데모 시드(사용자 26·부서 11·평가 89·결과 24)가 재생성되어 실 117 명부를 덮은** 상태였다. 이를 실 명부로 **영구 전환**했다(코드/스키마 불가침, 운영 플래그 + DB 데이터만 조작).

### 절차·결과
1. **부트스트랩 admin 로그인 복구** — DB의 `hr@energyx.co.kr` 비번이 시드 기본값과 불일치(이전 데모 중 변경 추정) → api 컨테이너 `bcryptjs`로 `Passw0rd!` 해시 생성 후 `password_hash`·`must_change_password=false`·`is_active=true` 직접 갱신. 로그인 **성공**.
2. **실 117명 임포트** — `POST /api/v1/excel/import/roster`(multipart, host PowerShell `Invoke-RestMethod -Form`로 `localhost:4000` 업로드). 응답 `{ validCount: 117, errorCount: 0, imported: 117, ok: true }`.
   - 임포트 사용자는 `created_at = 2026-06-04 04:58`로 일괄 생성(데모 사용자 `created_at < 2026` 와 명확히 구분). 초기 비번 `1234`·`mustChangePassword=true`.
3. **데모 데이터 제거(단일 트랜잭션)** — `docker compose exec -T db psql` 트랜잭션:
   - 부트스트랩 admin을 **로스터 `인사총무팀`(`b6e0d18d…`)으로 재배치** → 데모 부서 체인 고아화.
   - 데모 트랜잭션 전량 삭제(FK 자식→부모 순): `kpi_scores 336`·`achievements 211`·`comments 69`·`appeals 4`·`evaluation_results 24`·`evaluations 89`·`compensations 24`·`group_performances 2`·`grade_pools 2`·`notifications 17`·`audit_logs 22`·`kpi_template_items 32`·`kpi_templates 8`·`kpis 192`·`cycle_schedules 10`·`evaluation_cycles 2`(monthly_performances·competency_*·reviews 는 0건). 
   - **데모 전용 사용자 25명 삭제**(`created_at < 2026` 중 `hr@energyx.co.kr` 제외).
   - **데모 전용 부서 11개 삭제**(로스터 사용자 부서에서 부모 재귀로 도달 불가한 노드).
   - **보존한 config(데모 아님): `rule_sets 3`(등급·풀·인상률 규칙엔진, cycle_id 전부 NULL=글로벌), `kpi_category_policies 10`(직급별 카테고리 정책).** ← 삭제 시 채점·게이트가 깨지므로 유지.
4. **재시드 차단(영구화)** — `.env` `RUN_SEED=true → RUN_SEED=false`(로컬, **비커밋**). entrypoint(`apps/api/docker-entrypoint.sh`)는 seed 블록 전체를 `if [ "$RUN_SEED" = "true" ]`로 게이트하므로 코드 변경 없이 재시드가 완전 차단됨. **`seed.ts` 코드는 미변경**(다음 빌드 영향 방지).

### 최종 상태(전환 후)
| 항목 | 값 |
|------|----|
| users | **118** (실 117 + 부트스트랩 hr_admin 1) |
| departments | **그룹 5 / 본부 10 / 팀 24** (= 39) |
| 평가 트랜잭션(evaluations·kpis·cycles·compensations·results …) | **0** |
| 보존 config | rule_sets 3, kpi_category_policies 10 |
| 남긴 admin | `hr@energyx.co.kr` / `Passw0rd!`, role=`hr_admin`, `mustChangePassword=false`, 소속=로스터 `인사총무팀` |

### 영속성 검증 (재기동해도 데모 안 돌아옴 — PASS)
- `docker compose up -d --force-recreate api` → api 로그: `prisma migrate deploy` 후 **seed 블록 미실행**(`RUN_SEED` 분기 진입 안 함), 곧장 `starting API server`. healthy.
- 재기동 1: users **118** / depts **39** / evaluations **0** (유지).
- `docker compose restart api` 재기동 2: users **118** / depts **39** / evaluations **0** (유지). **데모 데이터 재생성 없음 확인.**
- **`down -v`(볼륨 삭제) 하지 않음** — `pgdata` 볼륨에 실 명부 영속.

### 스모크 (전부 PASS)
| 항목 | 기대 | 결과 |
|------|------|------|
| `GET /api/v1/health` | 200 | **200** `{status:"ok"}` |
| `GET /api/v1/org-chart`(hr_admin) | 200, totalCount=118, 그룹5/본부10/팀24 | **200**, root `totalCount=118`, 트리 정상(건축설계그룹 등 실 조직) |
| 임포트 HR(`jjh@energyx.co.kr`) 로그인 `1234` | 게이트 토큰(`mustChangePassword:true`) | **201** |
| 위 토큰으로 `/org-chart` | 403 FORCE_PASSWORD_CHANGE | **403** `FORCE_PASSWORD_CHANGE` |
| `POST /auth/change-password`(1234→신규) | 200/새 토큰 | **201** (검증 후 해당 계정 `1234`·`mustChangePassword=true`로 **원상복구** → 갓 임포트 상태 유지) |
| web `/`·`/org` | 307(인증 게이트)·200 | **307 / 200** |

### 운영 메모 — 재기동해도 안 돌아옴을 보장
- **핵심:** `.env`의 `RUN_SEED=false`가 유지되는 한, `docker compose up`/`restart`/`up -d --force-recreate`는 entrypoint에서 `migrate deploy`(멱등·비파괴)만 실행하고 seed를 건너뛴다. 실 명부는 `pgdata` 볼륨에 영속.
- **금지:** `docker compose down -v` 또는 `pgdata` 볼륨 삭제 → DB 초기화. 그 경우에만 빈 스키마가 되며 명부 재임포트 필요.
- **주의:** 만약 누군가 `.env`를 `RUN_SEED=true`로 되돌리고 재기동하면 `seed.ts`가 데모를 **다시 적재**한다(seed는 부트스트랩 전용이 아닌 풀 데모 시드). 따라서 `RUN_SEED=false` 고정이 영구화의 단일 안전핀. (후속 개선: backend에 `SEED_MODE=bootstrap` 옵션 추가 시 이 위험 제거 — 코드 변경 필요하므로 리더 확인 후 별도 진행.)
- **운영 전 권고:** 부트스트랩 `hr@energyx.co.kr` 비번을 운영 비번으로 교체(현재 `Passw0rd!`). 실 HR 온보딩 완료 후 부트스트랩 계정 비활성/삭제 권고.
- **시크릿:** `.env`(RUN_SEED·DB·JWT)·명부 xlsx는 **비커밋**(사내기밀). 본 라운드 코드/스키마 변경 0 — 커밋 대상은 `_workspace/06_release/RELEASE.md` 본 절뿐(커밋은 리더).
