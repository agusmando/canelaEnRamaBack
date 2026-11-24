-- Columna generada: variantes con stock bajo o sin stock.
-- Espejo de stockLevel()/isLow() del dashboard: sin stock, o bajo el umbral.
ALTER TABLE "ProductVariant"
  ADD COLUMN "stockLow" BOOLEAN GENERATED ALWAYS AS (
    "currentStock" <= 0 OR ("stockThreshold" > 0 AND "currentStock" <= "stockThreshold")
  ) STORED;
