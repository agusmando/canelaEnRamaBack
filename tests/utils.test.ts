import { describe, expect, it, vi } from "vitest";
import { toE164 } from "../src/config/uber.js";
import { addressLine, streetLine } from "../src/services/shipping-quote.service.js";
import { rateLimit } from "../src/middleware/security.js";
import { StockMovementService } from "../src/services/stockMovement.service.js";

describe("toE164 (teléfonos argentinos)", () => {
  it.each([
    ["261 555-1234", "+5492615551234"],
    ["0261 5551234", "+5492615551234"],
    ["54 261 5551234", "+5492615551234"],
    ["5492615551234", "+5492615551234"],
    ["+1 (555) 000-1111", "+15550001111"],
  ])("%s → %s", (input, out) => expect(toE164(input)).toBe(out));
});

describe("direcciones", () => {
  const a = { street: "San Martín", number: "1234", apartment: "2° B", city: "Bombal", zone: "Godoy Cruz" };
  it("streetLine", () => expect(streetLine(a)).toBe("San Martín 1234, 2° B"));
  it("addressLine no repite localidad = departamento", () => {
    expect(addressLine(a)).toBe("San Martín 1234, 2° B, Bombal, Godoy Cruz");
    expect(addressLine({ ...a, apartment: null, city: "Godoy Cruz" })).toBe("San Martín 1234, Godoy Cruz");
  });
});

describe("rateLimit", () => {
  it("responde 429 al pasar el máximo", () => {
    const mw = rateLimit({ name: "test", windowMs: 60_000, max: 2 });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res: any = { setHeader: vi.fn(), status: vi.fn((c: number) => (statuses.push(c), res)), json: vi.fn() };
      mw({ ip: "1.1.1.1", method: "POST" }, res, () => statuses.push(200));
    }
    expect(statuses).toEqual([200, 200, 429]);
  });
});

describe("carga masiva de movimientos (validación)", () => {
  const svc = new StockMovementService();
  it("rechaza vacío y más de 200", async () => {
    await expect(svc.createBulk([])).rejects.toThrow(/No hay movimientos/);
    const many = Array.from({ length: 201 }, () => ({ productVariantId: 1, quantity: 1, type: "IN" }) as any);
    await expect(svc.createBulk(many)).rejects.toThrow(/Máximo 200/);
  });
  it("indica la fila con error y valida el signo", async () => {
    await expect(
      svc.createBulk([
        { productVariantId: 1, quantity: 5, type: "IN" },
        { productVariantId: 1, quantity: 5, type: "OUT" },
      ] as any),
    ).rejects.toThrow(/Fila 2: .*OUT/);
    await expect(svc.createBulk([{ productVariantId: 0, quantity: 1, type: "IN" }] as any)).rejects.toThrow(/Fila 1/);
    await expect(svc.createBulk([{ productVariantId: 1, quantity: 1.5, type: "IN" }] as any)).rejects.toThrow(/entero/);
  });
});
