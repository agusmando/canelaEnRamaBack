/*
  Warnings:

  - Changed the type of `measure` on the `Product` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "MeasureType" AS ENUM ('KG', 'U', 'L', 'ML', 'G', 'CC');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "contentAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "onRequest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "profitMargin" DOUBLE PRECISION NOT NULL DEFAULT 0.45,
ADD COLUMN     "requestTime" TEXT NOT NULL DEFAULT '',
DROP COLUMN "measure",
ADD COLUMN     "measure" "MeasureType" NOT NULL;
