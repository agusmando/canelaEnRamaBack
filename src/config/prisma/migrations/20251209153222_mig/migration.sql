-- DropIndex
DROP INDEX "User_email_key";

-- CreateTable
CREATE TABLE "Dependency" (
    "id" SERIAL NOT NULL,
    "mixId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Dependency_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_mixId_fkey" FOREIGN KEY ("mixId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
