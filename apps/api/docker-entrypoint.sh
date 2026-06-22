#!/bin/sh
# ───────────────────── apps/api entrypoint ─────────────────────
# 기동 전 DB 스키마를 안전하게 적용한 뒤 서버를 기동한다.
# 마이그레이션/스키마 적용 실패 시 컨테이너를 즉시 중단(set -e)하여
# 부분 적용 상태로 API 가 뜨는 것을 막는다.
set -e

# Prisma 의 업데이트 확인(checkpoint.prisma.io) 호출 비활성. 외부 egress 가 없는
# 컨테이너에서 이 호출이 응답을 기다리며 행되면, migrate deploy 가 마이그레이션을
# 다 적용하고도 CLI 프로세스가 종료되지 않아 서버 기동으로 넘어가지 못한다(unhealthy).
export CHECKPOINT_DISABLE=1

echo "[entrypoint] applying database migrations..."

# prisma CLI 는 node_modules/.bin 에 존재(런타임 이미지에 prisma 패키지 포함됨).
# 마이그레이션 이력화 이후(M2~): 항상 `prisma migrate deploy` 로 커밋된
# prisma/migrations/* 를 순서대로 적용한다(db push 폴백 폐기 — 운영 안전성).
# 마이그레이션 디렉터리가 비어 있으면(빌드 누락 등) 부분 적용을 막기 위해 즉시 중단한다.
if [ ! -d "./prisma/migrations" ] || [ -z "$(ls -A ./prisma/migrations 2>/dev/null | grep -v migration_lock.toml || true)" ]; then
  echo "[entrypoint] FATAL: prisma/migrations 가 비어 있음 — 이미지에 마이그레이션이 COPY 되지 않았습니다." >&2
  echo "[entrypoint] Dockerfile 의 'COPY apps/api/prisma ./prisma' 와 커밋된 migrations 를 확인하세요." >&2
  exit 1
fi
echo "[entrypoint] prisma migrate deploy"
node node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

# 선택적 시드: RUN_SEED=true 일 때만(데모/최초 1회). seed 는 ts-node 필요 →
# 런타임 이미지엔 devDeps 가 없을 수 있으므로 기본 비활성. 별도 1회 작업으로 실행 권장.
if [ "$RUN_SEED" = "true" ]; then
  echo "[entrypoint] RUN_SEED=true -> seeding demo data"
  # tsconfig 가 런타임 이미지에 없으므로 ts-node 에 CommonJS 를 직접 지정(ESM 로더 회피).
  npx --no-install ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"experimentalDecorators":true,"emitDecoratorMetadata":true,"target":"ES2021","skipLibCheck":true}' prisma/seed.ts \
    || echo "[entrypoint] seed skipped/failed — RELEASE.md 의 시드 절차 참고"
fi

# nest build 산출물은 rootDir './' 영향으로 dist/src/main.js 에 생성됨.
echo "[entrypoint] starting API server (node dist/src/main)"
exec node dist/src/main
