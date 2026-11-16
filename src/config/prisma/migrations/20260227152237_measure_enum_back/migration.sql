/*
  Warnings:

  - You are about to drop the column `measureTypeId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `measureTypeId` on the `ProductVariant` table. All the data in the column will be lost.
  - You are about to drop the `MeasureType` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Measure" AS ENUM ('KG', 'U', 'L', 'ML', 'G');

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_measureTypeId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_measureTypeId_fkey";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "measureTypeId",
ADD COLUMN     "measure" "Measure" NOT NULL DEFAULT 'KG';

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "measureTypeId",
ADD COLUMN     "contentMeasure" "Measure" NOT NULL DEFAULT 'KG';

-- DropTable
DROP TABLE "MeasureType";
