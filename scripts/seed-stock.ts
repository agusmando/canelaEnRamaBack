/**
 * Carga stock de prueba en todas las variantes.
 *
 *   - Por unidad (U, sin presentaciones):  UNIT_STOCK unidades (10).
 *   - A granel (con packagingOptions):     presentación más grande × BULK_FACTOR
 *                                          (ej. [100, 250, 500] g -> 5000 g).
 *
 * Solo sube stock: si una variante ya tiene más que el objetivo, no se toca.
 * Cada cambio pasa por `set_stock_level`, que registra un movimiento ADJUSTMENT.
 *
 *   npm run seed:stock            aplica
 *   npm run seed:stock -- --dry   solo muestra qué haría
 */
import "dotenv/config";
import { prisma } from "../src/config/prisma/client.js";
import { StockMovementRepository } from "../src/repository/stockMovement.repository.js";

const UNIT_STOCK = 10;
const BULK_FACTOR = 10;
const dryRun = process.argv.includes("--dry");

const targetFor = (packagingOptions: number[]): number => {
  const options = packagingOptions.map(Number).filter((n) => n > 0);
  return options.length ? Math.round(Math.max(...options) * BULK_FACTOR) : UNIT_STOCK;
};

const variants = await prisma.productVariant.findMany({
  select: {
    id: true,
    name: true,
    currentStock: true,
    contentMeasure: true,
    packagingOptions: true,
    product: { select: { name: true } },
  },
  orderBy: { id: "asc" },
});

const repo = new StockMovementRepository();
let updated = 0;
let skipped = 0;
let failed = 0;

for (const v of variants) {
  const target = targetFor(v.packagingOptions);
  const label = `#${v.id} ${v.product.name} · ${v.name} (${v.contentMeasure})`;
  if (v.currentStock >= target) {
    skipped++;
    continue;
  }
  if (dryRun) {
    console.log(`[dry] ${label}: ${v.currentStock} -> ${target}`);
    updated++;
    continue;
  }
  try {
    const stock = await repo.setStockLevel(v.id, target);
    console.log(`${label}: ${v.currentStock} -> ${stock}`);
    updated++;
  } catch (error: any) {
    failed++;
    console.error(`${label}: ERROR ${error?.message ?? error}`);
  }
}

console.log(
  `\n${dryRun ? "[dry] " : ""}${updated} actualizadas · ${skipped} ya tenían stock suficiente · ${failed} con error`,
);
await prisma.$disconnect();
process.exit(failed ? 1 : 0);
