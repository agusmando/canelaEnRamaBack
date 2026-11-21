-- Productos y variantes de productores locales (sin marca comercial).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isLocal" BOOLEAN NOT NULL DEFAULT false;
-- null = hereda del producto
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "isLocal" BOOLEAN;
