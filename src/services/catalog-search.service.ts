import { prisma as sharedPrisma } from "../config/prisma/client.js";
import { rankByText, type Searchable } from "../utils/textSearch.js";

const LOCAL_TEXT = "productor local productores locales";
const names = (list?: { name: string }[] | null) => (list ?? []).map((x) => x.name).join(" ");
// "default" es el nombre automático de la variante única: no aporta a la búsqueda
const variantName = (n?: string | null) => (n && n !== "default" ? n : "");

/** Cuánto vive el índice en memoria si nadie toca el catálogo. */
const TTL_MS = 5 * 60 * 1000;

type Index = { products: Searchable[]; variants: Searchable[]; at: number };

/**
 * Búsqueda de catálogo (`?q=`) para productos y variantes, con las mismas
 * reglas que el buscador de la tienda (ver utils/textSearch).
 *
 * Los textos de todo el catálogo (unos cientos de filas) se leen una vez y se
 * guardan en memoria; cualquier alta/edición de productos, variantes,
 * categorías, marcas o etiquetas invalida el índice (ver `invalidate`).
 */
export class CatalogSearchService {
  private index: Index | null = null;
  private loading: Promise<Index> | null = null;
  private generation = 0;

  constructor(private readonly prisma: any = sharedPrisma) {}

  /** Lo llaman los repositorios después de escribir en el catálogo. */
  invalidate() {
    this.generation++;
    this.index = null;
    this.loading = null;
  }

  async productIds(q: unknown): Promise<number[]> {
    return rankByText((await this.getIndex()).products, q);
  }

  /** El "nombre" de una variante para ordenar es producto + variante. */
  async variantIds(q: unknown): Promise<number[]> {
    return rankByText((await this.getIndex()).variants, q);
  }

  private async getIndex(): Promise<Index> {
    if (this.index && Date.now() - this.index.at < TTL_MS) return this.index;
    if (!this.loading) {
      const gen = this.generation;
      this.loading = this.build()
        .then((idx) => {
          // Si alguien escribió mientras se armaba, no se guarda (pero se usa)
          if (gen === this.generation) this.index = idx;
          return idx;
        })
        .finally(() => {
          if (gen === this.generation) this.loading = null;
        });
    }
    return this.loading;
  }

  private async build(): Promise<Index> {
    const rows = await this.prisma.product.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        isLocal: true,
        Category: { select: { name: true } },
        Brand: { select: { name: true } },
        Tags: { select: { name: true } },
        variants: { select: { id: true, name: true, isLocal: true } },
      },
    });
    const products: Searchable[] = [];
    const variants: Searchable[] = [];
    for (const p of rows as any[]) {
      const common = [p.Category?.name, p.Brand?.name, names(p.Tags)];
      const anyLocal = p.isLocal || p.variants.some((v: any) => v.isLocal);
      products.push({
        id: p.id,
        name: p.name,
        text: [p.description, ...common, p.variants.map((v: any) => variantName(v.name)).join(" "), anyLocal ? LOCAL_TEXT : ""].join(" "),
      });
      for (const v of p.variants) {
        variants.push({
          id: v.id,
          name: `${p.name} ${variantName(v.name)}`,
          text: [...common, (v.isLocal ?? p.isLocal) ? LOCAL_TEXT : ""].join(" "),
        });
      }
    }
    return { products, variants, at: Date.now() };
  }
}

export const catalogSearch = new CatalogSearchService();

/**
 * Middleware para las rutas del catálogo: después de una escritura exitosa
 * (ya confirmada, la respuesta terminó) se descarta el índice de búsqueda.
 */
export const invalidateCatalogSearchOnWrite = (req: any, res: any, next: any) => {
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    res.on("finish", () => {
      if (res.statusCode < 400) catalogSearch.invalidate();
    });
  }
  next();
};
