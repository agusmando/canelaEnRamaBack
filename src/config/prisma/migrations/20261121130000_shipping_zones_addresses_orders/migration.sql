ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EDITOR';

CREATE TABLE IF NOT EXISTS "UserAddress" (
    "id" SERIAL NOT NULL,
    "userSuperTokensId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "apartment" TEXT,
    "zone" TEXT NOT NULL,
    "city" TEXT,
    "province" TEXT NOT NULL DEFAULT 'Mendoza',
    "postalCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAddress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShippingZone" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "etaMinutes" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserAddress_userSuperTokensId_key" ON "UserAddress"("userSuperTokensId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShippingZone_name_key" ON "ShippingZone"("name");
CREATE INDEX IF NOT EXISTS "ShippingZone_active_sortOrder_idx" ON "ShippingZone"("active", "sortOrder");

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserAddress_userSuperTokensId_fkey') THEN
    ALTER TABLE "UserAddress" DROP CONSTRAINT "UserAddress_userSuperTokensId_fkey";
  END IF;
  ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_userSuperTokensId_fkey"
    FOREIGN KEY ("userSuperTokensId") REFERENCES "User"("supertokensId")
    ON DELETE CASCADE ON UPDATE CASCADE;
END $$;

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "shippingMethod" "ShipmentMethod" NOT NULL DEFAULT 'PICKUP',
ADD COLUMN IF NOT EXISTS "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "shippingProvider" TEXT,
ADD COLUMN IF NOT EXISTS "shippingZone" TEXT;
