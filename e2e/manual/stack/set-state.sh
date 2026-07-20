#!/usr/bin/env bash
# 격리 DB 를 캡처에 필요한 상태로 바꾼다. 버려질 사본이므로 단방향 전이 규칙을
# 신경 쓰지 않고 컬럼을 직접 쓴다(작업 DB 에는 절대 쓰지 않는다).
#
#   bash e2e/manual/stack/set-state.sh <cycle-status> [open-window]
#
#   set-state.sh mid_review open-window   # 작성·평가가 열린 진행 중 상태
#   set-state.sh calibration open-window  # 역량평가·결과 조회가 열리는 조정 단계
#   set-state.sh closed                   # 결과가 공개된 마감 상태
#
# open-window 를 주면 final_review 일정 창을 오늘이 포함되도록 넓힌다.
# 본인평가·부서장 평가는 이 창 안에서만 열리고, 구성원·팀장은 면제가 없다.
set -euo pipefail

cd "$(dirname "$0")/../../.."
set -a; . ./.env; set +a

STATUS="${1:?사용법: set-state.sh <draft|active|mid_review|calibration|closed> [open-window]}"
WINDOW="${2:-}"
DB=growthx-manual-db-1

if ! docker ps --format '{{.Names}}' | grep -qx "$DB"; then
  echo "격리 DB($DB)가 없어요. 먼저 setup.sh 를 실행하세요." >&2
  exit 1
fi

psql_exec() { docker exec -i "$DB" psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"; }

psql_exec "UPDATE cycle.evaluation_cycles SET status='${STATUS}', updated_at=now()
           WHERE year = (SELECT max(year) FROM cycle.evaluation_cycles);"

if [ "$WINDOW" = "open-window" ]; then
  # 오늘이 창 안에 들도록 시작일만 당긴다(마감일은 그대로 둔다).
  psql_exec "UPDATE cycle.cycle_schedules
             SET start_date = LEAST(start_date, now() - interval '1 day'),
                 due_date   = GREATEST(due_date, now() + interval '30 days')
             WHERE phase IN ('final_review','self','downward');"
fi

docker exec "$DB" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c \
  "SELECT year||' -> '||status FROM cycle.evaluation_cycles ORDER BY year DESC;"
