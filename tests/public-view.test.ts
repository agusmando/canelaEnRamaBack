import { describe, expect, it, vi } from "vitest";
import { hideCostForPublic, hideProductsForPublic, webOnlyForPublic } from "../src/middleware/publicView.js";
import { productPostProcessingMapping } from "../src/mappings/products/product-post-procesing.mapping.js";
import { parseNullableBoolean } from "../src/utils/prismaUpdateEntityBuilder.js";
import { prismaCreateEntityBuilder } from "../src/utils/prismaCreateEntityBuilder.js";
import { prismaUpdateEntityBuilder } from "../src/utils/prismaUpdateEntityBuilder.js";
import { productVariantCreateMapping } from "../src/mappings/product-variants/product-variant-create.mapping.js";
import { productVariantUpdateMapping } from "../src/mappings/product-variants/product-variant-update.mapping.js";

/** Corre el middleware y devuelve lo que se termina mandando con res.json. */
const run = (mw: any, roles: string[], body: any) => {
  const sent: { status: number; body: any } = { status: 200, body: undefined };
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => ((res.statusCode = c), (sent.status = c), res));
  res.json = (b: any) => ((sent.body = b), res);
  mw({ userRoles: roles, session: roles.length ? { getUserId: () => "u" } : undefined }, res, () => undefined);
  res.status(200).json(body);
  return sent;
};

const product = {
  id: 1,
  name: "Pan",
  variants: [
    { id: 10, active: true, availableWeb: true, price: 100, finalPrice: 150 },
    { id: 11, active: true, availableWeb: false, price: 100, finalPrice: 150 },
    { id: 12, active: false, availableWeb: true, price: 100, finalPrice: 150 },
  ],
};

describe("hideCostForPublic", () => {
  it("oculta costo y proveedores a clientes", () => {
    const { body } = run(hideCostForPublic, [], { response: { ...product, suppliers: [{ phone: "1" }] } });
    expect(body.response.suppliers).toBeUndefined();
    expect(body.response.variants[0].price).toBeUndefined();
    expect(body.response.variants[0].finalPrice).toBe(150);
  });
  it("el staff ve todo", () => {
    const { body } = run(hideCostForPublic, ["EMPLOYEE"], { response: product });
    expect(body.response.variants[0].price).toBe(100);
  });
});

describe("webOnlyForPublic", () => {
  it("saca variantes ocultas o inactivas del detalle", () => {
    const { body } = run(webOnlyForPublic("product"), [], { response: product });
    expect(body.response.variants.map((v: any) => v.id)).toEqual([10]);
  });

  it("producto sin variantes visibles: 404 en detalle y fuera del listado", () => {
    const hidden = { ...product, id: 2, variants: [product.variants[1]] };
    expect(run(webOnlyForPublic("product"), [], { response: hidden }).status).toBe(404);
    const list = run(webOnlyForPublic("product"), [], { response: [product, hidden] }).body.response;
    expect(list.map((p: any) => p.id)).toEqual([1]);
    const page = run(webOnlyForPublic("product"), [], { response: { content: [hidden], pagination: {} } }).body.response;
    expect(page.content).toEqual([]);
  });

  it("variante oculta da 404", () => {
    expect(run(webOnlyForPublic("variant"), [], { response: product.variants[1] }).status).toBe(404);
  });

  it("variante de un producto inactivo da 404", () => {
    const v = { ...product.variants[0], product: { id: 1, active: false } };
    expect(run(webOnlyForPublic("variant"), [], { response: v }).status).toBe(404);
  });

  it("producto inactivo da 404 aunque tenga variantes visibles", () => {
    expect(run(webOnlyForPublic("product"), [], { response: { ...product, active: false } }).status).toBe(404);
  });

  it("no manda las relaciones de mix (pueden nombrar variantes ocultas)", () => {
    const mix = {
      ...product,
      variants: [{ ...product.variants[0], hasComponents: [{ componentProduct: product.variants[1] }], isComponentOf: [] }],
    };
    const v = run(webOnlyForPublic("product"), [], { response: mix }).body.response.variants[0];
    expect(v.hasComponents).toBeUndefined();
    expect(v.isComponentOf).toBeUndefined();
  });

  it("búsqueda de variantes: las ocultas no aparecen", () => {
    const page = run(webOnlyForPublic("variant"), [], { response: { content: product.variants, pagination: {} } }).body.response;
    expect(page.content.map((v: any) => v.id)).toEqual([10]);
  });

  it("el staff ve todo", () => {
    const { body } = run(webOnlyForPublic("product"), ["EMPLOYEE"], { response: product });
    expect(body.response.variants).toHaveLength(3);
  });
});

describe("hideProductsForPublic", () => {
  const brand = { id: 3, name: "Marca", products: [{ id: 2, name: "Oculto" }] };
  it("marcas/categorías/etiquetas sin listado de productos para clientes", () => {
    expect(run(hideProductsForPublic, [], { response: brand }).body.response.products).toBeUndefined();
    expect(run(hideProductsForPublic, [], { response: [brand] }).body.response[0].products).toBeUndefined();
    expect(run(hideProductsForPublic, [], { response: { content: [brand] } }).body.response.content[0].products).toBeUndefined();
  });
  it("el staff los ve", () => {
    expect(run(hideProductsForPublic, ["EDITOR"], { response: brand }).body.response.products).toHaveLength(1);
  });
});

describe("productor local", () => {
  it("la variante hereda del producto salvo que lo defina", () => {
    const p: any = productPostProcessingMapping({
      id: 1,
      isLocal: true,
      variants: [
        { id: 1, price: 1, profitMargin: 0, isLocal: null },
        { id: 2, price: 1, profitMargin: 0, isLocal: false },
      ],
    } as any);
    expect(p.variants.map((v: any) => v.local)).toEqual([true, false]);
    const q: any = productPostProcessingMapping({ id: 2, isLocal: false, variants: [{ id: 3, price: 1, isLocal: true }] } as any);
    expect(q.variants[0].local).toBe(true);
  });

  it("isLocal de la variante acepta true / false / heredar", () => {
    expect(parseNullableBoolean("true")).toBe(true);
    expect(parseNullableBoolean("false")).toBe(false);
    expect(parseNullableBoolean("")).toBeNull();
    expect(parseNullableBoolean("null")).toBeNull();
    expect(prismaCreateEntityBuilder({ isLocal: "" }, productVariantCreateMapping).isLocal).toBeNull();
    expect(prismaCreateEntityBuilder({ isLocal: "true" }, productVariantCreateMapping).isLocal).toBe(true);
    expect(prismaUpdateEntityBuilder({ isLocal: null }, productVariantUpdateMapping)).toEqual({ isLocal: null });
    expect(prismaUpdateEntityBuilder({ isLocal: "false" }, productVariantUpdateMapping)).toEqual({ isLocal: false });
  });
});
