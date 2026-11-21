-- Canal de venta: tienda online o mostrador (venta rápida desde el panel).
DO $$ BEGIN
  CREATE TYPE "OrderChannel" AS ENUM ('WEB', 'COUNTER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "channel" "OrderChannel" NOT NULL DEFAULT 'WEB';
CREATE INDEX IF NOT EXISTS "Order_channel_idx" ON "Order"("channel");
