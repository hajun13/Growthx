#!/usr/bin/env bash
# 매뉴얼 캡처용 격리 스택 기동.
#
#   bash e2e/manual/stack/setup.sh
#
# 하는 일:
#   1) 작업 DB 를 덤프(읽기 전용)
#   2) 격리 프로젝트(growthx-manual)로 db 만 먼저 띄우고 덤프 복원
#   3) 격리 DB 익명화 — 이름·이메일·연봉을 값 자체로 치환
#   4) 캡처에 필요한 상태로 설정(일정 창 개방)
#   5) api·web 기동
#
# 작업 스택(3000/4000/5432)은 건드리지 않는다. 격리 스택은 3100/4100/5532 를 쓴다.
set -euo pipefail

cd "$(dirname "$0")/../../.."   # 저장소 루트

COMPOSE="e2e/manual/stack/docker-compose.manual.yml"
ENVFILE=".env.manual"
DUMP=".manual-source.sql"
SRC_DB_CONTAINER="growthx-db-1"

echo "==> 1/5 작업 DB 덤프"
if ! docker ps --format '{{.Names}}' | grep -qx "$SRC_DB_CONTAINER"; then
  echo "작업 스택의 DB($SRC_DB_CONTAINER)가 떠 있어야 복제할 수 있어요." >&2
  exit 1
fi
# .env 의 POSTGRES_* 를 그대로 쓴다.
set -a; . ./.env; set +a
docker exec "$SRC_DB_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --no-owner --no-privileges > "$DUMP"
echo "    덤프 $(wc -c < "$DUMP") bytes"

echo "==> 2/5 격리 스택 env 생성"
# 시크릿을 새로 적지 않고 작업 .env 를 복사한 뒤 포트만 덮어쓴다.
cp .env "$ENVFILE"
{
  echo ""
  echo "# 매뉴얼 격리 스택 전용 포트(작업 스택과 충돌 방지)"
  echo "MANUAL_WEB_PORT=3200"
  echo "MANUAL_API_PORT=4200"
  echo "MANUAL_POSTGRES_PORT=5532"
} >> "$ENVFILE"

echo "==> 3/5 격리 DB 기동 + 복원"
docker compose -f "$COMPOSE" --env-file "$ENVFILE" up -d db
until [ "$(docker inspect -f '{{.State.Health.Status}}' growthx-manual-db-1 2>/dev/null)" = "healthy" ]; do
  sleep 2
done
docker exec -i growthx-manual-db-1 psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DUMP" > /dev/null
echo "    복원 완료: $(docker exec growthx-manual-db-1 psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c 'SELECT count(*) FROM org.users') 명"

echo "==> 4/5 익명화 + 캡처용 상태 설정"
docker exec -i growthx-manual-db-1 psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  < e2e/manual/stack/anonymize.sql
docker exec -i growthx-manual-db-1 psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  < e2e/manual/stack/prepare-roles.sql
bash e2e/manual/stack/set-state.sh mid_review open-window

echo "==> 5/5 api·web 기동"
docker compose -f "$COMPOSE" --env-file "$ENVFILE" up -d api web
for svc in api web; do
  until [ "$(docker inspect -f '{{.State.Health.Status}}' "growthx-manual-${svc}-1" 2>/dev/null)" = "healthy" ]; do
    sleep 3
  done
done

rm -f "$DUMP"
echo
echo "격리 스택 준비 완료 — web http://localhost:3200 · api http://localhost:4200"
echo "캡처:  MANUAL_STACK=1 pnpm -C e2e manual"
echo "정리:  bash e2e/manual/stack/teardown.sh"
