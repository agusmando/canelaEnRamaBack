-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "shippingMethod" "ShipmentMethod" NOT NULL DEFAULT 'PICKUP',
ADD COLUMN     "shippingProvider" TEXT,
ADD COLUMN     "shippingZone" TEXT;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerDeliveryId" TEXT,
ADD COLUMN     "providerStatus" TEXT,
ADD COLUMN     "zone" TEXT;

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "UserAddress_userSuperTokensId_key" ON "UserAddress"("userSuperTokensId");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingZone_name_key" ON "ShippingZone"("name");

-- AddForeignKey
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_userSuperTokensId_fkey" FOREIGN KEY ("userSuperTokensId") REFERENCES "User"("supertokensId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Órdenes existentes: el método de envío sale de su envío (si tenían uno)
UPDATE "Order" o
SET "shippingMethod" = s."method", "shippingZone" = s."city"
FROM "Shipment" s
WHERE s."orderId" = o.id;

-- Departamentos del Gran Mendoza: se crean inactivos y en $0 hasta cargar la tarifa
INSERT INTO "ShippingZone" ("name", "price", "etaMinutes", "active", "sortOrder", "updatedAt") VALUES
  ('Godoy Cruz',     0, 60, false, 1, CURRENT_TIMESTAMP),
  ('Capital',        0, 60, false, 2, CURRENT_TIMESTAMP),
  ('Guaymallén',     0, 75, false, 3, CURRENT_TIMESTAMP),
  ('Las Heras',      0, 75, false, 4, CURRENT_TIMESTAMP),
  ('Luján de Cuyo',  0, 90, false, 5, CURRENT_TIMESTAMP),
  ('Maipú',          0, 90, false, 6, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
