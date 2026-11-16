/*
  Warnings:

  - You are about to drop the column `productId` on the `Dependency` table. All the data in the column will be lost.
  - Added the required column `mixId` to the `Dependency` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Dependency" DROP CONSTRAINT "Dependency_productId_fkey";

-- AlterTable
ALTER TABLE "Dependency" DROP COLUMN "productId",
ADD COLUMN     "mixId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_mixId_fkey" FOREIGN KEY ("mixId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
