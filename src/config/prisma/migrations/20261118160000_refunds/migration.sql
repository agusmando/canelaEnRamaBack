-- Reintegros de Mercado Pago (totales o parciales) hechos desde el panel.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "Refund" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "paymentId" TEXT NOT NULL,
    "mpRefundId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_mpRefundId_key" ON "Refund"("mpRefundId");
CREATE INDEX IF NOT EXISTS "Refund_orderId_idx" ON "Refund"("orderId");

-- Pedidos ya pagados: lo cobrado era el total de ese momento (aproximación;
-- el reintegro igual consulta el saldo real en Mercado Pago).
UPDATE "Order" SET "paidAmount" = "totalPrice" + "shippingCost"
WHERE "paymentStatus" = 'APPROVED' AND "paymentType" = 'MERCADOPAGO' AND "paidAmount" IS NULL;
