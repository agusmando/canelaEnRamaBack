import { beforeEach, describe, expect, it, vi } from "vitest";

// Mercado Pago simulado: un pago aprobado de $10.000 con lo reintegrado hasta ahora
const mp = vi.hoisted(() => ({ refunded: 0, status: "approved", calls: [] as any[] }));
vi.mock("../src/config/mercadopago.js", () => ({
  isMercadoPagoConfigured: () => true,
  mpConfig: () => ({}),
  mpRequest: vi.fn(async (path: string, init: any = {}) => {
    if (path.endsWith("/refunds")) {
      mp.calls.push({ path, ...init });
      const amount = init.body?.amount ?? 10000 - mp.refunded;
      mp.refunded += amount;
      if (mp.refunded >= 10000) mp.status = "refunded";
      return { id: 900 + mp.calls.length, amount, status: "approved" };
    }
    return {
      id: 555,
      status: mp.status,
      transaction_amount: 10000,
      transaction_amount_refunded: mp.refunded,
      currency_id: "ARS",
      external_reference: "7",
    };
  }),
}));
vi.mock("../src/services/order-mail.service.js", () => ({ orderMails: { notify: vi.fn() } }));

const { PaymentService } = await import("../src/services/payment.service.js");

const admin = { userId: "admin-1", roles: ["ADMIN"], permissions: [], isStaff: true } as any;

function setup(order: Partial<Record<string, any>> = {}) {
  const base = { id: 7, paymentType: "MERCADOPAGO", paymentId: "555", status: "DELIVERED", totalPrice: 8000, shippingCost: 0, refunds: [], ...order };
  const saved: any[] = [];
  const orderRepository: any = {
    saveRefund: vi.fn(async (r: any) => saved.push(r)),
    // applyPayment usa una transacción: la simulamos sin base
    withTransaction: vi.fn(async (fn: any) =>
      fn({ $executeRaw: vi.fn(), order: { findUnique: async () => ({ ...base, paymentStatus: "APPROVED" }), update: vi.fn() } }),
    ),
  };
  const orderService: any = { getOrder: vi.fn(async () => base) };
  return { service: new PaymentService(orderRepository, orderService), saved };
}

describe("reintegros de Mercado Pago", () => {
  beforeEach(() => {
    mp.refunded = 0;
    mp.status = "approved";
    mp.calls = [];
  });

  it("sugiere devolver lo cobrado de más respecto del total actual", async () => {
    const { service } = setup(); // cobró 10.000, el pedido ahora vale 8.000
    const info = await service.refundInfo(7, admin);
    expect(info).toMatchObject({ paid: 10000, refunded: 0, refundable: 10000, currentTotal: 8000, suggested: 2000 });
  });

  it("con el pedido cancelado sugiere devolver todo", async () => {
    const { service } = setup({ status: "CANCELLED" });
    expect((await service.refundInfo(7, admin)).suggested).toBe(10000);
  });

  it("parcial: manda el monto, registra el reintegro y usa clave de idempotencia", async () => {
    const { service, saved } = setup();
    await service.refund(7, { amount: 2000, reason: "Devolvió 1 frasco" }, admin);
    expect(mp.calls[0].body).toEqual({ amount: 2000 });
    expect(mp.calls[0].idempotencyKey).toBe("refund-7-555-0-200000");
    expect(saved[0]).toMatchObject({ orderId: 7, amount: 2000, reason: "Devolvió 1 frasco", createdBy: "admin-1" });
  });

  it("total: sin monto devuelve todo lo que queda", async () => {
    const { service } = setup();
    await service.refund(7, {}, admin);
    expect(mp.calls[0].body).toEqual({});
  });

  it("no deja devolver más de lo que queda", async () => {
    const { service } = setup();
    mp.refunded = 9000;
    await expect(service.refund(7, { amount: 1500 }, admin)).rejects.toThrow(/como máximo \$1000/);
    expect(mp.calls).toHaveLength(0);
  });

  it("rechaza pedidos que no se cobraron con Mercado Pago", async () => {
    const { service } = setup({ paymentType: "CASH" });
    await expect(service.refund(7, {}, admin)).rejects.toThrow(/no se cobró con Mercado Pago/);
  });

  it("si ya se devolvió todo, avisa", async () => {
    const { service } = setup();
    mp.refunded = 10000;
    mp.status = "refunded";
    await expect(service.refund(7, {}, admin)).rejects.toThrow(/ya se devolvió completo/);
  });
});
