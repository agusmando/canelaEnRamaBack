/*
  Warnings:

  - You are about to drop the column `stockTheshold` on the `Offer` table. All the data in the column will be lost.
  - Added the required column `stockThreshold` to the `Offer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Offer" DROP COLUMN "stockTheshold",
ADD COLUMN     "stockThreshold" INTEGER NOT NULL,
ALTER COLUMN "active" SET DEFAULT true;
