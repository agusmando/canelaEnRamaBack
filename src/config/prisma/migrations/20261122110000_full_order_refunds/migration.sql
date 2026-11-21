ALTER TABLE "Order"
  ADD COLUMN "refundId" TEXT,
  ADD COLUMN "refundStatus" TEXT,
  ADD COLUMN "refundAmount" DOUBLE PRECISION,
  ADD COLUMN "refundNote" TEXT,
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "refundEmailId" TEXT,
  ADD COLUMN "refundEmailSentAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Order_refundId_key" ON "Order"("refundId");
