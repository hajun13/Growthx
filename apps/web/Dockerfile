# ───────────────────────── apps/web/Dockerfile ─────────────────────────
# 인사평가 프론트 (Next.js App Router) — pnpm 모노레포 멀티스테이지 + standalone.
# 빌드 컨텍스트 = 레포 루트(docker-compose: context: .). next.config: output 'standalone'.
# web 은 워크스페이스 패키지 @growthx/contracts(transpilePackages·소스 번들)·@growthx/ui(tailwind preset)를 빌드타임 소비.

# ── base: corepack pnpm 활성화 ──
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# ── 1) deps: 워크스페이스 전체 매니페스트 + 락파일로 설치(frozen) ──
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/ui/package.json ./packages/ui/
COPY packages/contracts/package.json ./packages/contracts/
RUN pnpm install --frozen-lockfile

# ── 2) build: NEXT_PUBLIC_*/프록시 주입 후 next build ──
FROM base AS build
# deps 의 전체 트리(루트 + 워크스페이스 패키지별 node_modules·@growthx/* 심링크) 복사 후
# 소스를 덮어쓴다(.dockerignore 가 node_modules 제외 → deps 의 링크 보존).
COPY --from=deps /repo ./
COPY . .
# 브라우저는 same-origin '/api/v1' 호출 → Next rewrite 가 API 로 프록시. rewrites 는
# 빌드타임 manifest 로 구워지므로 API_PROXY_TARGET 은 build-arg 필수.
ARG API_PROXY_TARGET
ENV API_PROXY_TARGET=$API_PROXY_TARGET
ENV NEXT_TELEMETRY_DISABLED=1
# next build — @growthx/contracts 는 transpilePackages 로 번들, @growthx/ui preset 은 tailwind 가 소비.
RUN pnpm -C apps/web run build

# ── 3) runtime: standalone 산출물만(최소 이미지) ──
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
RUN apk add --no-cache tini && addgroup -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
# Next standalone 은 pnpm-lock 기준 모노레포 루트 구조를 보존(server.js 는 apps/web/ 하위).
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
