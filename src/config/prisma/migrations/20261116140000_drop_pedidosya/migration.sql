-- Se deja de usar PedidosYa: se elimina la disponibilidad por canal.
ALTER TABLE "ProductVariant" DROP COLUMN IF EXISTS "availablePedidosYa";
