-- Sync gaps (docs/log/backend-sync-api.md §2):
-- 1. per-field HLC clocks for entity edits (PUT is last-writer-wins per field);
-- 2. "Mark done" workout sessions count for the Outcome Score T component;
-- 3. delete tombstones, so a delayed create/edit retry never resurrects a row.

-- AlterTable
ALTER TABLE "ScheduleBlock" ADD COLUMN     "fieldClock" JSONB;

-- AlterTable
ALTER TABLE "Supplement" ADD COLUMN     "fieldClock" JSONB;

-- AlterTable
ALTER TABLE "MealTemplate" ADD COLUMN     "fieldClock" JSONB;

-- AlterTable
ALTER TABLE "GymProgram" ADD COLUMN     "fieldClock" JSONB;

-- AlterTable
ALTER TABLE "WorkoutSession" ADD COLUMN     "markedDone" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Tombstone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "hlc" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tombstone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tombstone_userId_entityId_idx" ON "Tombstone"("userId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Tombstone_userId_entity_entityId_key" ON "Tombstone"("userId", "entity", "entityId");

-- AddForeignKey
ALTER TABLE "Tombstone" ADD CONSTRAINT "Tombstone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
