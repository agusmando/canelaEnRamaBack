-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "discountAppliedSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "offerTypeSnapshot" TEXT NOT NULL DEFAULT '';
