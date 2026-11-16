-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'IN_PROCESS', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "paymentPreferenceId" TEXT,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "paymentStatusDetail" TEXT;

-- CreateIndex
CREATE INDEX "Order_paymentType_paymentStatus_status_idx" ON "Order"("paymentType", "paymentStatus", "status");
