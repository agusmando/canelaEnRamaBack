import { describe, expect, it, vi } from "vitest";
import { StockMovementService } from "../src/services/stockMovement.service.js";

describe("registro manual de movimientos", () => {
  it("devuelve el movimiento persistido con su id", async () => {
    const tx = {};
    const repo = {
      withTransaction: (run: (tx: object) => Promise<unknown>) => run(tx),
      lockVariants: vi.fn(),
      createStockMovement: vi.fn(async () => 12),
      latestMovementForVariant: vi.fn(async () => ({
        id: 47,
        productVariantId: 8,
        quantity: 2,
        priceAtTime: 125,
        type: "IN",
        createdAt: new Date("2026-11-21T12:00:00.000Z"),
      })),
    };
    const service = new StockMovementService(repo as any);

    await expect(service.create({ productVariantId: 8, quantity: 2, type: "IN" })).resolves.toMatchObject({
      id: 47,
      productVariantId: 8,
      quantity: 2,
      priceAtTime: 125,
      type: "IN",
      currentStock: 12,
    });
    expect(repo.lockVariants).toHaveBeenCalledWith([8], tx);
    expect(repo.latestMovementForVariant).toHaveBeenCalledWith(8, tx);
  });
});
