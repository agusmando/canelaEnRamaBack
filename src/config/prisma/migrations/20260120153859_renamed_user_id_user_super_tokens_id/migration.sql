/*
  Warnings:

  - You are about to drop the column `userId` on the `Cart` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userSuperTokensId]` on the table `Cart` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Cart" DROP CONSTRAINT "Cart_userId_fkey";

-- DropIndex
DROP INDEX "Cart_userId_key";

-- AlterTable
ALTER TABLE "Cart" DROP COLUMN "userId",
ADD COLUMN     "userSuperTokensId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userSuperTokensId_key" ON "Cart"("userSuperTokensId");

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userSuperTokensId_fkey" FOREIGN KEY ("userSuperTokensId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
