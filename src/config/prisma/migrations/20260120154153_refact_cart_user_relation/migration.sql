-- DropForeignKey
ALTER TABLE "Cart" DROP CONSTRAINT "Cart_userSuperTokensId_fkey";

-- AlterTable
ALTER TABLE "Cart" ALTER COLUMN "userSuperTokensId" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userSuperTokensId_fkey" FOREIGN KEY ("userSuperTokensId") REFERENCES "User"("supertokensId") ON DELETE SET NULL ON UPDATE CASCADE;
