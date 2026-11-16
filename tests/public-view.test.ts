import { describe, expect, it, vi } from "vitest";
import { hideCostForPublic, webOnlyForPublic } from "../src/middleware/publicView.js";

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

  it("el staff ve todo", () => {
    const { body } = run(webOnlyForPublic("product"), ["EMPLOYEE"], { response: product });
    expect(body.response.variants).toHaveLength(3);
  });
});
