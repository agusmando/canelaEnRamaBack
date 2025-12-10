/*
  Warnings:

  - Added the required column `productId` to the `Dependency` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Dependency" ADD COLUMN     "productId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
