/*
  Warnings:

  - The `roundingOption` column on the `ProductVariant` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "roundingOption",
ADD COLUMN     "roundingOption" INTEGER NOT NULL DEFAULT 10;

-- DropEnum
DROP TYPE "RoundingOption";
