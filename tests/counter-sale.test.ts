import { beforeEach, describe, expect, it, vi } from "vitest";

// Nada sale a la red ni a la base: repositorios y mails simulados.
const notify = vi.fn();
vi.mock("../src/services/order-mail.service.js", () => ({ orderMails: { notify: (...a: any[]) => notify(...a) } }));

const { OrderService } = await import("../src/services/order.service.js");

const variant = (over: any = {}) => ({
  id: 1,
  name: "500 g",
  active: true,
  availableWeb: false, // en mostrador se vende aunque no esté publicada
  currentStock: 2000,
  packagingOptions: [500],
  contentMeasure: "KG",
  finalPrice: 1000, // por kg
  product: { name: "Poroto", active: true, offers: [] },
  offers: [],
  ...over,
});

describe("venta de mostrador", () => {
  let created: any;
  let movements: any[];
  let service: any;
  let v: any;

  beforeEach(() => {
    notify.mockReset();
    created = null;
    movements = [];
    v = variant();
    const orderRepo = {
      withTransaction: (cb: any) => cb({}),
      createOrder: vi.fn(async (data: any) => (created = { id: 9, ...data })),
    };
    const variantRepo = { findForSale: vi.fn(async () => v) };
    const stockRepo = {
      lockVariants: vi.fn(),
      createStockMovement: vi.fn(async (...a: any[]) => movements.push(a)),
    };
    const pricing = {
      quote: ({ quantity, selectedBulkOption }: any) => ({
        unitPriceSnapshot: 1000,
        discountAppliedSnapshot: 0,
        offerTypeSnapshot: "",
        totalPriceSnapshot: (quantity * (selectedBulkOption ?? 1) * 1000) / 1000,
      }),
    };
    service = new OrderService(orderRepo as any, variantRepo as any, stockRepo as any, pricing as any, {} as any, {} as any, {} as any);
  });

  it("queda entregada, cobrada, en canal COUNTER y descuenta stock (sin mails)", async () => {
    const order = await service.createCounterSale(
      { paymentType: "cash", orderItems: [{ productVariantId: 1, quantity: 2, selectedBulkOption: 500 }] } as any,
      "staff-1",
    );
    expect(order).toMatchObject({
      status: "DELIVERED",
      channel: "COUNTER",
      paymentStatus: "APPROVED",
      paymentType: "CASH",
      shippingMethod: "PICKUP",
      totalPrice: 1000,
    });
    expect(order.paidAt).toBeInstanceOf(Date);
    expect(movements).toEqual([[1, -1000, "OUT", {}]]);
    expect(notify).not.toHaveBeenCalled();
  });

  it("si no alcanza el stock no registra nada (no ajusta líneas)", async () => {
    v.currentStock = 700;
    await expect(
      service.createCounterSale({ paymentType: "CASH", orderItems: [{ productVariantId: 1, quantity: 2, selectedBulkOption: 500 }] } as any, "staff-1"),
    ).rejects.toThrow(/No alcanza el stock de Poroto 500 g/);
    expect(created).toBeNull();
  });

  it("no acepta débito ni crédito", async () => {
    await expect(
      service.createCounterSale({ paymentType: "DEBIT", orderItems: [{ productVariantId: 1, quantity: 1 }] } as any, "staff-1"),
    ).rejects.toThrow(/Mercado Pago/);
  });
});
