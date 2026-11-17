import crypto from "node:crypto";
import { getLogger } from "./logger.js";

const log = getLogger("mercadopago");

/**
 * Configuración de Mercado Pago (Checkout Pro).
 *
 * Env:
 *   MP_ACCESS_TOKEN        obligatoria. Access token de la aplicación (credenciales de prueba
 *                          o de producción, según el ambiente).
 *   MP_WEBHOOK_SECRET      obligatoria en producción. "Clave secreta" de Webhooks; valida la firma
 *                          x-signature. Sin ella, en producción los webhooks se rechazan.
 *   MP_WEBHOOK_TOLERANCE_MINUTES antigüedad máxima de la firma de un webhook. Default 60; 0 = sin límite.
 *   WEB_URL               URL pública de la tienda (back_urls), p. ej. https://canelaenrama.com.ar
 *   API_PUBLIC_URL         URL pública del backend (sin /api) para notification_url. Debe ser https.
 *   MP_STATEMENT_DESCRIPTOR texto en el resumen de la tarjeta (máx. 22). Default "CANELA EN RAMA".
 *   MP_ORDER_TTL_HOURS     horas para pagar antes de cancelar el pedido y liberar stock. Default 48.
 *   MP_ALLOW_CASH          "true" para permitir Rapipago/Pago Fácil (pagos en efectivo diferidos).
 */
export const mpConfig = () => {
  const ttl = Number(process.env.MP_ORDER_TTL_HOURS);
  const tolerance = Number(process.env.MP_WEBHOOK_TOLERANCE_MINUTES);
  return {
    accessToken: process.env.MP_ACCESS_TOKEN ?? "",
    webhookSecret: process.env.MP_WEBHOOK_SECRET ?? "",
    webhookToleranceMinutes: process.env.MP_WEBHOOK_TOLERANCE_MINUTES && Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : 60,
    /** Sin secreto los webhooks solo se aceptan fuera de producción (desarrollo local). */
    requireWebhookSignature: process.env.NODE_ENV === "production",
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
  const method = init.method ?? "GET";
  const start = Date.now();
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err: any) {
    // Timeout o error de red: no hubo respuesta de Mercado Pago
    log.error({ method, path, ms: Date.now() - start, err: { message: err?.message, name: err?.name } }, "Mercado Pago no respondió");
    throw new Error(`Mercado Pago sin respuesta: ${err?.message ?? err}`);
  }
  const data: any = await res.json().catch(() => ({}));
  const ms = Date.now() - start;
  const mpRequestId = res.headers.get("x-request-id") ?? undefined;
  if (!res.ok) {
    const cause = data?.cause?.[0]?.description ?? data?.message ?? data?.error;
    log.warn({ method, path, status: res.status, ms, mpRequestId, cause, mpError: data?.error }, `Mercado Pago respondió ${res.status}`);
    throw new Error(`Mercado Pago HTTP ${res.status}${cause ? `: ${cause}` : ""}`);
  }
  log.debug({ method, path, status: res.status, ms, mpRequestId }, `Mercado Pago ${method} ${path.split("?")[0]} ${res.status}`);
  return data as T;
}

export type WebhookSignatureCheck =
  | { ok: true; reason: "valid" | "not_configured"; ageSeconds?: number }
  | {
      ok: false;
      reason: "missing_secret" | "missing_header" | "malformed" | "invalid" | "expired";
      ageSeconds?: number;
    };

/**
 * Valida la firma de un webhook (header `x-signature: ts=...,v1=...`).
 * Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` firmado con HMAC-SHA256.
 *
 * - Sin MP_WEBHOOK_SECRET: en producción se rechaza (`missing_secret`); en desarrollo se acepta
 *   (`not_configured`), igual el pago se re-consulta a la API antes de usarlo.
 * - Firma más vieja que MP_WEBHOOK_TOLERANCE_MINUTES → `expired` (evita reenvíos de
 *   notificaciones capturadas). Mercado Pago documenta `ts` en milisegundos pero sus
 *   ejemplos vienen en segundos: se aceptan los dos.
 */
export function verifyWebhookSignature(
  signatureHeader: string | undefined,
  requestId: string | undefined,
  dataId: string | undefined,
  now: number = Date.now(),
): WebhookSignatureCheck {
  const { webhookSecret, webhookToleranceMinutes, requireWebhookSignature } = mpConfig();
  if (!webhookSecret) {
    return requireWebhookSignature ? { ok: false, reason: "missing_secret" } : { ok: true, reason: "not_configured" };
  }
  if (!signatureHeader) return { ok: false, reason: "missing_header" };

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1 || !/^\d+$/.test(ts)) return { ok: false, reason: "malformed" };

  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const expected = crypto.createHmac("sha256", webhookSecret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (!(a.length === b.length && crypto.timingSafeEqual(a, b))) return { ok: false, reason: "invalid" };

  const tsNumber = Number(ts);
  const tsMs = tsNumber > 1e12 ? tsNumber : tsNumber * 1000;
  const ageSeconds = Math.round((now - tsMs) / 1000);
  // 5 min de margen hacia el futuro por diferencias de reloj
  const tooOld = webhookToleranceMinutes > 0 && ageSeconds > webhookToleranceMinutes * 60;
  if (tooOld || ageSeconds < -300) return { ok: false, reason: "expired", ageSeconds };
  return { ok: true, reason: "valid", ageSeconds };
}
