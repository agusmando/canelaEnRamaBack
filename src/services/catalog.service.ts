import { prisma as sharedPrisma } from "../config/prisma/client.js";
import { ProductRepository } from "../repository/product.repository.js";
import { PricingService } from "./pricing.service.js";
import { computeFinalPrice } from "../utils/pricing.js";
import { normalizeText, searchScore, searchWords } from "../utils/textSearch.js";

/**
 * Catálogo de la tienda con búsqueda y filtros del lado del servidor
 * (`GET /api/catalog`): reemplaza al catálogo completo que la web bajaba
 * entera para filtrar/ordenar en el cliente.
 *
 * El índice en memoria guarda por producto lo que la tarjeta necesita
 * (precio de tarjeta con oferta, stock, oferta vigente, tipo de local) y
 * los textos de búsqueda; se renueva solo o al escribir en el catálogo
 * (`invalidate`, llamado por el middleware de rutas).
 */

const TTL_MS = 5 * 60 * 1000;
const MAX_PER_PAGE = 100;
const LOCAL_TEXT = " productor local productores locales mendoza";

const OFFER_SELECT = {
  id: true,
  active: true,
  startTime: true,
  finishTime: true,
  stockThreshold: true,
  discountType: true,
  discountValue: true,
  discountQuantity: true,
  quantityToGet: true,
} as const;

const slugify = (s: unknown) =>
  normalizeText(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const list = (v: unknown) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

interface CatalogEntry {
  id: number;
  name: string;
  catSlug: string;
  brandSlug: string;
  tagSlugs: string[];
  localKind: "all" | "some" | null;
  price: number;
  hasStock: boolean;
  hasOffer: boolean;
  searchName: string;
  searchRest: string;
}

type Index = { entries: CatalogEntry[]; at: number };

export class CatalogService {
  private index: Index | null = null;
  private loading: Promise<Index> | null = null;
  private generation = 0;

  constructor(
    private readonly prisma: any = sharedPrisma,
    private readonly productRepository = new ProductRepository(),
    private readonly pricing = new PricingService(),
  ) {}

  invalidate() {
    this.generation++;
    this.index = null;
    this.loading = null;
  }

  /**
   * Busca y pagina el catálogo. Devuelve `{ content, totalElements, facets }`
   * donde `content` son productos completos (variantes, imágenes, ofertas…).
   */
  async search(query: any) {
    const { entries } = await this.getIndex();
    const facets = this.facets(entries);

    const words = searchWords(query?.q);
    const cats = list(query?.categoria);
    const tags = list(query?.etiqueta);
    const brands = list(query?.marca);
    const onlyOffers = this.flag(query?.ofertas);
    const onlyLocal = this.flag(query?.local);
    const min = this.num(query?.min);
    const max = this.num(query?.max);
    const orden = String(query?.orden ?? "relevancia");

    let matched = entries.filter((e) => {
      if (cats.length && !cats.includes(e.catSlug)) return false;
      if (tags.length && !tags.every((t) => e.tagSlugs.includes(t))) return false;
      // Los productos 100 % locales se muestran como "Productor local", no por su marca
      if (brands.length && (e.localKind === "all" || !brands.includes(e.brandSlug))) return false;
      if (onlyLocal && !e.localKind) return false;
      if (onlyOffers && !e.hasOffer) return false;
      if (min !== null && e.price < min) return false;
      if (max !== null && e.price > max) return false;
      return true;
    });

    // Relevancia de la búsqueda (espejo del front): todas las palabras; con 3+
    // y sin resultados, todas menos una.
    let scores: Map<number, number> | null = null;
    if (words.length) {
      const run = (partial: boolean) => {
        const map = new Map<number, number>();
        for (const e of matched) {
          const score = searchScore(e.searchName, e.searchRest, words, partial);
          if (score !== null) map.set(e.id, score);
        }
        return map;
      };
      scores = run(false);
      if (!scores.size && words.length >= 3) scores = run(true);
      matched = matched.filter((e) => scores!.has(e.id));
    }

    const byName = (a: CatalogEntry, b: CatalogEntry) => a.name.localeCompare(b.name, "es");
    const sorters: Record<string, (a: CatalogEntry, b: CatalogEntry) => number> = {
      relevancia: (a, b) =>
        (scores?.get(a.id) ?? 0) - (scores?.get(b.id) ?? 0) ||
        Number(b.hasStock) - Number(a.hasStock) ||
        byName(a, b),
      "precio-asc": (a, b) => a.price - b.price,
      "precio-desc": (a, b) => b.price - a.price,
      nombre: byName,
      nuevos: (a, b) => b.id - a.id,
    };
    matched.sort(sorters[orden] ?? sorters.relevancia);

    const page = Math.max(1, Number(query?.currentPage ?? query?.page) || 1);
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Number(query?.amountPerPage) || 10));
    const pageIds = matched.slice((page - 1) * perPage, page * perPage).map((e) => e.id);

    // La página de productos completa sale del repositorio (mismo include que /product).
    const result = pageIds.length
      ? await this.productRepository.searchRanked({}, matched.map((e) => e.id), true, page, perPage, true)
      : { entityList: [], currentPage: page, amountPerPage: perPage, totalElements: matched.length };

    return { content: result.entityList, totalElements: result.totalElements || matched.length, facets };
  }

  /**
   * "Los más pedidos": productos ordenados por cantidad de órdenes distintas en
   * las que aparecieron (órdenes y líneas no canceladas de los últimos `days`).
   * Devuelve productos completos en ese orden; se cachea 10 minutos.
   */
  private bestSellersCache: { key: string; at: number; data: any } | null = null;

  async bestSellers(query: any) {
    const days = Math.min(365, Math.max(7, Number(query?.days) || 90));
    const limit = Math.min(48, Math.max(4, Number(query?.limit) || 24));
    const key = `${days}:${limit}`;
    if (this.bestSellersCache?.key === key && Date.now() - this.bestSellersCache.at < 10 * 60 * 1000) {
      return this.bestSellersCache.data;
    }

    const since = new Date(Date.now() - days * 86400e3);
    const items = await this.prisma.orderItem.findMany({
      where: {
        productVariantId: { not: null },
        status: { notIn: ["CANCELLED", "RETURNED"] },
        Order: { status: { not: "CANCELLED" }, createdAt: { gte: since } },
      },
      select: { orderId: true, productVariant: { select: { productId: true } } },
    });

    const ordersByProduct = new Map<number, Set<number>>();
    for (const it of items as any[]) {
      const pid = it.productVariant?.productId;
      if (!pid) continue;
      const set = ordersByProduct.get(pid) ?? new Set<number>();
      set.add(it.orderId);
      ordersByProduct.set(pid, set);
    }

    // Solo productos vendibles en la web (mismo criterio que el índice del catálogo).
    const { entries } = await this.getIndex();
    const sellable = new Set(entries.map((e) => e.id));
    const ranked = [...ordersByProduct.entries()]
      .filter(([pid]) => sellable.has(pid))
      .sort((a, b) => b[1].size - a[1].size || a[0] - b[0])
      .slice(0, limit)
      .map(([pid]) => pid);

    const result = ranked.length
      ? await this.productRepository.searchRanked({}, ranked, false, 1, ranked.length, true)
      : { entityList: [], currentPage: 1, amountPerPage: ranked.length, totalElements: 0 };
    const data = { content: result.entityList, totalElements: result.totalElements };
    this.bestSellersCache = { key, at: Date.now(), data };
    return data;
  }

  /** Conteos de los filtros sobre TODO el catálogo vendible (como hacía el front). */
  private facets(entries: CatalogEntry[]) {
    const categories: Record<string, number> = {};
    const brands: Record<string, number> = {};
    let local = 0;
    let top = 0;
    for (const e of entries) {
      if (e.catSlug) categories[e.catSlug] = (categories[e.catSlug] ?? 0) + 1;
      if (e.brandSlug && e.localKind !== "all") brands[e.brandSlug] = (brands[e.brandSlug] ?? 0) + 1;
      if (e.localKind) local++;
      top = Math.max(top, e.price);
    }
    return { categories, brands, local, priceCeil: Math.max(1000, Math.ceil(top / 1000) * 1000) };
  }

  private flag(v: unknown) {
    return v === true || ["true", "1", "on"].includes(String(v).toLowerCase());
  }

  private num(v: unknown) {
    const n = Number(v);
    return Number.isFinite(n) && v !== null && v !== undefined && v !== "" ? n : null;
  }

  private async getIndex(): Promise<Index> {
    if (this.index && Date.now() - this.index.at < TTL_MS) return this.index;
    if (!this.loading) {
      const gen = this.generation;
      this.loading = this.build()
        .then((idx) => {
          if (gen === this.generation) this.index = idx;
          return idx;
        })
        .finally(() => {
          if (gen === this.generation) this.loading = null;
        });
    }
    return this.loading;
  }

  /**
   * Una entrada por producto activo con al menos una variante visible en la
   * web (espejo de `cardPrice`/`localKind`/`hasOffer` de la tienda).
   */
  private async build(): Promise<Index> {
    const rows = await this.prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        description: true,
        isLocal: true,
        Category: { select: { name: true } },
        Brand: { select: { name: true } },
        Tags: { select: { name: true } },
        offers: { select: OFFER_SELECT },
        variants: {
          select: {
            id: true,
            name: true,
            isLocal: true,
            active: true,
            availableWeb: true,
            currentStock: true,
            contentMeasure: true,
            packagingOptions: true,
            price: true,
            profitMargin: true,
            roundingOption: true,
            stockThreshold: true,
            offers: { select: OFFER_SELECT },
          },
        },
      },
    });

    const entries: CatalogEntry[] = [];
    for (const p of rows as any[]) {
      const variants = (p.variants ?? [])
        .map((v: any) => ({ ...v, finalPrice: computeFinalPrice(v) }))
        .filter((v: any) => v.active !== false && v.availableWeb !== false && v.finalPrice > 0)
        .sort((a: any, b: any) => a.finalPrice - b.finalPrice);
      if (!variants.length) continue;

      const card = variants.find((v: any) => Number(v.currentStock) > 0) ?? variants[0];
      const packs = (card.packagingOptions ?? []).map(Number).filter((n: number) => n > 0).sort((a: number, b: number) => a - b);
      // Venta suelta: precio por kg (1000 g) o por unidad, igual que cardPrice.
      const size = packs[0] ?? (card.contentMeasure === "KG" ? 1000 : 1);
      const quote = this.pricing.quote({
        productVariant: { ...card, product: { offers: p.offers ?? [] } },
        quantity: size,
      });

      const localCount = variants.filter((v: any) => v.isLocal ?? p.isLocal).length;
      const localKind = localCount === 0 ? null : localCount === variants.length ? "all" : "some";

      const hasOffer = variants.some((v: any) =>
        this.pricing.selectOffer(v.offers ?? [], p.offers ?? [], Number(v.currentStock ?? 0), Number(v.stockThreshold ?? 0)),
      );

      const catName = p.Category?.name ?? "";
      const brandName = p.Brand?.name ?? "";
      const tagNames = (p.Tags ?? []).map((t: any) => t.name).join(" ");
      // Mismo texto que armaba el front para puntuar la búsqueda.
      const rest = `${p.description ?? ""} ${catName} ${localKind === "all" ? "" : brandName} ${tagNames}${localKind ? LOCAL_TEXT : ""}`;

      entries.push({
        id: p.id,
        name: p.name,
        catSlug: slugify(catName),
        brandSlug: slugify(brandName),
        tagSlugs: (p.Tags ?? []).map((t: any) => slugify(t.name)),
        localKind,
        price: quote.totalPriceSnapshot,
        hasStock: variants.some((v: any) => Number(v.currentStock) > 0),
        hasOffer,
        searchName: normalizeText(p.name),
        searchRest: normalizeText(rest),
      });
    }
    return { entries, at: Date.now() };
  }
}

export const catalogService = new CatalogService();

/** Middleware: tras una escritura exitosa en el catálogo se descarta el índice. */
export const invalidateCatalogOnWrite = (req: any, res: any, next: any) => {
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    res.on("finish", () => {
      if (res.statusCode < 400) catalogService.invalidate();
    });
  }
  next();
};
