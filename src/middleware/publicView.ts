import { getActor } from "./auth.middleware.js";

const HIDDEN_FIELDS = new Set(["price", "profitMargin", "priceAtTime"]);

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
 * Oculta costo y margen en las respuestas a clientes/invitados.
 * El precio de venta sigue disponible como `finalPrice`.
 * Requiere `optionalSession` + `attachRoles` antes.
 */
export const hideCostForPublic = (req: any, res: any, next: any) => {
  if (getActor(req).isStaff) return next();
  const json = res.json.bind(res);
  res.json = (body: any) => json(strip(body));
  next();
};
