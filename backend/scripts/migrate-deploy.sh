#!/usr/bin/env bash
# Render start step (render.yaml): bring DATABASE_URL to the migration head.
#
# Production was built with `prisma db push`, so its database has the tables
# but no `_prisma_migrations` history. For such a database we first align it
# to the baseline schema (the schema.prisma that the baseline migrations
# reproduce; non-destructive: `db push` refuses data loss without
# --accept-data-loss), mark the baseline migrations as applied, and then let
# `prisma migrate deploy` apply everything newer. Fresh and already-migrated
# databases go straight to `migrate deploy`.
set -euo pipefail
cd "$(dirname "$0")/.."

# Migrations whose combined result equals prisma/baseline/schema.baseline.prisma.
BASELINE_MIGRATIONS=(
  20260205165352_nmgrt
  20260611000000_workout_logging
  20260613000000_daily_score
  20260613100000_score_macros
  20260613110000_exercise_library
  20261017000000_baseline_drift_fix
)

state="$(node scripts/db-state.mjs)"
echo "[migrate-deploy] database state: ${state}"

if [ "${state}" = "pushed" ]; then
  echo "[migrate-deploy] db-push database: aligning to the baseline schema"
  npx prisma db push --schema prisma/baseline/schema.baseline.prisma --skip-generate
  for m in "${BASELINE_MIGRATIONS[@]}"; do
    echo "[migrate-deploy] marking ${m} as applied"
    npx prisma migrate resolve --applied "${m}"
  done
fi

npx prisma migrate deploy
echo "[migrate-deploy] done"
