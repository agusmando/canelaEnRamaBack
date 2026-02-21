/*
  Warnings:

  - You are about to drop the column `minStock` on the `ProductVariant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "minStock",
ADD COLUMN     "stockThreshold" INTEGER NOT NULL DEFAULT 0;
