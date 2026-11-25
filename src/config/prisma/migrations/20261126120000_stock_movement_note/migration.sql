-- Nota descriptiva en movimientos de stock (ej. "Venta · pedido #123", motivo de un ajuste manual).
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "note" TEXT;
