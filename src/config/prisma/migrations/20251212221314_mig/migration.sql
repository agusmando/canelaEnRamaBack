/*
  Warnings:

  - The primary key for the `Dependency` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `mixId` on the `Dependency` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `Dependency` table. All the data in the column will be lost.
  - You are about to drop the column `contentAmount` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `currentStock` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `measure` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `onRequest` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `profitMargin` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `requestTime` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `StockMovement` table. All the data in the column will be lost.
  - You are about to drop the `Order` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderDetail` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `mixVariantId` to the `Dependency` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productVariantId` to the `Dependency` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productVariantId` to the `StockMovement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "MovementType" ADD VALUE 'PRODUCTION';

-- DropForeignKey
ALTER TABLE "Dependency" DROP CONSTRAINT "Dependency_mixId_fkey";

-- DropForeignKey
ALTER TABLE "Dependency" DROP CONSTRAINT "Dependency_productId_fkey";

-- DropForeignKey
ALTER TABLE "OrderDetail" DROP CONSTRAINT "OrderDetail_orderId_fkey";

-- DropForeignKey
ALTER TABLE "OrderDetail" DROP CONSTRAINT "OrderDetail_productId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_productId_fkey";

-- AlterTable
ALTER TABLE "Dependency" DROP CONSTRAINT "Dependency_pkey",
DROP COLUMN "mixId",
DROP COLUMN "productId",
ADD COLUMN     "mixVariantId" INTEGER NOT NULL,
ADD COLUMN     "productVariantId" INTEGER NOT NULL,
ADD CONSTRAINT "Dependency_pkey" PRIMARY KEY ("mixVariantId", "productVariantId");

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "contentAmount",
DROP COLUMN "currentStock",
DROP COLUMN "measure",
DROP COLUMN "onRequest",
DROP COLUMN "price",
DROP COLUMN "profitMargin",
DROP COLUMN "requestTime";

-- AlterTable
ALTER TABLE "StockMovement" DROP COLUMN "productId",
ADD COLUMN     "productVariantId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Order";

-- DropTable
DROP TABLE "OrderDetail";

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "price" DOUBLE PRECISION NOT NULL,
    "profitMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "contentAmount" INTEGER NOT NULL DEFAULT 0,
    "measure" "MeasureType" NOT NULL,
    "requestTime" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_mixVariantId_fkey" FOREIGN KEY ("mixVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
