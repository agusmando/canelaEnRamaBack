import { describe, expect, it, vi } from "vitest";
import { CartRepository } from "../src/repository/cart.repository.js";

describe("limpieza de carritos de invitado", () => {
  it("borra carritos de invitado abandonados y respeta los plazos configurados", async () => {
    const calls: string[] = [];
    const tx = {
      cart: {
        findMany: vi.fn(async (args: any) => {
          const days = (d: Date) => Math.round((Date.now() - d.getTime()) / 86_400_000);
          if (args.where.userSuperTokensId === null) {
            calls.push("find-guests");
            expect(days(args.where.updatedAt.lt)).toBe(30);
            return [{ id: 1 }];
          }
          calls.push("find-empty");
          expect(days(args.where.updatedAt.lt)).toBe(7);
          expect(args.where.items).toEqual({ none: {} });
          return [{ id: 2 }];
        }),
        deleteMany: vi.fn(async (args: any) => {
          if (args.where.userSuperTokensId === null) {
            calls.push("guest-carts");
            return { count: 1 };
          }
          calls.push("empty-carts");
          expect(args.where.items).toEqual({ none: {} });
          return { count: 1 };
        }),
      },
      cartItem: {
        deleteMany: vi.fn(async (args: any) => {
          calls.push("items");
          expect(args.where.cartId.in).toEqual([1]);
          return { count: 3 };
        }),
      },
    };
    const repo = new CartRepository();
    (repo as any).withTransaction = (fn: any) => fn(tx);
    expect(await repo.deleteStaleCarts({ guestDays: 30, emptyDays: 7 })).toBe(2);
    expect(calls).toEqual(["find-guests", "find-empty", "items", "guest-carts", "empty-carts"]);
  });

  it("can borra un carrito de usuario registrado si está vacío y ya venció el plazo", async () => {
    const tx = {
      cart: {
        findMany: vi.fn(async (args: any) =>
          args.where.userSuperTokensId === null ? [] : [{ id: 10 }],
        ),
        deleteMany: vi.fn(async ({ where }: any) => {
          expect(where.id.in).toEqual([10]);
          expect(where.items).toEqual({ none: {} });
          return { count: 1 };
        }),
      },
      cartItem: { deleteMany: vi.fn() },
    };
    const repo = new CartRepository();
    (repo as any).withTransaction = (fn: any) => fn(tx);

    expect(await repo.deleteStaleCarts({ guestDays: 30, emptyDays: 7 })).toBe(1);
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it("sin candidatos no borra nada", async () => {
    const tx = {
      cart: { findMany: async () => [], deleteMany: vi.fn() },
      cartItem: { deleteMany: vi.fn() },
    };
    const repo = new CartRepository();
    (repo as any).withTransaction = (fn: any) => fn(tx);
    expect(await repo.deleteStaleCarts({ guestDays: 30, emptyDays: 7 })).toBe(0);
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
  });
});
