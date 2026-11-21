ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EDITOR';

CREATE TABLE "UserAddress" (
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

CREATE TABLE "ShippingZone" (
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

CREATE UNIQUE INDEX "UserAddress_userSuperTokensId_key" ON "UserAddress"("userSuperTokensId");
CREATE UNIQUE INDEX "ShippingZone_name_key" ON "ShippingZone"("name");
CREATE INDEX "ShippingZone_active_sortOrder_idx" ON "ShippingZone"("active", "sortOrder");

ALTER TABLE "UserAddress"
ADD CONSTRAINT "UserAddress_userSuperTokensId_fkey"
FOREIGN KEY ("userSuperTokensId") REFERENCES "User"("supertokensId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD COLUMN "shippingMethod" "ShipmentMethod",
ADD COLUMN "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "shippingProvider" TEXT,
ADD COLUMN "shippingZone" TEXT;
