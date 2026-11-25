-- Snapshots para recotizar descuentos cuando cambia la cantidad de una línea
-- (devoluciones parciales) o el subtotal de la orden: las ofertas por cantidad
-- (3x2, "desde N") y los cupones con condiciones no son lineales.
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "offerParams" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponParams" JSONB;
