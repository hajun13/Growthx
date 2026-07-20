#!/usr/bin/env bash
# 격리 스택 제거 — 컨테이너와 볼륨(복제 DB)까지 지운다.
#
#   bash e2e/manual/stack/teardown.sh
#
# 작업 스택(growthx-*)은 건드리지 않는다. 캡처된 이미지와 매뉴얼은 docs/manual/ 에 남는다.
set -euo pipefail

cd "$(dirname "$0")/../../.."

docker compose -f e2e/manual/stack/docker-compose.manual.yml \
  --env-file .env.manual down -v --remove-orphans

rm -f .env.manual .manual-source.sql

echo "격리 스택 제거 완료. 작업 스택 상태:"
docker ps --format '{{.Names}}\t{{.Status}}' | grep -E '^growthx-(db|api|web)-1' || true
