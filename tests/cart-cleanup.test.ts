import { describe, expect, it, vi } from "vitest";
import { CartRepository } from "../src/repository/cart.repository.js";

describe("limpieza de carritos de invitado", () => {
  it("solo busca carritos de invitado y borra ítems antes que carritos", async () => {
    const calls: string[] = [];
    const tx = {
      cart: {
        findMany: vi.fn(async (args: any) => {
          calls.push("find");
          expect(args.where.userSuperTokensId).toBeNull();
          const [old, empty] = args.where.OR;
          const days = (d: Date) => Math.round((Date.now() - d.getTime()) / 86_400_000);
          expect(days(old.updatedAt.lt)).toBe(30);
          expect(days(empty.updatedAt.lt)).toBe(7);
          expect(empty.items).toEqual({ none: {} });
          return [{ id: 1 }, { id: 2 }];
        }),
        deleteMany: vi.fn(async (args: any) => {
          calls.push("carts");
          expect(args.where.userSuperTokensId).toBeNull();
          return { count: 2 };
        }),
      },
      cartItem: { deleteMany: vi.fn(async () => (calls.push("items"), { count: 3 })) },
    };
    const repo = new CartRepository();
    (repo as any).withTransaction = (fn: any) => fn(tx);
    expect(await repo.deleteStaleGuestCarts({ guestDays: 30, emptyDays: 7 })).toBe(2);
    expect(calls).toEqual(["find", "items", "carts"]);
  });

  it("sin candidatos no borra nada", async () => {
    const tx = { cart: { findMany: async () => [], deleteMany: vi.fn() }, cartItem: { deleteMany: vi.fn() } };
    const repo = new CartRepository();
    (repo as any).withTransaction = (fn: any) => fn(tx);
    expect(await repo.deleteStaleGuestCarts({ guestDays: 30, emptyDays: 7 })).toBe(0);
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
  });
});
