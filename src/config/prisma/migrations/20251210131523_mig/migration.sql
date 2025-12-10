/*
  Warnings:

  - The primary key for the `Dependency` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Dependency` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Dependency" DROP CONSTRAINT "Dependency_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Dependency_pkey" PRIMARY KEY ("mixId", "productId");
