import { describe, expect, it } from "vitest";
import { computeFinalPrice, effectiveBulkOption, stockUnitsToPriceUnits } from "../src/utils/pricing.js";

describe("computeFinalPrice", () => {
  it("aplica el margen y redondea hacia arriba al múltiplo", () => {
    expect(computeFinalPrice({ price: 1000, profitMargin: 0.35, roundingOption: 10 })).toBe(1350);
    expect(computeFinalPrice({ price: 1001, profitMargin: 0.35, roundingOption: 10 })).toBe(1360);
    expect(computeFinalPrice({ price: 1001, profitMargin: 0.35, roundingOption: 100 })).toBe(1400);
  });

  it("no sube un escalón por errores de coma flotante", () => {
    // 1000 * 1.24 = 1240.0000000000002
    expect(computeFinalPrice({ price: 1000, profitMargin: 0.24, roundingOption: 10 })).toBe(1240);
  });

  it("margen 0 es válido (mixes)", () => {
    expect(computeFinalPrice({ price: 2500, profitMargin: 0, roundingOption: 10 })).toBe(2500);
  });

  it("sin redondeo usa el entero más cercano", () => {
    expect(computeFinalPrice({ price: 100.4, profitMargin: 0, roundingOption: 0 })).toBe(100);
  });

  it("precio inválido o no positivo da 0", () => {
    expect(computeFinalPrice({ price: 0 })).toBe(0);
    expect(computeFinalPrice({ price: -5 })).toBe(0);
    expect(computeFinalPrice({ price: null })).toBe(0);
  });
});

describe("stockUnitsToPriceUnits", () => {
  it("KG se cobra por kilo y el stock está en gramos", () => {
    expect(stockUnitsToPriceUnits(250, "KG")).toBe(0.25);
  });
  it("unidades quedan igual", () => {
    expect(stockUnitsToPriceUnits(3, "U")).toBe(3);
  });
});

describe("effectiveBulkOption", () => {
  it("sin presentaciones es venta suelta", () => {
    expect(effectiveBulkOption([], 250)).toBeNull();
    expect(effectiveBulkOption(null)).toBeNull();
  });
  it("sin elegir usa la presentación más chica", () => {
    expect(effectiveBulkOption([1000, 250, 500])).toBe(250);
  });
  it("respeta la elegida", () => {
    expect(effectiveBulkOption([250, 500], 500)).toBe(500);
  });
});
