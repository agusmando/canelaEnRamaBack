-- Repara bases donde el historial marca availability como aplicado
-- pero las columnas no existen físicamente.
ALTER TABLE "ProductVariant"
  ADD COLUMN IF NOT EXISTS "availableWeb" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "availablePedidosYa" BOOLEAN NOT NULL DEFAULT true;
