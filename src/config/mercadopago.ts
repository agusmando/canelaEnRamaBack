import crypto from "node:crypto";

/**
 * Configuración de Mercado Pago (Checkout Pro).
 *
 * Env:
 *   MP_ACCESS_TOKEN        obligatoria. Access token de la aplicación (credenciales de prueba
 *                          o de producción, según el ambiente).
 *   MP_WEBHOOK_SECRET      recomendada. "Clave secreta" de Webhooks; valida la firma x-signature.
 *   WEB_URL                URL pública de la tienda (back_urls), p. ej. https://canelaenrama.com.ar
 *   API_PUBLIC_URL         URL pública del backend (sin /api) para notification_url. Debe ser https.
 *   MP_STATEMENT_DESCRIPTOR texto en el resumen de la tarjeta (máx. 22). Default "CANELA EN RAMA".
 *   MP_ORDER_TTL_HOURS     horas para pagar antes de cancelar el pedido y liberar stock. Default 48.
 *   MP_ALLOW_CASH          "true" para permitir Rapipago/Pago Fácil (pagos en efectivo diferidos).
 */
export const mpConfig = () => {
  const ttl = Number(process.env.MP_ORDER_TTL_HOURS);
  return {
    accessToken: process.env.MP_ACCESS_TOKEN ?? "",
    webhookSecret: process.env.MP_WEBHOOK_SECRET ?? "",
    webUrl: (process.env.WEB_URL ?? "").replace(/\/+$/, ""),
    apiPublicUrl: (process.env.API_PUBLIC_URL ?? "").replace(/\/+$/, ""),
    statementDescriptor: (process.env.MP_STATEMENT_DESCRIPTOR || "CANELA EN RAMA").slice(0, 22),
    orderTtlHours: Number.isFinite(ttl) && ttl > 0 ? ttl : 48,
    allowCash: process.env.MP_ALLOW_CASH === "true",
  };
};

export const isMercadoPagoConfigured = () => Boolean(mpConfig().accessToken);

const API = "https://api.mercadopago.com";

/** Llamada autenticada a la API REST de Mercado Pago. */
export async function mpRequest<T = any>(
  path: string,
  init: { method?: string; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const { accessToken } = mpConfig();
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const cause = data?.cause?.[0]?.description ?? data?.message ?? data?.error;
    throw new Error(`Mercado Pago HTTP ${res.status}${cause ? `: ${cause}` : ""}`);
  }
  return data as T;
}

/**
 * Valida la firma de un webhook (header `x-signature: ts=...,v1=...`).
 * Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` firmado con HMAC-SHA256.
 * Sin MP_WEBHOOK_SECRET no se valida (igual el pago se re-consulta a la API antes de usarlo).
 */
export function verifyWebhookSignature(
  signatureHeader: string | undefined,
  requestId: string | undefined,
  dataId: string | undefined,
): boolean {
  const { webhookSecret } = mpConfig();
  if (!webhookSecret) return true;
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const expected = crypto.createHmac("sha256", webhookSecret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
