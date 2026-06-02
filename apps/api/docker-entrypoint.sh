#!/bin/sh
# ───────────────────── apps/api entrypoint ─────────────────────
# 기동 전 DB 스키마를 안전하게 적용한 뒤 서버를 기동한다.
# 마이그레이션/스키마 적용 실패 시 컨테이너를 즉시 중단(set -e)하여
# 부분 적용 상태로 API 가 뜨는 것을 막는다.
set -e

echo "[entrypoint] applying database schema..."

# prisma CLI 는 node_modules/.bin 에 존재(런타임 이미지에 prisma 패키지 포함됨).
# 정식 마이그레이션 파일(prisma/migrations/*)이 있으면 migrate deploy,
# 없으면(현재 M1: 마이그레이션 미생성) db push 로 schema.prisma 를 직접 반영.
#  ─ 운영에서는 migrations 디렉터리를 커밋해 migrate deploy 경로를 쓰는 것을 권장.
if [ -d "./prisma/migrations" ] && [ -n "$(ls -A ./prisma/migrations 2>/dev/null | grep -v migration_lock.toml || true)" ]; then
  echo "[entrypoint] prisma migrate deploy"
  npx prisma migrate deploy --schema=./prisma/schema.prisma
else
  echo "[entrypoint] no migrations found -> prisma db push (schema sync)"
  npx prisma db push --schema=./prisma/schema.prisma --skip-generate --accept-data-loss
fi

# 선택적 시드: RUN_SEED=true 일 때만(데모/최초 1회). seed 는 ts-node 필요 →
# 런타임 이미지엔 devDeps 가 없을 수 있으므로 기본 비활성. 별도 1회 작업으로 실행 권장.
if [ "$RUN_SEED" = "true" ]; then
  echo "[entrypoint] RUN_SEED=true -> seeding demo data"
  # tsconfig 가 런타임 이미지에 없으므로 ts-node 에 CommonJS 를 직접 지정(ESM 로더 회피).
  npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"experimentalDecorators":true,"emitDecoratorMetadata":true,"target":"ES2021","skipLibCheck":true}' prisma/seed.ts \
    || echo "[entrypoint] seed skipped/failed — RELEASE.md 의 시드 절차 참고"
fi

# nest build 산출물은 rootDir './' 영향으로 dist/src/main.js 에 생성됨.
echo "[entrypoint] starting API server (node dist/src/main)"
exec node dist/src/main
