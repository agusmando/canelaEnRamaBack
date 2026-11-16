/*
  Warnings:

  - You are about to drop the column `created_at` on the `Image` table. All the data in the column will be lost.
  - You are about to drop the column `is_main` on the `Image` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `Image` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `Offer` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Image" DROP CONSTRAINT "Image_productId_fkey";

-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_categoryId_fkey";

-- AlterTable
ALTER TABLE "Image" DROP COLUMN "created_at",
DROP COLUMN "is_main",
DROP COLUMN "productId";

-- AlterTable
ALTER TABLE "Offer" DROP COLUMN "categoryId",
ADD COLUMN     "productId" INTEGER;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
