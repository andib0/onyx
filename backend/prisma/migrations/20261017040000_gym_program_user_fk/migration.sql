-- GymProgram.userId had no foreign key: deleting an account left its custom
-- programs (and their days/exercises) orphaned forever. Drop existing orphans
-- first so the constraint can be added on databases that already have them.
DELETE FROM "GymProgram"
WHERE "userId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = "GymProgram"."userId");

-- AddForeignKey
ALTER TABLE "GymProgram" ADD CONSTRAINT "GymProgram_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
