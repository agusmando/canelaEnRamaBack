/**
 * Exporta el catálogo (todo lo relacionado con Product/ProductVariant) a JSON.
 *
 *   npm run dump:catalog                 → scripts/output/catalog-<timestamp>.json
 *   npm run dump:catalog -- --out x.json
 *
 * Incluye: Supplier, Brand, Category, Tag, Product, ProductVariant, Dependency,
 * Image, Offer, StockMovement y las tablas puente _ProductToTag / _BrandToSupplier.
 * NO incluye usuarios, pedidos, reviews, banners ni envíos.
 *
 * Para restaurar: `npm run restore:catalog -- <archivo.json>` (ver restore-catalog.ts).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/config/prisma/client.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const outIdx = process.argv.indexOf("--out");
const outFile =
  outIdx !== -1
    ? process.argv[outIdx + 1]
    : path.join(here, "output", `catalog-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

// stockLow es dbgenerated: la DB lo recalcula, no se restaura.
const variants = (await prisma.productVariant.findMany({ orderBy: { id: "asc" } })).map(
  ({ stockLow: _stockLow, ...v }) => v
);

const dump = {
  exportedAt: new Date().toISOString(),
  supplier: await prisma.supplier.findMany({ orderBy: { id: "asc" } }),
  brand: await prisma.brand.findMany({ orderBy: { id: "asc" } }),
  brandToSupplier: await prisma.$queryRaw<{ A: number; B: number }[]>`
    SELECT "A", "B" FROM "_BrandToSupplier" ORDER BY "A", "B"`,
  category: await prisma.category.findMany({ orderBy: { id: "asc" } }),
  tag: await prisma.tag.findMany({ orderBy: { id: "asc" } }),
  product: await prisma.product.findMany({ orderBy: { id: "asc" } }),
  productVariant: variants,
  productToTag: await prisma.$queryRaw<{ A: number; B: number }[]>`
    SELECT "A", "B" FROM "_ProductToTag" ORDER BY "A", "B"`,
  dependency: await prisma.dependency.findMany({
    orderBy: [{ mixVariantId: "asc" }, { productVariantId: "asc" }],
  }),
  image: await prisma.image.findMany({ orderBy: { id: "asc" } }),
  offer: await prisma.offer.findMany({ orderBy: { id: "asc" } }),
  stockMovement: await prisma.stockMovement.findMany({ orderBy: { id: "asc" } }),
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(dump, null, 2));

const counts = Object.fromEntries(
  Object.entries(dump)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => [k, (v as unknown[]).length])
);
console.log(`Dump escrito en ${outFile}`);
console.log(counts);
await prisma.$disconnect();
