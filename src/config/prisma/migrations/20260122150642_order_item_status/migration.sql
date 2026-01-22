-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('FULFILLED', 'AWAITING_STOCK', 'CANCELLED', 'RETURNED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "estimatedReadyAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "awaitingStockAt" TIMESTAMP(3),
ADD COLUMN     "status" "OrderItemStatus" NOT NULL DEFAULT 'FULFILLED';
