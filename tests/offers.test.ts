import { describe, expect, it } from "vitest";
import { OfferService } from "../src/services/offer.service.js";
import { PricingService, offerLabel } from "../src/services/pricing.service.js";

const offers = new OfferService();
const pricing = new PricingService(offers);

const offer = (o: Record<string, unknown>) => ({ id: 1, active: true, stockThreshold: 0, ...o }) as any;

describe("OfferService.applyOffer", () => {
  it("porcentaje", () => {
    expect(offers.applyOffer(1000, 1, offer({ discountType: "PERCENTAGE", discountValue: 20 })).unitAfter).toBe(800);
  });
  it("porcentaje fuera de rango falla", () => {
    expect(() => offers.applyOffer(1000, 1, offer({ discountType: "PERCENTAGE", discountValue: 120 }))).toThrow();
  });
  it("descuento fijo nunca deja precio negativo", () => {
    expect(offers.applyOffer(100, 1, offer({ discountType: "FIXED", discountValue: 150 })).unitAfter).toBe(0);
  });
  it("3x2: se pagan 2 de cada 3 y el resto a precio lleno", () => {
    const o = offer({ discountType: "BUY_MORE_GET_MORE", discountQuantity: 3, quantityToGet: 2 });
    expect(offers.applyOffer(100, 2, o).unitAfter).toBe(100);
    expect(offers.applyOffer(100, 3, o).unitAfter * 3).toBeCloseTo(200);
    expect(offers.applyOffer(100, 4, o).unitAfter * 4).toBeCloseTo(300);
  });
  it("descuento desde X unidades", () => {
    const o = offer({ discountType: "BUY_MORE_GET_DISCOUNT", discountQuantity: 3, discountValue: 10 });
    expect(offers.applyOffer(100, 2, o).unitAfter).toBe(100);
    expect(offers.applyOffer(100, 3, o).unitAfter).toBe(90);
  });
  it("tipo desconocido falla", () => {
    expect(() => offers.applyOffer(100, 1, offer({ discountType: "NOPE" }))).toThrow();
  });
});

describe("offerLabel", () => {
  it("etiquetas cortas", () => {
    expect(offerLabel(offer({ discountType: "PERCENTAGE", discountValue: 15 }))).toBe("15% off");
    expect(offerLabel(offer({ discountType: "BUY_ONE_GET_MORE", discountQuantity: 2, quantityToGet: 1 }))).toBe("2x1");
    expect(offerLabel(offer({ discountType: "BUY_MORE_GET_DISCOUNT", discountQuantity: 3, discountValue: 20 }))).toBe(
      "20% off desde 3",
    );
  });
});

describe("PricingService.selectOffer", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  it("prioriza la oferta de la variante sobre la del producto", () => {
    const v = offer({ id: 1, discountType: "PERCENTAGE", discountValue: 10 });
    const p = offer({ id: 9, discountType: "PERCENTAGE", discountValue: 50 });
    expect(pricing.selectOffer([v], [p], 100, 0, now)?.id).toBe(1);
  });
  it("entre vigentes elige la más reciente", () => {
    const a = offer({ id: 1, discountType: "PERCENTAGE", discountValue: 10 });
    const b = offer({ id: 2, discountType: "PERCENTAGE", discountValue: 20 });
    expect(pricing.selectOffer([a, b], [], 100, 0, now)?.id).toBe(2);
  });
  it("ignora inactivas, futuras y vencidas", () => {
    const list = [
      offer({ id: 1, active: false }),
      offer({ id: 2, startTime: "2026-07-01" }),
      offer({ id: 3, finishTime: "2026-05-01" }),
    ];
    expect(pricing.selectOffer(list, [], 100, 0, now)).toBeUndefined();
  });
  it("deja de aplicar con stock por debajo del umbral", () => {
    const o = offer({ id: 1, stockThreshold: 100 });
    expect(pricing.selectOffer([o], [], 99, 0, now)).toBeUndefined();
    expect(pricing.selectOffer([o], [], 100, 0, now)?.id).toBe(1);
    // el umbral de la variante también cuenta
    expect(pricing.selectOffer([offer({ id: 2 })], [], 5, 7, now)).toBeUndefined();
  });
});

describe("PricingService.quote", () => {
  const variant = (extra: Record<string, unknown> = {}) => ({
    price: 1000,
    profitMargin: 0,
    roundingOption: 10,
    contentMeasure: "KG",
    currentStock: 100000,
    stockThreshold: 0,
    offers: [],
    product: { offers: [] },
    ...extra,
  });

  it("producto por peso: precio por kilo, cantidad en gramos", () => {
    const q = pricing.quote({ productVariant: variant(), quantity: 250 });
    expect(q.priceUnits).toBe(0.25);
    expect(q.totalPriceSnapshot).toBe(250);
    expect(q.discountAppliedSnapshot).toBe(0);
  });

  it("con presentación, la cantidad son paquetes", () => {
    const q = pricing.quote({ productVariant: variant(), quantity: 2, selectedBulkOption: 500 });
    expect(q.totalPriceSnapshot).toBe(1000);
  });

  it("3x2 cuenta paquetes, no kilos", () => {
    const o = offer({ discountType: "BUY_MORE_GET_MORE", discountQuantity: 3, quantityToGet: 2 });
    const q = pricing.quote({ productVariant: variant({ offers: [o] }), quantity: 3, selectedBulkOption: 250 });
    // 3 × 250 g = 750 g = $750 de lista; se pagan 2 paquetes = $500
    expect(q.totalPriceSnapshot).toBe(500);
    expect(q.discountAppliedSnapshot).toBe(250);
    expect(q.offerHint).toBeNull();
  });

  it("avisa cuánto falta para una oferta por cantidad", () => {
    const o = offer({ discountType: "BUY_MORE_GET_MORE", discountQuantity: 3, quantityToGet: 2 });
    const q = pricing.quote({ productVariant: variant({ offers: [o] }), quantity: 2, selectedBulkOption: 250 });
    expect(q.offerHint).toEqual({ label: "3x2", missing: 1, unit: "pack" });
  });

  it("la oferta del producto aplica si la variante no tiene", () => {
    const o = offer({ discountType: "PERCENTAGE", discountValue: 10 });
    const q = pricing.quote({ productVariant: variant({ contentMeasure: "U", product: { offers: [o] } }), quantity: 2 });
    expect(q.totalPriceSnapshot).toBe(1800);
  });
});

describe("PricingService.lineDiscountForQuantity", () => {
  // Caso reportado: 3 unidades con 3x2 ($5100 c/u) → descuento $5100.
  // Al devolver una queda cantidad 2: ya no alcanza el 3x2 y el descuento es 0
  // (el prorrateo lineal daba $3400, que era el bug).
  const threeXTwo = {
    discountType: "BUY_MORE_GET_MORE",
    discountValue: null,
    discountQuantity: 3,
    quantityToGet: 2,
  };
  const line = {
    unitPriceSnapshot: 5100,
    quantity: 3,
    selectedBulkOption: null,
    productVariant: { contentMeasure: "U" },
  };

  it("3x2: al bajar a 2 unidades el descuento desaparece", () => {
    const d = pricing.lineDiscountForQuantity({ ...line, discountAppliedSnapshot: 5100, offerParams: threeXTwo }, 2);
    expect(d).toBe(0);
  });

  it("3x2: al bajar a 3→2 con otra oferta, respeta los tramos", () => {
    // "Lleva 3 paga 2" con cantidad 4 original (descuento $5100 por el paquete gratis)
    const d = pricing.lineDiscountForQuantity({ ...line, quantity: 4, discountAppliedSnapshot: 5100, offerParams: threeXTwo }, 3);
    // 3 unidades: se pagan 2 → descuento = 1 × 5100
    expect(d).toBe(5100);
  });

  it("porcentaje: recotiza igual que el prorrateo", () => {
    const pct = { discountType: "PERCENTAGE", discountValue: 20, discountQuantity: null, quantityToGet: null };
    const d = pricing.lineDiscountForQuantity({ ...line, discountAppliedSnapshot: 3060, offerParams: pct }, 2);
    expect(d).toBe(2040);
  });

  it("sin snapshot (orden vieja) prorratea linealmente", () => {
    const d = pricing.lineDiscountForQuantity({ ...line, discountAppliedSnapshot: 5100, offerParams: null }, 2);
    expect(d).toBe(3400);
  });
});

describe("PricingService.lineTotal", () => {
  it("líneas canceladas o devueltas no suman", () => {
    const base = { unitPriceSnapshot: 1000, quantity: 1, productVariant: { contentMeasure: "U" } };
    expect(pricing.lineTotal({ ...base, status: "CANCELLED" })).toBe(0);
    expect(pricing.lineTotal({ ...base, status: "RETURNED" })).toBe(0);
  });
});
