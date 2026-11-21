/**
 * Cliente mínimo de Uber Direct (https://developer.uber.com/docs/deliveries).
 *
 *   UBER_DIRECT_CUSTOMER_ID, UBER_DIRECT_CLIENT_ID, UBER_DIRECT_CLIENT_SECRET
 *
 * Sin esas variables el proveedor queda deshabilitado y se usa la tarifa propia.
 */

import { getLogger } from "./logger.js";

const log = getLogger("uber");

const AUTH_URL = "https://auth.uber.com/oauth/v2/token";
const API_URL = "https://api.uber.com/v1";
const TIMEOUT_MS = 15_000;

export type UberAddress = {
  street: string;
  city: string;
  state: string;
  zipCode?: string | null;
  country?: string;
};

export type UberQuote = {
  id: string;
  /** Importe en la moneda de `currency` (Uber lo informa en centavos; acá ya está dividido). */
  fee: number;
  currency: string;
  expires: string;
  /** Minutos estimados hasta la entrega. */
  durationMinutes: number | null;
};

export type UberDelivery = {
  id: string;
  status: string;
  trackingUrl: string | null;
  fee: number | null;
  courierName: string | null;
};

const cfg = () => ({
  customerId: process.env.UBER_DIRECT_CUSTOMER_ID ?? "",
  clientId: process.env.UBER_DIRECT_CLIENT_ID ?? "",
  clientSecret: process.env.UBER_DIRECT_CLIENT_SECRET ?? "",
});

export const isUberConfigured = () => {
  const c = cfg();
  return !!(c.customerId && c.clientId && c.clientSecret);
};

let token: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const c = cfg();
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      grant_type: "client_credentials",
      scope: "eats.deliveries",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    log.error({ status: res.status, error: data.error }, "Uber: no se pudo obtener el token (revisar credenciales)");
    throw new Error(`Uber auth ${res.status}: ${data.error_description ?? data.error ?? "sin token"}`);
  }
  token = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function uberRequest<T = any>(path: string, body?: unknown, method = body ? "POST" : "GET"): Promise<T> {
  const start = Date.now();
  const res = await fetch(`${API_URL}/customers/${encodeURIComponent(cfg().customerId)}${path}`, {
    method,
    headers: { authorization: `Bearer ${await getToken()}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data: any = await res.json().catch(() => ({}));
  const ms = Date.now() - start;
  if (!res.ok) {
    log.warn({ method, path, status: res.status, ms, code: data.code, cause: data.message }, `Uber respondió ${res.status}`);
    throw new Error(`Uber ${res.status}: ${data.message ?? data.code ?? "error"}`);
  }
  log.debug({ method, path, status: res.status, ms }, `Uber ${method} ${path} ${res.status}`);
  return data as T;
}

/** Uber espera la dirección como JSON serializado dentro de un string. */
const formatAddress = (a: UberAddress) =>
  JSON.stringify({
    street_address: [a.street],
    city: a.city,
    state: a.state,
    zip_code: a.zipCode ?? "",
    country: a.country ?? "AR",
  });

/** Teléfono en formato E.164. Números argentinos sin prefijo: +549 + 10 dígitos. */
export function toE164(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.replace(/\D/g, "");
  let digits = trimmed.replace(/\D/g, "").replace(/^0/, "");
  if (digits.startsWith("549")) return "+" + digits;
  if (digits.startsWith("54")) return "+549" + digits.slice(2);
  return "+549" + digits;
}

const toDelivery = (d: any): UberDelivery => ({
  id: String(d.id),
  status: String(d.status ?? ""),
  trackingUrl: d.tracking_url ?? null,
  fee: typeof d.fee === "number" ? d.fee / 100 : null,
  courierName: d.courier?.name ?? null,
});

export async function uberQuote(input: {
  pickup: UberAddress;
  dropoff: UberAddress;
  pickupPhone: string;
  dropoffPhone: string;
  /** Valor declarado de lo que se envía, en pesos. */
  value?: number;
}): Promise<UberQuote> {
  const q: any = await uberRequest("/delivery_quotes", {
    pickup_address: formatAddress(input.pickup),
    dropoff_address: formatAddress(input.dropoff),
    pickup_phone_number: toE164(input.pickupPhone),
    dropoff_phone_number: toE164(input.dropoffPhone),
    ...(input.value ? { manifest_total_value: Math.round(input.value * 100) } : {}),
  });
  return {
    id: String(q.id),
    fee: Number(q.fee) / 100,
    currency: String(q.currency ?? q.currency_type ?? "").toUpperCase(),
    expires: String(q.expires ?? ""),
    durationMinutes: typeof q.duration === "number" ? q.duration : null,
  };
}

export async function uberCreateDelivery(input: {
  quoteId?: string;
  externalId: string;
  pickup: UberAddress;
  pickupName: string;
  pickupPhone: string;
  dropoff: UberAddress;
  dropoffName: string;
  dropoffPhone: string;
  dropoffNotes?: string | null;
  items: { name: string; quantity: number }[];
  value?: number;
}): Promise<UberDelivery> {
  const d = await uberRequest("/deliveries", {
    ...(input.quoteId ? { quote_id: input.quoteId } : {}),
    external_id: input.externalId,
    pickup_name: input.pickupName,
    pickup_address: formatAddress(input.pickup),
    pickup_phone_number: toE164(input.pickupPhone),
    dropoff_name: input.dropoffName,
    dropoff_address: formatAddress(input.dropoff),
    dropoff_phone_number: toE164(input.dropoffPhone),
    ...(input.dropoffNotes ? { dropoff_notes: input.dropoffNotes.slice(0, 280) } : {}),
    manifest_items: input.items.map((i) => ({ name: i.name.slice(0, 100), quantity: i.quantity, size: "small" })),
    ...(input.value ? { manifest_total_value: Math.round(input.value * 100) } : {}),
  });
  return toDelivery(d);
}

export async function uberGetDelivery(id: string): Promise<UberDelivery> {
  return toDelivery(await uberRequest(`/deliveries/${encodeURIComponent(id)}`));
}

export async function uberCancelDelivery(id: string): Promise<UberDelivery> {
  return toDelivery(await uberRequest(`/deliveries/${encodeURIComponent(id)}/cancel`, {}));
}
