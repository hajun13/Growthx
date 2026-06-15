# ───────────────────────── apps/api/Dockerfile ─────────────────────────
# 인사평가 백엔드 (NestJS + Prisma) — pnpm + Turborepo 모노레포 멀티스테이지.
# 빌드 컨텍스트 = 레포 루트(docker-compose: context: .). pnpm 은 corepack 으로 고정.

# ── base: corepack pnpm 활성화 ──
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# ── 1) deps: 워크스페이스 전체 매니페스트 + 락파일로 설치(frozen) ──
FROM base AS deps
# 전 워크스페이스 매니페스트 + 락 + .npmrc(node-linker=hoisted) 를 먼저 복사(레이어 캐시)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/ui/package.json ./packages/ui/
COPY packages/contracts/package.json ./packages/contracts/
RUN pnpm install --frozen-lockfile

# ── 2) build: prisma generate + nest build(→ dist/src) ──
FROM base AS build
# deps 의 전체 트리(루트 + 워크스페이스별 node_modules) 복사 후 소스 덮어쓰기.
COPY --from=deps /repo ./
COPY . .
# Prisma client 생성(@prisma/client, hoisted 루트 node_modules). 스키마는 apps/api/prisma.
RUN pnpm -C apps/api run prisma:generate
RUN pnpm -C apps/api run build

# ── 3) runtime: dist + prisma 스키마/마이그레이션 + node_modules ──
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
# tini(PID1 시그널) · openssl(Prisma engine libssl) · prisma CLI(entrypoint migrate)
RUN apk add --no-cache tini openssl
# 산출물 — entrypoint 는 node dist/src/main 실행, prisma migrate deploy 에 prisma/ 필요.
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./package.json
# pnpm hoisted 평탄 node_modules(prisma CLI·nestjs·nodemailer 등 전부 루트에 존재).
# @growthx/* 워크스페이스 심링크는 런타임 미사용(백엔드는 미import) → 무해.
COPY --from=build /repo/node_modules ./node_modules
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
