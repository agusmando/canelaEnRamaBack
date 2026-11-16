/**
 * Carga fotos de stock (Pixabay: licencia libre para uso comercial, sin atribución
 * obligatoria) en los productos
 * sin imagen y crea los banners de la tienda. Sube todo a Cloudinary.
 *
 *   npx tsx scripts/seed-images.ts                  productos + banners
 *   npx tsx scripts/seed-images.ts --products       solo productos
 *   npx tsx scripts/seed-images.ts --banners        solo banners
 *   npx tsx scripts/seed-images.ts --dry-run        muestra qué haría, sin subir ni escribir
 *   npx tsx scripts/seed-images.ts --limit 20       procesa como máximo 20 productos
 *   npx tsx scripts/seed-images.ts --ids 14,288     solo esos productos
 *   npx tsx scripts/seed-images.ts --force-banners  crea banners aunque la ubicación ya tenga
 *   npx tsx scripts/seed-images.ts --undo           borra (DB + Cloudinary) todo lo cargado por este script
 *
 * Env: PIXABAY_API_KEY (https://pixabay.com/api/docs/), DATABASE_URL, CLOUD_NAME,
 * CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 *
 * - Es re-ejecutable: saltea los productos que ya tienen imagen.
 * - Respeta el límite de Pixabay (100 consultas/minuto): si se agota, espera al reset.
 * - Cada alta queda en scripts/output/seed-images-log.jsonl (para --undo y créditos).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cloudinary from "cloudinary";
import { prisma } from "../src/config/prisma/client.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(here, "output", "seed-images-log.jsonl");
const QUERIES: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(here, "product-image-queries.json"), "utf8"),
);

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const opt = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY = flag("--dry-run");
const ONLY_PRODUCTS = flag("--products");
const ONLY_BANNERS = flag("--banners");
const LIMIT = Number(opt("--limit")) || Infinity;
const IDS = opt("--ids")?.split(",").map(Number).filter(Boolean);

cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const FOLDER = "canela-en-rama";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Pixabay

/** Foto elegida (se normaliza la respuesta de Pixabay a esta forma). */
type Photo = { id: number; url: string; photographer: string; src: { original: string }; tags: string[] };

/**
 * Búsqueda en Pixabay (https://pixabay.com/api/docs/). Límite: 100 consultas/minuto;
 * si se agota, espera lo que indica X-RateLimit-Reset (segundos).
 */
async function pixabaySearch(query: string, orientation: "all" | "horizontal" = "all"): Promise<Photo[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) throw new Error("Falta PIXABAY_API_KEY en el .env");
  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", key);
  url.searchParams.set("q", query.slice(0, 100));
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", orientation);
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", "80");

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const remaining = Number(res.headers.get("x-ratelimit-remaining"));
    const reset = Number(res.headers.get("x-ratelimit-reset")); // segundos hasta el reset
    if (res.status === 429) {
      const waitMs = (Number.isFinite(reset) && reset > 0 ? reset : 60) * 1000 + 1000;
      console.log(`  ⏳ límite de Pixabay alcanzado, espero ${Math.ceil(waitMs / 1000)} s…`);
      await sleep(waitMs);
      continue;
    }
    if (!res.ok) throw new Error(`Pixabay HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const data: any = await res.json();
    if (Number.isFinite(remaining) && remaining <= 1 && Number.isFinite(reset)) await sleep(reset * 1000 + 1000);
    return (data.hits ?? []).map((h: any) => ({
      id: h.id,
      url: h.pageURL,
      photographer: h.user,
      src: { original: h.largeImageURL },
      tags: String(h.tags ?? "").toLowerCase().split(",").map((t: string) => t.trim()).filter(Boolean),
    }));
  }
  throw new Error("Pixabay: demasiados reintentos");
}

const usedPhotos = new Set<number>();
/** Primera foto no usada todavía (evita repetir la misma foto en dos productos). */
async function pickPhoto(query: string, orientation: "square" | "landscape"): Promise<Photo | null> {
  let photos = await pixabaySearch(query, orientation === "landscape" ? "horizontal" : "all");
  // Sin resultados: se prueba con menos palabras ("smoked paprika powder" → "smoked paprika")
  const words = query.split(/\s+/);
  while (!photos.length && words.length > 1) {
    words.pop();
    photos = await pixabaySearch(words.join(" "));
  }
  const photo = bestMatch(photos, query);
  if (photo) usedPhotos.add(photo.id);
  return photo;
}

const STOP = new Set(["and", "with", "of", "the", "a", "in", "jar", "bottle", "bowl", "powder", "cup", "spoon", "glass"]);
/** Raíz simple para comparar singular/plural ("raisins" ~ "raisin", "berries" ~ "berry"). */
const stem = (w: string) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "");

/**
 * Pixabay ordena por popularidad, no por relevancia, y lista las etiquetas de cada foto de
 * la más a la menos relevante. Puntaje: por cada palabra buscada, cuánto antes aparece en
 * las etiquetas (primera etiqueta = máximo); bonus si una etiqueta es la frase completa.
 */
function bestMatch(photos: Photo[], query: string): Photo | null {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
  const keys = words.length ? words : query.toLowerCase().split(/\s+/).map(stem);
  const phrase = keys.join(" ");
  const score = (p: Photo) => {
    const tags = p.tags.slice(0, 12).map((t) => t.split(/\s+/).map(stem));
    let n = 0;
    for (const k of keys) {
      const idx = tags.findIndex((t) => t.includes(k));
      if (idx >= 0) n += 10 / (1 + idx);
    }
    const exact = tags.findIndex((t) => t.join(" ") === phrase);
    if (exact >= 0) n += 8 / (1 + exact);
    return n;
  };
  const ranked = photos
    .map((p, i) => ({ p, s: score(p) - i * 0.01 })) // a igual puntaje, el más popular
    .sort((a, b) => b.s - a.s);
  return ranked.find((r) => !usedPhotos.has(r.p.id))?.p ?? ranked[0]?.p ?? null;
}

/** largeImageURL: hasta 1280 px de lado; Cloudinary recorta al tamaño final. */
const sourceUrl = (p: Photo) => p.src.original;

// ---------------------------------------------------------------- Cloudinary

async function upload(url: string, publicId: string, transformation: object[]) {
  const res: any = await cloudinary.v2.uploader.upload(url, {
    public_id: publicId,
    overwrite: true,
    resource_type: "image",
    transformation,
  });
  return { public_id: res.public_id as string, secure_url: res.secure_url as string };
}

const log = (entry: object) => {
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
};

// ---------------------------------------------------------------- Productos

async function seedProducts() {
  const products = await prisma.product.findMany({
    where: IDS ? { id: { in: IDS } } : undefined,
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      variants: { orderBy: [{ active: "desc" }, { id: "asc" }], select: { id: true, _count: { select: { images: true } } } },
    },
  });
  const pending = products.filter((p) => p.variants.length && p.variants.every((v) => v._count.images === 0));
  const todo = pending.slice(0, LIMIT);
  console.log(`\n📦 Productos sin imagen: ${pending.length} (procesando ${todo.length})`);

  let ok = 0;
  let fail = 0;
  for (const [n, p] of todo.entries()) {
    const query = QUERIES[String(p.id)] ?? p.name;
    const tag = `[${n + 1}/${todo.length}] #${p.id} ${p.name}`;
    try {
      const photo = await pickPhoto(query, "square");
      if (!photo) {
        console.log(`  ✗ ${tag}: sin resultados para "${query}"`);
        fail++;
        continue;
      }
      if (DRY) {
        console.log(`  · ${tag} ← "${query}" → ${photo.url} [${photo.tags.slice(0, 4).join(", ")}]`);
        ok++;
        continue;
      }
      const img = await upload(sourceUrl(photo), `${FOLDER}/products/product-${p.id}`, [
        { width: 1000, height: 1000, crop: "fill", gravity: "auto" },
        { quality: "auto:good" },
      ]);
      const row = await prisma.image.create({
        data: { productVariantId: p.variants[0].id, public_id: img.public_id, secure_url: img.secure_url },
      });
      log({ kind: "product-image", productId: p.id, imageId: row.id, publicId: img.public_id, query, source: photo.url, photographer: photo.photographer });
      console.log(`  ✓ ${tag} ← "${query}" (${photo.photographer})`);
      ok++;
    } catch (err: any) {
      console.log(`  ✗ ${tag}: ${err.message}`);
      fail++;
    }
  }
  console.log(`📦 Listo: ${ok} ok, ${fail} con error`);
}

// ---------------------------------------------------------------- Banners

type BannerSeed = {
  placement: "HOME_HERO" | "HOME_RECOMMENDATION" | "CATALOG_STRIP" | "ANNOUNCEMENT_BAR";
  name: string;
  query?: string;
  eyebrow?: string;
  headline?: string;
  text?: string;
  ctaLabel?: string;
  linkUrl?: string;
  size?: "SQUARE" | "WIDE";
  /** Texto impreso sobre la imagen (para la franja del catálogo, que no muestra texto). */
  overlay?: { title: string; subtitle?: string };
};

const BANNERS: BannerSeed[] = [
  // Carrusel principal (1920×600 / mobile 800×800)
  { placement: "HOME_HERO", name: "Hero granel", query: "bulk food store jars", eyebrow: "Almacén natural · Godoy Cruz", headline: "Lo natural, a granel y como lo necesitás", text: "Frutos secos, harinas, legumbres y especias fraccionados en el momento. Elegí el peso y nosotros lo preparamos.", ctaLabel: "Ver productos", linkUrl: "/productos" },
  { placement: "HOME_HERO", name: "Hero sin TACC", query: "gluten free baking flour", eyebrow: "Apto celíacos", headline: "Todo para tu cocina sin TACC", text: "Harinas, premezclas, panificados y snacks libres de gluten, en un solo lugar.", ctaLabel: "Explorar Sin TACC", linkUrl: "/productos?categoria=sin-tacc" },
  { placement: "HOME_HERO", name: "Hero ofertas", query: "dried fruits and nuts market", eyebrow: "Ofertas", headline: "Llevá más, pagá menos", text: "Descuentos por cantidad y promos en productos seleccionados. Se aplican solos en tu carrito.", ctaLabel: "Ver ofertas", linkUrl: "/ofertas" },
  { placement: "HOME_HERO", name: "Hero frutos secos", query: "almonds walnuts cashews", eyebrow: "Snacks saludables", headline: "Frutos secos y mixes para cada momento", text: "Almendras, nueces, castañas y nuestros mixes de la casa, frescos y al mejor precio.", ctaLabel: "Ver frutos secos", linkUrl: "/productos?categoria=frutos-secos" },
  { placement: "HOME_HERO", name: "Hero especias", query: "colorful spices bowls", eyebrow: "Hierbas y especias", headline: "El sabor está en los detalles", text: "Más de 40 especias y hierbas para darle vida a tus recetas.", ctaLabel: "Ver especias", linkUrl: "/productos?categoria=especias" },

  // Recomendaciones (SQUARE 600×600, WIDE 1200×420), alternando
  { placement: "HOME_RECOMMENDATION", size: "SQUARE", name: "Recomendación frutos secos", query: "mixed nuts bowl", headline: "Elevá tus snacks con nuestros frutos secos", linkUrl: "/productos?categoria=frutos-secos" },
  { placement: "HOME_RECOMMENDATION", size: "WIDE", name: "Recomendación sin TACC", query: "gluten free bread", headline: "Descubrí nuestros productos libres de gluten", linkUrl: "/productos?categoria=sin-tacc" },
  { placement: "HOME_RECOMMENDATION", size: "WIDE", name: "Recomendación especias", query: "spices wooden spoons", headline: "Realzá tus recetas con nuestras especias únicas", linkUrl: "/productos?categoria=especias" },
  { placement: "HOME_RECOMMENDATION", size: "SQUARE", name: "Recomendación desayuno", query: "granola breakfast bowl", headline: "Armá y amá tu desayuno", linkUrl: "/productos?categoria=cereales-para-el-desayuno" },
  { placement: "HOME_RECOMMENDATION", size: "SQUARE", name: "Recomendación hongos", query: "medicinal mushrooms", headline: "Hongos adaptógenos para tu bienestar", linkUrl: "/productos?categoria=hongos-adaptogenos" },
  { placement: "HOME_RECOMMENDATION", size: "WIDE", name: "Recomendación hierbas", query: "herbal tea leaves cup", headline: "Hierbas e infusiones para cada momento", linkUrl: "/productos?categoria=hierbas" },

  // Franja de /productos y /ofertas (1600×300 / 800×300), con texto impreso
  { placement: "CATALOG_STRIP", name: "Franja granel", query: "grains seeds jars", headline: "A granel y al peso que necesitás", linkUrl: "/productos", overlay: { title: "A granel y al peso que necesitás", subtitle: "Fraccionamos en el momento" } },
  { placement: "CATALOG_STRIP", name: "Franja ofertas", query: "nuts dried fruit top view", headline: "Llevá más, pagá menos", linkUrl: "/ofertas", overlay: { title: "Llevá más · pagá menos", subtitle: "Descuentos por cantidad" } },
  { placement: "CATALOG_STRIP", name: "Franja sin TACC", query: "gluten free flour baking", headline: "Todo Sin TACC", linkUrl: "/productos?categoria=sin-tacc", overlay: { title: "Todo para tu cocina Sin TACC", subtitle: "Apto celíacos" } },

  // Barra de anuncio (solo texto)
  { placement: "ANNOUNCEMENT_BAR", name: "Anuncio envíos", text: "Envíos y retiros en Godoy Cruz, Mendoza · Coordinamos por WhatsApp", ctaLabel: "Ver envíos", linkUrl: "/envios" },
];

const fill = (width: number, height: number) => ({ width, height, crop: "fill", gravity: "auto" });

/** Oscurece la imagen y le imprime título/subtítulo (Cloudinary text overlay). */
function overlayTransform(o: NonNullable<BannerSeed["overlay"]>, width: number, height: number) {
  const mobile = width < 1000;
  const t: object[] = [fill(width, height), { effect: "brightness:-45" }];
  t.push({
    overlay: { font_family: "Arial", font_size: mobile ? 46 : 64, font_weight: "bold", text: o.title },
    color: "#ffffff",
    gravity: mobile ? "center" : "west",
    x: mobile ? 0 : 90,
    y: o.subtitle ? (mobile ? -22 : -24) : 0,
    width: mobile ? width - 80 : undefined,
    crop: mobile ? "fit" : undefined,
  });
  if (o.subtitle) {
    t.push({
      overlay: { font_family: "Arial", font_size: mobile ? 28 : 34, text: o.subtitle },
      color: "#ffffff",
      gravity: mobile ? "center" : "west",
      x: mobile ? 0 : 92,
      y: mobile ? 34 : 40,
    });
  }
  t.push({ quality: "auto:good" });
  return t;
}

function sizesFor(b: BannerSeed): { desktop?: [number, number]; mobile?: [number, number] } {
  switch (b.placement) {
    case "HOME_HERO":
      return { desktop: [1920, 600], mobile: [800, 800] };
    case "HOME_RECOMMENDATION":
      return b.size === "SQUARE" ? { desktop: [600, 600], mobile: [800, 450] } : { desktop: [1200, 420], mobile: [800, 280] };
    case "CATALOG_STRIP":
      return { desktop: [1600, 300], mobile: [800, 300] };
    default:
      return {};
  }
}

async function seedBanners() {
  const force = flag("--force-banners");
  const existing = await prisma.banner.groupBy({ by: ["placement"], where: { active: true }, _count: true });
  const has = new Map(existing.map((e: any) => [e.placement, e._count]));
  console.log(`\n🖼️  Banners (existentes activos: ${JSON.stringify(Object.fromEntries(has))})`);

  const position = new Map<string, number>();
  for (const b of BANNERS) {
    if (has.get(b.placement) && !force) {
      console.log(`  – ${b.name}: ${b.placement} ya tiene banners activos (usá --force-banners)`);
      continue;
    }
    const pos = position.get(b.placement) ?? 0;
    position.set(b.placement, pos + 1);
    try {
      const data: any = {
        placement: b.placement,
        name: b.name,
        eyebrow: b.eyebrow ?? null,
        headline: b.headline ?? null,
        text: b.text ?? null,
        ctaLabel: b.ctaLabel ?? null,
        linkUrl: b.linkUrl ?? null,
        size: b.size ?? null,
        position: pos,
        active: true,
      };
      let photo: Photo | null = null;
      if (b.query) {
        photo = await pickPhoto(b.query, "landscape");
        if (!photo) throw new Error(`sin resultados para "${b.query}"`);
      }
      if (DRY) {
        console.log(`  · ${b.placement} ${b.name}${photo ? ` → ${photo.url} [${photo.tags.slice(0, 4).join(", ")}]` : ""}`);
        continue;
      }
      const publicIds: string[] = [];
      if (photo) {
        const sizes = sizesFor(b);
        const slug = b.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
        for (const kind of ["desktop", "mobile"] as const) {
          const size = sizes[kind];
          if (!size) continue;
          const transformation = b.overlay ? overlayTransform(b.overlay, ...size) : [fill(...size), { quality: "auto:good" }];
          const img = await upload(sourceUrl(photo), `${FOLDER}/banners/${slug}-${kind}`, transformation);
          data[`${kind}ImageUrl`] = img.secure_url;
          data[`${kind}ImagePublicId`] = img.public_id;
          publicIds.push(img.public_id);
        }
      }
      const row = await prisma.banner.create({ data });
      log({ kind: "banner", bannerId: row.id, placement: b.placement, publicIds, source: photo?.url ?? null, photographer: photo?.photographer ?? null });
      console.log(`  ✓ ${b.placement} ${b.name}${photo ? ` (${photo.photographer})` : ""}`);
    } catch (err: any) {
      console.log(`  ✗ ${b.name}: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------- Deshacer

async function undo() {
  if (!fs.existsSync(LOG)) {
    console.log("No hay nada para deshacer (no existe el log).");
    return;
  }
  const entries = fs.readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  console.log(`↩️  Deshaciendo ${entries.length} altas…`);
  for (const e of entries) {
    try {
      if (e.kind === "product-image") {
        if (!DRY) await prisma.image.deleteMany({ where: { id: e.imageId } });
        if (!DRY) await cloudinary.v2.uploader.destroy(e.publicId);
      } else if (e.kind === "banner") {
        if (!DRY) await prisma.banner.deleteMany({ where: { id: e.bannerId } });
        for (const id of e.publicIds ?? []) if (!DRY) await cloudinary.v2.uploader.destroy(id);
      }
    } catch (err: any) {
      console.log(`  ✗ ${JSON.stringify(e)}: ${err.message}`);
    }
  }
  if (!DRY) fs.renameSync(LOG, LOG.replace(/\.jsonl$/, `.undone-${Date.now()}.jsonl`));
  console.log("↩️  Listo.");
}

// ---------------------------------------------------------------- Main

async function main() {
  if (flag("--undo")) return undo();
  if (DRY) console.log("(simulación: no se sube ni se escribe nada)");
  if (!ONLY_BANNERS) await seedProducts();
  if (!ONLY_PRODUCTS && !IDS) await seedBanners();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
