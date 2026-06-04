# ───────────────────────── apps/api/Dockerfile ─────────────────────────
# 인사평가 솔루션 백엔드 (NestJS + Prisma) — 멀티스테이지
# 빌드 컨텍스트는 레포 루트(docker-compose에서 context: . , dockerfile 지정).
# 모노레포 npm workspaces 이므로 루트 package.json + 워크스페이스 매니페스트를 함께 복사.

# ── 1) deps: 전체 의존성 설치(빌드용, devDeps 포함) ──
FROM node:20-alpine AS deps
WORKDIR /repo
# 워크스페이스 매니페스트만 먼저 복사해 레이어 캐시 활용
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
# lockfile 있으면 ci, 없으면 install (재현성 위해 lockfile 커밋 권장)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ── 2) build: prisma generate + nest build ──
FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json* tsconfig.base.json ./
COPY apps/api ./apps/api
# 워크스페이스 nested node_modules 보존: nodemailer/@types/nodemailer 등 일부 패키지는
# 버전 충돌 de-dup 으로 루트가 아닌 apps/api/node_modules 에 설치된다.
# 위 'COPY apps/api ./apps/api'(context 에 node_modules 없음·.dockerignore 제외)가
# deps 단계의 apps/api/node_modules 를 덮어쓰므로, deps 에서 다시 복사해 복원한다.
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
# Prisma client 생성(스키마 기준) — 반드시 build 이전. schema 경로를 명시해 워크스페이스 무관 실행.
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
# Nest 빌드 → apps/api/dist
RUN npm run build --workspace apps/api
# 운영 의존성만 정리(런타임 이미지 슬림화). 모노레포 호이스트 트리(루트 node_modules)를 prune.
# prisma CLI 는 runtime entrypoint(db push/migrate)에서 필요 → dependencies 가 아니어도
# 남도록 별도 보장: prune 후 prisma 가 사라지면 entrypoint 가 실패하므로 omit=dev 대신
# devDeps 중 prisma 만 유지가 어려워, 여기서는 prune 을 생략하고 전체 node_modules 를 운반한다.
# (이미지 크기보다 entrypoint 의 prisma CLI 가용성을 우선 — 슬림화는 후속 개선 항목)

# ── 3) runtime: dist + prisma 스키마 + prod node_modules ──
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
# 컨테이너 내부 포트(웹과 충돌 방지 위해 3000 고정; main.ts 가 PORT 환경변수 사용)
ENV PORT=3000
WORKDIR /app
# wget(healthcheck) 은 alpine busybox 기본 포함. tini 로 PID1 시그널 처리.
# openssl: Prisma schema/query engine 이 런타임에 libssl 을 로드(db push/migrate)하는 데 필요.
RUN apk add --no-cache tini openssl
# 산출물 복사
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/node_modules ./node_modules
# 워크스페이스 nested node_modules(nodemailer/@types/nodemailer 등 — 버전 de-dup 으로
# 루트가 아닌 apps/api/node_modules 에 설치됨) 를 런타임 모듈 해소 경로에 병합.
# 런타임은 /app/dist/src/main 에서 실행되므로 require('nodemailer') 가 /app/node_modules 를
# 탐색한다 → 중첩 패키지를 /app/node_modules 로 복사해 해소되게 한다(루트 트리는 위에서 선복사).
COPY --from=build /repo/apps/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/package.json ./package.json
# entrypoint: 마이그레이션 적용(실패 시 기동 중단) 후 서버 기동
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
