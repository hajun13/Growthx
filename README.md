# GrowthX — 인사평가(HR 성과평가) 솔루션

에너지엑스㈜ 2026 KPI/성과평가 운영을 시스템화한 사내 인사평가 웹 솔루션입니다.
슬로건: **"열심히 한 사람이 아니라 성과를 만든 사람이 평가받는 구조"**.

## 모노레포 구조

```
GrowthX/
├── apps/
│   ├── api/        NestJS + Prisma + PostgreSQL (분리형 백엔드 API)
│   └── web/        Next.js (App Router) 프론트엔드  ← frontend-engineer 담당
├── _workspace/     설계·계약·진행 산출물
├── package.json    npm workspaces 루트
└── tsconfig.base.json
```

## 사전 요구사항

- Node.js >= 20
- PostgreSQL 15+ (로컬 또는 Docker)

## 빠른 시작 — 백엔드 API

```bash
# 1) 루트에서 의존성 설치 (workspaces)
npm install

# 2) 백엔드 환경 변수 준비
cp apps/api/.env.example apps/api/.env
#   DATABASE_URL, JWT_SECRET 등을 채워주세요.

# 3) Prisma 클라이언트 생성 + 마이그레이션 + 시드
cd apps/api
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed

# 4) 개발 서버 실행 (기본 포트 4000)
npm run start:dev
```

헬스체크: `GET http://localhost:4000/api/v1/health` → `{ "data": { "status": "ok" } }`

## 데모 계정 (시드)

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| HR 관리자 | `hr@energyx.co.kr` | `Passw0rd!` |
| 본부장 | `division@energyx.co.kr` | `Passw0rd!` |
| 팀장 | `lead@energyx.co.kr` | `Passw0rd!` |
| 임직원(선임) | `senior@energyx.co.kr` | `Passw0rd!` |
| 임직원(프로) | `pro@energyx.co.kr` | `Passw0rd!` |

## API 계약

단일 진실 공급원: [`_workspace/02_contract/contract.md`](_workspace/02_contract/contract.md).
모든 응답은 봉투(`{data}` / `{data,meta}` / `{error}`)로 래핑되며 필드는 camelCase입니다.

## 스크립트 (루트)

| 스크립트 | 설명 |
|----------|------|
| `npm run dev:api` | API 개발 서버 |
| `npm run build:api` | API 빌드 |
| `npm run prisma:generate` | Prisma 클라이언트 생성 |
| `npm run prisma:migrate` | 마이그레이션 |
| `npm run prisma:seed` | 2026 기본값 시드 |
