-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "quantityToGet" INTEGER,
ALTER COLUMN "discountValue" DROP NOT NULL;
