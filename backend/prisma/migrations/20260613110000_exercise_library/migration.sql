-- CreateTable
CREATE TABLE "ExerciseLibrary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryMuscle" TEXT,
    "equipment" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ExerciseLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseLibrary_name_key" ON "ExerciseLibrary"("name");

-- CreateIndex
CREATE INDEX "ExerciseLibrary_name_idx" ON "ExerciseLibrary"("name");
