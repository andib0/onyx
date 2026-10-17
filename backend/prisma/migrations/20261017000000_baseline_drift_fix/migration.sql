-- Catch-up for drift between the migration history and schema.prisma
-- (docs/audit/01-architecture-and-docs.md §6). Production was built with
-- `prisma db push`, so these columns/indexes already exist there; the deploy
-- script (scripts/migrate-deploy.sh) marks this migration as applied on such
-- databases instead of running it.

-- AlterTable
ALTER TABLE "MealTemplate" ADD COLUMN     "foodId" TEXT,
ADD COLUMN     "grams" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "username" TEXT,
ADD COLUMN     "weight" DECIMAL(65,30);

-- CreateIndex
CREATE INDEX "MealTemplateTag_mealTemplateId_idx" ON "MealTemplateTag"("mealTemplateId");
