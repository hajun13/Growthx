# 에너지엑스 인사 평가

에너지엑스㈜ 2026 KPI/성과평가 운영을 시스템화한 사내 인사평가 웹 솔루션입니다.
슬로건: **"열심히 한 사람이 아니라 성과를 만든 사람이 평가받는 구조"**.

> ⚠️ **이 리포지토리는 private 유지가 전제입니다.** `deploy/seed-data.sql`에 임직원 실명·평가 데이터가 포함되어 있어, 절대 public으로 전환하지 마세요.

---

## 🚀 새 서버에 배포하기 (클론 → 접속까지)

24시간 켜두는 서버에 올려 사내 누구나 접속하게 하는 절차입니다. **Docker만 설치되어 있으면 됩니다.**

### 사전 요구사항
- Docker Engine 24+ / Docker Compose v2 (`docker compose version`으로 확인)
- 그 외 Node.js·PostgreSQL 등은 **설치 불필요** (전부 컨테이너에서 동작)

### 1) 클론
```bash
git clone git@github.com:hajun13/Growthx.git
cd Growthx
```

### 2) 환경 변수 준비
```bash
cp .env.example .env
```
`.env`를 열어 **최소한 아래 3개는 반드시 새 값으로** 바꿉니다:
- `POSTGRES_PASSWORD` — DB 비밀번호 (그리고 `DATABASE_URL` 안의 비밀번호도 동일하게 맞출 것)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — 각각 `openssl rand -base64 48`로 생성한 값

### 3) 기동
```bash
docker compose up -d --build
```
- 최초 기동 시 DB가 **빈 볼륨이면 `deploy/seed-data.sql`이 자동 복원**됩니다(현재 인원·평가 데이터 스냅샷).
- `db → api → web` 순서로 헬스체크를 통과하며 올라옵니다. 2~5분 소요.

### 4) 상태 확인
```bash
docker compose ps          # 세 컨테이너 모두 healthy 확인
curl http://localhost:4000/api/v1/health   # {"data":{"status":"ok"}}
```
브라우저에서 `http://<서버IP>:3000` 접속 → 로그인 화면이 보이면 성공.

---

## 🌐 어디서든 접속 가능하게 (IP:3000)

웹은 `http://<서버IP>:3000` **포트 하나만** 열면 됩니다. (브라우저 → web 컨테이너가 내부에서 API로 프록시하므로 API/DB 포트는 외부에 열 필요 없음)

1. **방화벽 개방** — 서버에서 3000/tcp 인바운드 허용
   - Windows: `New-NetFirewallRule -DisplayName "EvalWeb" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow`
   - Linux(ufw): `sudo ufw allow 3000/tcp`
2. **공인 접속**
   - 같은 사내망: `http://<서버 사설IP>:3000` 으로 바로 접속
   - 인터넷에서: 공유기/방화벽에서 **외부 3000 → 서버 3000 포트포워딩**, 그 후 `http://<공인IP>:3000`
3. **보안 권장**
   - `.env`의 `POSTGRES_PORT` 매핑은 디버깅용입니다. 외부 노출 서버라면 `docker-compose.yml`의 `db.ports` 줄을 주석 처리해 5432를 닫으세요.
   - 평문(HTTP)입니다. 인터넷 노출 시 도메인 + HTTPS(리버스 프록시: Caddy/Nginx)를 앞단에 두는 것을 권장합니다.

---

## 👤 로그인 계정

- **모든 계정의 초기 비밀번호: `1234`** (첫 로그인 시 비밀번호 변경 강제 없음 — 테스트 편의)
- HR 관리자 예: `hr@energyx.co.kr` / `1234`
- 개별 계정 이메일은 관리자 화면(조직도/인원관리)에서 확인

---

## 🔧 운영 명령

```bash
docker compose ps                 # 상태
docker compose logs -f api        # API 로그
docker compose restart api        # 특정 서비스 재시작
docker compose down               # 정지 (데이터 볼륨은 유지)
docker compose up -d --build      # 코드 갱신 후 재배포 (git pull 다음에)
```

**데이터 백업** (정기 권장):
```bash
docker exec <db컨테이너명> pg_dump -U eval -d eval --clean --if-exists --no-owner > backup-$(date +%F).sql
```

**주의 — 데이터 삭제 방지:** `docker compose down -v`(`-v`)는 DB 볼륨까지 삭제합니다. 절대 사용하지 마세요.

---

## 🔄 코드 업데이트 배포

개발 PC에서 변경 후 푸시 → 서버에서:
```bash
git pull
docker compose up -d --build
```
- 스키마 변경(Prisma 마이그레이션)은 api 컨테이너 기동 시 `migrate deploy`로 자동 적용됩니다.
- 기존 데이터는 볼륨에 보존됩니다(`seed-data.sql` 자동복원은 빈 볼륨 최초 1회뿐).

---

## 📁 모노레포 구조

```
Growthx/
├── apps/
│   ├── api/        NestJS + Prisma + PostgreSQL (분리형 백엔드 API)
│   └── web/        Next.js (App Router) 프론트엔드
├── deploy/
│   └── seed-data.sql   현재 DB 스냅샷(새 서버 자동 복원용)
├── docker-compose.yml  db → api → web 스택
├── .env.example        환경변수 템플릿
└── _workspace/         설계·계약·진행 산출물
```

---

## 💻 로컬 개발 (Docker 없이, 선택)

```bash
npm install
cp apps/api/.env.example apps/api/.env   # DATABASE_URL, JWT_SECRET 등 채우기
cd apps/api
npx prisma generate
npx prisma migrate dev
npm run start:dev                         # API :4000
```
프론트는 `apps/web`에서 `npm run dev` (Next.js :3000).

API 계약 단일 진실 공급원: [`_workspace/02_contract/contract.md`](_workspace/02_contract/contract.md).
모든 응답은 봉투(`{data}` / `{data,meta}` / `{error}`)로 래핑되며 필드는 camelCase입니다.

http://192.168.0.202:3000/login
