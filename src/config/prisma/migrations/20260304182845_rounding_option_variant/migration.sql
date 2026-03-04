-- CreateEnum
CREATE TYPE "RoundingOption" AS ENUM ('TENS', 'HUNDREDS');

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "roundingOption" "RoundingOption" NOT NULL DEFAULT 'TENS';
