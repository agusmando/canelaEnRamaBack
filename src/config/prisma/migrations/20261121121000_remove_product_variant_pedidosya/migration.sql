-- Elimina el indicador obsoleto de disponibilidad para PedidosYa.
ALTER TABLE "ProductVariant" DROP COLUMN IF EXISTS "availablePedidosYa";
