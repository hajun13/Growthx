# ───────────────────────── apps/web/Dockerfile ─────────────────────────
# 인사평가 솔루션 프론트 (Next.js App Router) — 멀티스테이지 + standalone
# 빌드 컨텍스트는 레포 루트(docker-compose에서 context: . 지정).
# next.config.mjs 에 output:'standalone' 설정됨 → 최소 runtime 이미지.

# ── 1) deps: 워크스페이스 의존성 설치 ──
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ── 2) build: NEXT_PUBLIC_* 주입 후 next build ──
FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json* tsconfig.base.json ./
COPY apps/web ./apps/web
# 브라우저는 same-origin '/api/v1' 를 호출하고 Next rewrite 가 API 로 프록시한다.
# rewrites() 는 빌드 시점에 routes-manifest 로 구워지므로 API_PROXY_TARGET 은 반드시 build-arg.
# (CORS 불필요 · 공개 URL 을 번들에 굽지 않음 → 자체 호스팅에 견고)
ARG API_PROXY_TARGET
ENV API_PROXY_TARGET=$API_PROXY_TARGET
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace apps/web

# ── 3) runtime: standalone 산출물만 ──
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
RUN apk add --no-cache tini && addgroup -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
# standalone 서버 + 정적 자산. (standalone 은 monorepo 경로 구조를 보존)
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
# standalone 진입점은 워크스페이스 경로에 server.js 생성됨.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
