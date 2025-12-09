/*
  Warnings:

  - You are about to drop the column `mixId` on the `Dependency` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Dependency" DROP CONSTRAINT "Dependency_mixId_fkey";

-- AlterTable
ALTER TABLE "Dependency" DROP COLUMN "mixId";
