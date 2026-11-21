import { getActor } from "./auth.middleware.js";
import { isWebVariant } from "../utils/webVisibility.js";

// Costos, márgenes y proveedores (con su contacto) son datos internos del negocio.
const HIDDEN_FIELDS = new Set(["price", "profitMargin", "priceAtTime", "suppliers", "supplier"]);

const strip = (value: any): any => {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (!HIDDEN_FIELDS.has(k)) out[k] = strip(v);
    }
    return out;
  }
  return value;
};

/**
 * Oculta costo, margen y proveedores en las respuestas a clientes/invitados.
 * El precio de venta sigue disponible como `finalPrice`.
 * Requiere `optionalSession` + `attachRoles` antes.
 */
export const hideCostForPublic = (req: any, res: any, next: any) => {
  if (getActor(req).isStaff) return next();
  const json = res.json.bind(res);
  res.json = (body: any) => json(strip(body));
  next();
};

// ---------------------------------------------------------------- Visibilidad en la web


/**
 * Las relaciones de mix ("es componente de" / "tiene componentes") nombran
 * otras variantes que pueden estar ocultas: la tienda no las usa, no se mandan.
 */
const webVariant = (v: any) => {
  if (!isWebVariant(v)) return null;
  if (v.product && typeof v.product === "object" && v.product.active === false) return null;
  const { hasComponents, isComponentOf, ...rest } = v;
  return rest;
};

/** Saca las variantes ocultas de un producto. null = el producto no tiene ninguna visible. */
const webProduct = (p: any) => {
  if (!p || typeof p !== "object" || !Array.isArray(p.variants)) return p;
  if (p.active === false) return null;
  const variants = p.variants.map(webVariant).filter(Boolean);
  return variants.length ? { ...p, variants } : null;
};

const notFound = (res: any, json: (b: any) => any, message: string) => {
  res.status(404);
  return json({ statusCode: 404, message, response: {} });
};

/**
 * Para clientes e invitados: las variantes "no disponibles en la web" (o
 * inactivas) no salen en las respuestas, y un producto sin variantes visibles
 * desaparece del listado y su detalle da 404. El staff ve todo.
 * Requiere `optionalSession` + `attachRoles` antes.
 */
export const webOnlyForPublic = (kind: "product" | "variant") => (req: any, res: any, next: any) => {
  if (getActor(req).isStaff) return next();
  const json = res.json.bind(res);
  res.json = (body: any) => {
    if (!body || res.statusCode >= 400 || body.response === undefined) return json(body);
    const data = body.response;
    const keep = kind === "product" ? webProduct : webVariant;
    const filterList = (list: any[]) => list.map(keep).filter(Boolean);

    if (Array.isArray(data)) return json({ ...body, response: filterList(data) });
    if (data && Array.isArray(data.content)) return json({ ...body, response: { ...data, content: filterList(data.content) } });
    if (data && typeof data === "object" && Object.keys(data).length) {
      const one = keep(data);
      if (!one) return notFound(res, json, kind === "product" ? "Producto no encontrado" : "Variante no encontrada");
      return json({ ...body, response: one });
    }
    return json(body);
  };
  next();
};

/**
 * Marcas, categorías y etiquetas: el listado de productos que traen con
 * `detalle` incluye productos sin variantes visibles. La tienda cuenta los
 * productos desde el catálogo, así que a clientes no se les manda.
 */
export const hideProductsForPublic = (req: any, res: any, next: any) => {
  if (getActor(req).isStaff) return next();
  const json = res.json.bind(res);
  const drop = (x: any) => {
    if (!x || typeof x !== "object" || Array.isArray(x)) return x;
    const { products, ...rest } = x;
    return rest;
  };
  res.json = (body: any) => {
    if (!body || body.response === undefined) return json(body);
    const data = body.response;
    if (Array.isArray(data)) return json({ ...body, response: data.map(drop) });
    if (data && Array.isArray(data.content)) return json({ ...body, response: { ...data, content: data.content.map(drop) } });
    return json({ ...body, response: drop(data) });
  };
  next();
};
