/*
  Warnings:

  - You are about to drop the column `contentAmount` on the `ProductVariant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "contentAmount",
ADD COLUMN     "packagingOptions" DOUBLE PRECISION[];
