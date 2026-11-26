/**
 * Restaura un dump generado por dump-catalog.ts.
 *
 *   npm run restore:catalog -- scripts/output/catalog-XXXX.json
 *
 * Inserta en orden de FKs y hace upsert por id: las filas existentes se
 * actualizan con los valores del dump (el catálogo queda igual que en el dump).
 * Las tablas puente (_ProductToTag, _BrandToSupplier) solo insertan lo que falta.
 *
 * OJO: apunta a la DATABASE_URL del .env (producción remota). Para restaurar en
 * otra base, apuntá DATABASE_URL/DIRECT_URL a ese destino antes de correrlo.
 */
import "dotenv/config";
import fs from "node:fs";
import { prisma } from "../src/config/prisma/client.js";

const file = process.argv[2];
if (!file) {
  console.error("Uso: npm run restore:catalog -- <archivo.json>");
  process.exit(1);
}
const dump = JSON.parse(fs.readFileSync(file, "utf8"));

const revive = (rows: any[]) => rows.map((r) => ({ ...r }));

async function upsertById(model: any, rows: any[]) {
  let n = 0;
  for (const row of rows) {
    const { id, ...rest } = row;
    await model.upsert({ where: { id }, create: row, update: rest });
    n++;
  }
  return n;
}

const results: Record<string, number> = {};

results.supplier = await upsertById(prisma.supplier, revive(dump.supplier ?? []));
results.brand = await upsertById(prisma.brand, revive(dump.brand ?? []));
for (const { A, B } of dump.brandToSupplier ?? []) {
  await prisma.$executeRaw`INSERT INTO "_BrandToSupplier" ("A","B") VALUES (${A},${B}) ON CONFLICT DO NOTHING`;
}
results.brandToSupplier = (dump.brandToSupplier ?? []).length;

results.category = await upsertById(prisma.category, revive(dump.category ?? []));
results.tag = await upsertById(prisma.tag, revive(dump.tag ?? []));
results.product = await upsertById(prisma.product, revive(dump.product ?? []));
results.productVariant = await upsertById(prisma.productVariant, revive(dump.productVariant ?? []));

for (const { A, B } of dump.productToTag ?? []) {
  await prisma.$executeRaw`INSERT INTO "_ProductToTag" ("A","B") VALUES (${A},${B}) ON CONFLICT DO NOTHING`;
}
results.productToTag = (dump.productToTag ?? []).length;

for (const row of revive(dump.dependency ?? [])) {
  const { mixVariantId, productVariantId, ...rest } = row;
  await prisma.dependency.upsert({
    where: { mixVariantId_productVariantId: { mixVariantId, productVariantId } },
    create: row,
    update: rest,
  });
}
results.dependency = (dump.dependency ?? []).length;

results.image = await upsertById(prisma.image, revive(dump.image ?? []));
results.offer = await upsertById(prisma.offer, revive(dump.offer ?? []));
results.stockMovement = await upsertById(prisma.stockMovement, revive(dump.stockMovement ?? []));

console.log("Restaurado:", results);
await prisma.$disconnect();
