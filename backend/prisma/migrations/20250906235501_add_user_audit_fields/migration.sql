-- CreateEnum
CREATE TYPE "public"."PasswordTokenType" AS ENUM ('reset', 'invite');

-- AlterTable
ALTER TABLE "public"."PasswordResetToken" ADD COLUMN     "type" "public"."PasswordTokenType" NOT NULL DEFAULT 'reset',
ADD COLUMN     "usedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Usuario" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordLastChangedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_type_idx" ON "public"."PasswordResetToken"("userId", "type");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "public"."PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "public"."Usuario"("rol");

-- CreateIndex
CREATE INDEX "Usuario_isActive_idx" ON "public"."Usuario"("isActive");
