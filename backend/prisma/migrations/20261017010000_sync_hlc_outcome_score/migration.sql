-- Bets 1/2/4/5 server foundations: hybrid-logical-clock columns for
-- last-writer-wins toggles and per-field daily logs, idempotent workout sets,
-- server-computed Outcome Score, numeric targets, planned weekdays, data epoch.

-- AlterTable
ALTER TABLE "Completion" ADD COLUMN     "hlc" TEXT;

-- AlterTable
ALTER TABLE "DailyLog" ADD COLUMN     "fieldClock" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "DailyScore" ADD COLUMN     "components" JSONB,
ADD COLUMN     "computedAt" TIMESTAMP(3),
ADD COLUMN     "kept" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "outcomeScore" INTEGER,
ADD COLUMN     "plan" TEXT,
ADD COLUMN     "routinePct" INTEGER,
ADD COLUMN     "setsDone" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "setsPlanned" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MealLog" ADD COLUMN     "hlc" TEXT;

-- AlterTable
ALTER TABLE "ProgramDay" ADD COLUMN     "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "SupplementLog" ADD COLUMN     "hlc" TEXT;

-- AlterTable (volatile default: every existing user gets a distinct epoch)
ALTER TABLE "User" ADD COLUMN     "dataEpoch" TEXT NOT NULL DEFAULT (gen_random_uuid())::text;

-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN     "calorieTargetKcal" DOUBLE PRECISION,
ADD COLUMN     "goalRateKgPerWeek" DOUBLE PRECISION,
ADD COLUMN     "proteinTargetG" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "WorkoutSetLog" ADD COLUMN     "hlc" TEXT;

-- CreateIndex
CREATE INDEX "GymProgram_userId_idx" ON "GymProgram"("userId");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_endedAt_idx" ON "WorkoutSession"("userId", "endedAt");

-- Existing data may hold duplicate sets from non-idempotent retries
-- (docs/audit/02-sync-offline.md §2.1). Keep the earliest row of each
-- (session, exercise, set number) before enforcing uniqueness.
DELETE FROM "WorkoutSetLog" a
USING "WorkoutSetLog" b
WHERE a."sessionId" = b."sessionId"
  AND a."exerciseName" = b."exerciseName"
  AND a."setNumber" = b."setNumber"
  AND (a."createdAt" > b."createdAt" OR (a."createdAt" = b."createdAt" AND a."id" > b."id"));

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSetLog_sessionId_exerciseName_setNumber_key" ON "WorkoutSetLog"("sessionId", "exerciseName", "setNumber");
