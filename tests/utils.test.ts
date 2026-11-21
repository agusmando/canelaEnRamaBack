import { describe, expect, it, vi } from "vitest";
import { toE164 } from "../src/config/uber.js";
import { addressLine, streetLine } from "../src/services/shipping-quote.service.js";
import { rateLimit } from "../src/middleware/security.js";
import { StockMovementService } from "../src/services/stockMovement.service.js";

describe("toE164 (teléfonos argentinos)", () => {
  it.each([
    ["261 555-1234", "+5492615551234"],
    ["0261 5551234", "+5492615551234"],
    ["54 261 5551234", "+5492615551234"],
    ["5492615551234", "+5492615551234"],
    ["+1 (555) 000-1111", "+15550001111"],
  ])("%s → %s", (input, out) => expect(toE164(input)).toBe(out));
});

describe("direcciones", () => {
  const a = { street: "San Martín", number: "1234", apartment: "2° B", city: "Bombal", zone: "Godoy Cruz" };
  it("streetLine", () => expect(streetLine(a)).toBe("San Martín 1234, 2° B"));
  it("addressLine no repite localidad = departamento", () => {
    expect(addressLine(a)).toBe("San Martín 1234, 2° B, Bombal, Godoy Cruz");
    expect(addressLine({ ...a, apartment: null, city: "Godoy Cruz" })).toBe("San Martín 1234, Godoy Cruz");
  });
});

describe("rateLimit", () => {
  it("responde 429 al pasar el máximo", () => {
    const mw = rateLimit({ name: "test", windowMs: 60_000, max: 2 });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res: any = { setHeader: vi.fn(), status: vi.fn((c: number) => (statuses.push(c), res)), json: vi.fn() };
      mw({ ip: "1.1.1.1", method: "POST" }, res, () => statuses.push(200));
    }
    expect(statuses).toEqual([200, 200, 429]);
  });
});

describe("carga masiva de movimientos (validación)", () => {
  const svc = new StockMovementService();
  it("rechaza vacío y más de 200", async () => {
    await expect(svc.createBulk([])).rejects.toThrow(/No hay movimientos/);
    const many = Array.from({ length: 201 }, () => ({ productVariantId: 1, quantity: 1, type: "IN" }) as any);
    await expect(svc.createBulk(many)).rejects.toThrow(/Máximo 200/);
  });
  it("indica la fila con error y valida el signo", async () => {
    await expect(
      svc.createBulk([
        { productVariantId: 1, quantity: 5, type: "IN" },
        { productVariantId: 1, quantity: 5, type: "OUT" },
      ] as any),
    ).rejects.toThrow(/Fila 2: .*OUT/);
    await expect(svc.createBulk([{ productVariantId: 0, quantity: 1, type: "IN" }] as any)).rejects.toThrow(/Fila 1/);
    await expect(svc.createBulk([{ productVariantId: 1, quantity: 1.5, type: "IN" }] as any)).rejects.toThrow(/entero/);
  });
});

describe("fecha en movimientos manuales", () => {
  const svc = new StockMovementService();
  const row = (createdAt: string) => [{ productVariantId: 1, quantity: 1, type: "IN", createdAt }] as any;
  it("rechaza fechas futuras, inválidas o de hace más de un año", async () => {
    await expect(svc.createBulk(row(new Date(Date.now() + 86_400_000).toISOString()))).rejects.toThrow(/futura/);
    await expect(svc.createBulk(row("no-es-fecha"))).rejects.toThrow(/no es válida/);
    await expect(svc.createBulk(row(new Date(Date.now() - 400 * 86_400_000).toISOString()))).rejects.toThrow(/un año/);
  });
});


// ---------------------------------------------------------------- Búsqueda de catálogo
import { editDistance, normalizeText, rankByText, searchWords, stem } from "../src/utils/textSearch.js";
import { CatalogSearchService } from "../src/services/catalog-search.service.js";

describe("búsqueda de catálogo", () => {
  const items = [
    { id: 1, name: "Harina de almendras", text: "Harinas" },
    { id: 2, name: "Almendras", text: "Frutos secos" },
    { id: 3, name: "Nueces", text: "Frutos secos Mariposa" },
    { id: 4, name: "Maní salado", text: "Frutos secos" },
    { id: 5, name: "Avena", text: "Cereales Sin TACC" },
  ];

  it("normaliza acentos, mayúsculas y espacios", () => {
    expect(normalizeText("  Maní  ÑANDÚ ")).toBe("mani nandu");
  });

  it("primero lo que empieza con lo buscado, después nombre, después el resto", () => {
    expect(rankByText(items, "ALMENDRA")).toEqual([2, 1]);
    expect(rankByText(items, "frutos")).toEqual([2, 4, 3]);
  });

  it("todas las palabras, en cualquier orden y en cualquier campo", () => {
    expect(rankByText(items, "mariposa nuez")).toEqual([3]);
    expect(rankByText(items, "sin tacc")).toEqual([5]);
    expect(rankByText(items, "mani almendra")).toEqual([]);
  });

  it("singular / plural y palabras a medio escribir", () => {
    expect(stem("nueces")).toBe("nuez");
    expect(stem("almendras")).toBe("almendra");
    expect(rankByText(items, "nuez")).toEqual([3]);
    expect(rankByText(items, "almen")).toEqual([2, 1]);
    expect(rankByText(items, "mani")).toEqual([4]);
  });

  it("ignora palabras de relleno pero no 'sin'", () => {
    const more = [...items, { id: 6, name: "Harina almendras", text: "Harinas" }];
    expect(rankByText(more, "harina de almendras")).toEqual([6, 1]);
    expect(rankByText(more, "harina almendras")).toEqual([6, 1]);
    expect(rankByText(more, "harinas con almendras")).toEqual([6, 1]);
    expect(searchWords("galletas sin tacc")).toEqual(["galletas", "sin", "tacc"]);
    expect(searchWords("de la")).toEqual(["de", "la"]);
  });

  it("tolera errores de tipeo (después de las coincidencias exactas)", () => {
    expect(rankByText(items, "almedras")).toEqual([2, 1]);
    expect(rankByText(items, "harian de almendras")).toEqual([1]);
    expect(rankByText(items, "almnedra")).toEqual([2, 1]);
    expect(rankByText(items, "nueses")).toEqual([3]);
    // a medio escribir con un error
    expect(rankByText(items, "almedr")).toEqual([2, 1]);
    // palabras cortas: sin tolerancia
    expect(rankByText(items, "mano")).toEqual([]);
    expect(editDistance("almendra", "almnedra", 2)).toBe(1);
  });

  it("con 3+ palabras y sin resultados, todas menos una", () => {
    expect(rankByText(items, "harina almendras tostadas")).toEqual([1]);
    // con 2 palabras no hay plan B
    expect(rankByText(items, "almendras tostadas")).toEqual([]);
  });

  it("el índice se arma una vez y se renueva al invalidar", async () => {
    const findMany = vi.fn(async () => [
      { id: 7, name: "Miel", description: null, isLocal: true, Category: null, Brand: { name: "Canela en Rama" }, Tags: [], variants: [{ id: 70, name: "default", isLocal: null }, { id: 71, name: "Pote", isLocal: false }] },
    ]);
    const svc = new CatalogSearchService({ product: { findMany } });
    expect(await svc.productIds("productor local")).toEqual([7]);
    expect(await svc.variantIds("miel local")).toEqual([70]);
    expect(await svc.variantIds("miel pote")).toEqual([71]);
    expect(findMany).toHaveBeenCalledTimes(1);
    svc.invalidate();
    await svc.productIds("miel");
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
