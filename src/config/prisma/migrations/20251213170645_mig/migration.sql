/*
  Warnings:

  - You are about to drop the column `measure` on the `ProductVariant` table. All the data in the column will be lost.
  - Added the required column `measureTypeId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `measureTypeId` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "measureTypeId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "measure",
ADD COLUMN     "measureTypeId" INTEGER NOT NULL;

-- DropEnum
DROP TYPE "MeasureType";

-- CreateTable
CREATE TABLE "MeasureType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "MeasureType_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_measureTypeId_fkey" FOREIGN KEY ("measureTypeId") REFERENCES "MeasureType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_measureTypeId_fkey" FOREIGN KEY ("measureTypeId") REFERENCES "MeasureType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
