# KPI 시스템(GrowthX) 배포 가이드 (맥, kpi.energyx.co.kr, SSO)

> 같은 맥에 EX-DB-API 의 Keycloak+Caddy 가 먼저 떠 있어야 한다.
> Caddy 가 kpi.energyx.co.kr → growthx-web:3000 을 프론트한다(포트 노출 없음).
> 구성: `docker-compose.prod.yml` + `.env.prod`.

## 아키텍처

```
Internet → [Caddy :443] (EX-DB-API 스택)
             ├ auth.energyx.co.kr → keycloak:8080
             └ kpi.energyx.co.kr  → growthx-web:3000   ← 이 스택
           energyx-platform 네트워크로 연결. db·api 는 내부만.
```

## 사전 준비

### 1. 공유 네트워크 (최초 1회)
```bash
docker network create energyx-platform   # 이미 있으면 무시
```

### 2. Keycloak 스택이 떠 있어야 함
EX-DB-API 의 `docs/deploy-keycloak-macos.md` 대로 Keycloak+Caddy 먼저 기동.
- Keycloak `.env.prod` 의 `GROWTHX_REDIRECT_URI=https://kpi.energyx.co.kr/login/callback`,
  `GROWTHX_WEB_ORIGIN=https://kpi.energyx.co.kr` 로 두고 **최초 realm import** 되어야
  growthx-web 클라이언트 redirect 가 kpi 주소로 박힌다. (이미 import 됐으면 kcadm 으로 갱신)

### 3. DNS
Route 53 에 `kpi` CNAME → `xxxx.iptime.org` (auth 와 동일 방식).

---

## 데이터 이전 (그대로 유지)

현재 운영 데이터(실 명부·평가)를 맥으로 옮긴다. **원본 서버(192.168.0.202 등)에서:**

```bash
docker compose exec -T db pg_dump -U eval -Fc eval > kpi-$(date +%F).dump
```

이 파일을 맥으로 전송(scp 등). ⚠️ 실명·연봉 포함 — 전송 후 삭제, 커밋 금지.

**맥에서** (아래 4~6 으로 스택 먼저 기동한 뒤):
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db \
  pg_restore -U eval -d eval --clean --if-exists < kpi-YYYY-MM-DD.dump
```

`pg_dump` 은 스키마+데이터+마이그레이션 이력을 포함하므로, 복원 후 `prisma migrate deploy`
(api 기동 시)는 자동 no-op 이 된다. SSO 스키마(azureAdSubject 등)도 함께 딸려온다.

---

## 배포 (맥)

### 4. 시크릿
```bash
cp .env.prod.example .env.prod
# POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET 강한 값으로.
# openssl rand -base64 48 | tr -d '/+=' | head -c 48
```
KEYCLOAK_* / NEXT_PUBLIC_* 는 예제 기본값(auth.energyx.co.kr) 그대로면 된다.

### 5. 기동
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```
Next 빌드 때문에 몇 분 걸린다. `NEXT_PUBLIC_*` 가 이때 브라우저 번들에 인라인된다.

### 6. 데이터 복원
위 "데이터 이전"의 `pg_restore` 실행.

### 7. pre-flight (사용자 매칭 확인) — SSO 게이트
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T api \
  node -e "require('./dist/...')"   # 또는 로컬에서 preflight:sso 스크립트로 대조
```
실무: Entra 사용자 CSV 를 받아 `prisma/preflight-sso-match.ts` 로 대조.
`missing` 이 0 이어야 전 직원 로그인 가능. `alias-needed`(예: 대표이사 도메인 불일치)는
`user_email_aliases` 에 넣는다.

### 8. 확인
`https://kpi.energyx.co.kr/login` → "Microsoft 계정으로 로그인" → 로그인 → 대시보드.

---

## 보안 체크리스트

- [ ] `.env.prod` 커밋 안 됨 (`.gitignore` 로 차단됨)
- [ ] JWT_SECRET / POSTGRES_PASSWORD 강한 값
- [ ] `docker compose ... ps` 에서 db·api·web 이 **호스트 포트에 안 뜸** (Caddy 만 노출)
- [ ] Keycloak growthx-web 클라이언트 redirect 가 `https://kpi.energyx.co.kr/login/callback`
- [ ] pre-flight `missing: 0`

## 롤백 (SSO → 비밀번호)

문제 시 `.env.prod` 에서:
```
AUTH_MODE=password
NEXT_PUBLIC_AUTH_MODE=password
```
→ api 재시작 + **web 재빌드**(NEXT_PUBLIC 는 빌드타임). `/auth/sso` 는 404, 기존 폼 복귀.

## 백업

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db \
  pg_dump -U eval -Fc eval > kpi-backup-$(date +%F).dump
```
평가·연봉 실데이터다. crontab 자동화 권장.
