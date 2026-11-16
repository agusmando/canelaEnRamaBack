-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_productVariantId_fkey";

-- AlterTable
ALTER TABLE "Offer" ALTER COLUMN "productVariantId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
