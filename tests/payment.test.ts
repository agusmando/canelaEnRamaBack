import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// La API de Mercado Pago y los mails se simulan: nada sale a la red.
const mpRequest = vi.fn();
vi.mock("../src/config/mercadopago.js", async (importOriginal) => {
  const real: any = await importOriginal();
  return { ...real, mpRequest: (...args: any[]) => mpRequest(...args) };
});
const notify = vi.fn();
vi.mock("../src/services/order-mail.service.js", () => ({ orderMails: { notify: (...a: any[]) => notify(...a) } }));

const { verifyWebhookSignature } = await import("../src/config/mercadopago.js");
const { PaymentService } = await import("../src/services/payment.service.js");

const SECRET = "secreto-de-prueba";
const sign = (dataId: string, requestId: string, ts: string | number, secret = SECRET) => {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return `ts=${ts},v1=${crypto.createHmac("sha256", secret).update(manifest).digest("hex")}`;
};

describe("firma de webhooks", () => {
  const now = Date.UTC(2026, 10, 17, 12, 0, 0);
  const tsSec = Math.floor(now / 1000);

  beforeEach(() => {
    vi.stubEnv("MP_WEBHOOK_SECRET", SECRET);
    vi.stubEnv("MP_WEBHOOK_TOLERANCE_MINUTES", "");
    vi.stubEnv("NODE_ENV", "production");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("acepta una firma válida (ts en segundos o en milisegundos)", () => {
    expect(verifyWebhookSignature(sign("123", "req-1", tsSec), "req-1", "123", now)).toMatchObject({ ok: true, reason: "valid" });
    expect(verifyWebhookSignature(sign("123", "req-1", now), "req-1", "123", now)).toMatchObject({ ok: true, reason: "valid" });
  });

  it("el id alfanumérico se firma en minúsculas", () => {
    expect(verifyWebhookSignature(sign("abc123", "r", tsSec), "r", "ABC123", now).ok).toBe(true);
  });

  it("rechaza firma de otro secreto, sin header o mal formada", () => {
    expect(verifyWebhookSignature(sign("123", "r", tsSec, "otro"), "r", "123", now).reason).toBe("invalid");
    expect(verifyWebhookSignature(sign("123", "r", tsSec), "r", "999", now).reason).toBe("invalid");
    expect(verifyWebhookSignature(undefined, "r", "123", now).reason).toBe("missing_header");
    expect(verifyWebhookSignature("v1=abc", "r", "123", now).reason).toBe("malformed");
  });

  it("rechaza firmas viejas según MP_WEBHOOK_TOLERANCE_MINUTES (default 60)", () => {
    const old = tsSec - 61 * 60;
    expect(verifyWebhookSignature(sign("1", "r", old), "r", "1", now)).toMatchObject({ ok: false, reason: "expired" });
    expect(verifyWebhookSignature(sign("1", "r", tsSec - 59 * 60), "r", "1", now).ok).toBe(true);
    // del futuro (más de 5 min): también se rechaza
    expect(verifyWebhookSignature(sign("1", "r", tsSec + 600), "r", "1", now).reason).toBe("expired");
    vi.stubEnv("MP_WEBHOOK_TOLERANCE_MINUTES", "0");
    expect(verifyWebhookSignature(sign("1", "r", old), "r", "1", now).ok).toBe(true);
  });

  it("sin secreto: se rechaza en producción y se acepta en desarrollo", () => {
    vi.stubEnv("MP_WEBHOOK_SECRET", "");
    expect(verifyWebhookSignature(undefined, "r", "1", now)).toMatchObject({ ok: false, reason: "missing_secret" });
    vi.stubEnv("NODE_ENV", "development");
    expect(verifyWebhookSignature(undefined, "r", "1", now)).toMatchObject({ ok: true, reason: "not_configured" });
  });
});

describe("PaymentService: aplicar pagos del webhook", () => {
  let order: any;
  let service: any;

  beforeEach(() => {
    vi.stubEnv("MP_ACCESS_TOKEN", "TEST-token");
    mpRequest.mockReset();
    notify.mockReset();
    order = { id: 7, status: "PENDING", paymentStatus: "PENDING", paymentId: null, totalPrice: 1000, shippingCost: 500 };
    const tx = {
      $executeRaw: vi.fn(),
      order: {
        findUnique: vi.fn(async () => (order ? { ...order } : null)),
        update: vi.fn(async ({ data }: any) => Object.assign(order, data)),
      },
    };
    const repo = { withTransaction: (cb: any) => cb(tx) };
    service = new PaymentService(repo as any, {} as any, {} as any);
  });
  afterEach(() => vi.unstubAllEnvs());

  const payment = (over: any = {}) => ({
    id: 555,
    external_reference: "7",
    status: "approved",
    status_detail: "accredited",
    transaction_amount: 1500,
    currency_id: "ARS",
    date_approved: "2026-11-17T12:00:00Z",
    ...over,
  });

  it("aprobado: orden en PROCESSING, pagada y con mail (una sola vez)", async () => {
    mpRequest.mockResolvedValue(payment());
    expect(await service.handleNotification("payment", "555")).toBe(true);
    expect(mpRequest).toHaveBeenCalledWith("/v1/payments/555");
    expect(order).toMatchObject({ paymentStatus: "APPROVED", status: "PROCESSING", paymentId: "555" });
    expect(order.paidAt).toBeInstanceOf(Date);
    expect(notify).toHaveBeenCalledWith("paid", 7);

    // El mismo webhook otra vez (Mercado Pago reintenta): idempotente
    await service.handleNotification("payment", "555");
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("rechazado: queda REJECTED y la orden sigue pendiente (se puede reintentar)", async () => {
    mpRequest.mockResolvedValue(payment({ status: "rejected", status_detail: "cc_rejected_insufficient_amount" }));
    await service.handleNotification("payment", "555");
    expect(order).toMatchObject({ paymentStatus: "REJECTED", status: "PENDING", paymentStatusDetail: "cc_rejected_insufficient_amount" });
    expect(notify).not.toHaveBeenCalled();
  });

  it("monto distinto al total: queda en revisión, no se marca pagada", async () => {
    mpRequest.mockResolvedValue(payment({ transaction_amount: 10 }));
    await service.handleNotification("payment", "555");
    expect(order).toMatchObject({ paymentStatus: "IN_PROCESS", paymentStatusDetail: "amount_mismatch", status: "PENDING" });
    expect(notify).not.toHaveBeenCalled();
  });

  it("pago duplicado: no pisa el pago aprobado anterior", async () => {
    Object.assign(order, { paymentStatus: "APPROVED", paymentId: "111", status: "PROCESSING" });
    mpRequest.mockResolvedValue(payment({ id: 222 }));
    await service.handleNotification("payment", "222");
    expect(order).toMatchObject({ paymentStatus: "APPROVED", paymentId: "111" });
  });

  it("pagado después de cancelado: se marca para reintegrar y no se reabre", async () => {
    order.status = "CANCELLED";
    mpRequest.mockResolvedValue(payment());
    await service.handleNotification("payment", "555");
    expect(order).toMatchObject({ status: "CANCELLED", paymentStatus: "APPROVED", paymentStatusDetail: "paid_after_cancel" });
    expect(notify).not.toHaveBeenCalled();
  });

  it("ignora notificaciones que no son de pagos o sin orden", async () => {
    expect(await service.handleNotification("merchant_order", "1")).toBe(false);
    mpRequest.mockResolvedValue(payment({ external_reference: null }));
    await service.handleNotification("payment", "555");
    expect(order.paymentStatus).toBe("PENDING");
  });
});
