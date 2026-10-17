-- Bet 3 (security): refresh tokens are stored as sha256(token) and grouped
-- into rotation families. Legacy rows hold bcrypt hashes that can never match
-- a sha256 lookup, so they are dropped (affected devices sign in once again).
DELETE FROM "RefreshToken";

-- DropIndex
DROP INDEX "RefreshToken_tokenHash_idx";

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "familyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");
