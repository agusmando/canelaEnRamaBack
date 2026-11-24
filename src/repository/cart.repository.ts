import { webVariantWhere } from "../utils/webVisibility.js";
import { CartDto } from "../dto/cart/cart.dto.js";
import { CreateCartDto } from "../dto/cart/create-cart.dto.js";
import { UpdateCartDto } from "../dto/cart/update-cart.dto.js";
import { GenericRepositoryImpl } from "./generic.repository.js";
import { StoreProcedureError } from "../errors/infra/StoreProcedureError.js";
import { translatePrismaError } from "../errors/infra/translatePrismaError.js";

const CART_INCLUDE = {
  // Para identificar al dueño en el dashboard (un cliente solo ve su propio carrito)
  user: { select: { email: true, name: true } },
  items: {
    orderBy: [{ createdAt: "asc" as const }, { selectedBulkOption: "asc" as const }],
    include: {
      productVariant: {
        include: {
          product: { include: { offers: true } },
          offers: true,
          images: true,
        },
      },
    },
  },
};

export class CartRepository extends GenericRepositoryImpl<CartDto, CreateCartDto, UpdateCartDto> {
  constructor() {
    super("cart");
  }

  /** Listados con `detalle`: mismas relaciones que el carrito (ofertas incluidas) para poder cotizarlo. */
  includeQuery(): Record<string, any> {
    return CART_INCLUDE;
  }

  /** Busca por token de invitado (sessionId) o por id de usuario. */
  async getCart(token: string, tx?: any): Promise<any> {
    try {
      return await (tx ?? this.prisma).cart.findFirst({
        where: { OR: [{ sessionId: token }, { userSuperTokensId: token }] },
        include: CART_INCLUDE,
      });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  /** Crea el carrito vacío; los ítems se agregan con `addItem` (valida presentación). */
  async createCart(owner: { sessionId?: string; userSuperTokensId?: string }, tx?: any) {
    try {
      return await (tx ?? this.prisma).cart.create({ data: owner });
    } catch (error) {
      throw translatePrismaError(error);
    }
  }

  async addItem(
    token: string,
    productVariantId: number,
    quantity: number,
    selectedBulkOption = 0,
    tx?: any,
  ) {
    try {
      await (tx ?? this.prisma)
        .$executeRaw`SELECT public.add_item_to_cart(${token}::VARCHAR, ${Number(productVariantId)}::INT, ${Number(quantity)}::INT, ${Number(selectedBulkOption) || 0}::FLOAT8)`;
    } catch (error) {
      throw new StoreProcedureError("add_item_to_cart", error);
    }
  }

  /** Una línea del carrito = variante + presentación. */
  private lineWhere(cartId: number, productVariantId: number, selectedBulkOption = 0) {
    return {
      cartId,
      productVariantId: Number(productVariantId),
      selectedBulkOption: Number(selectedBulkOption) || 0,
    };
  }

  async setItemQuantity(
    cartId: number,
    productVariantId: number,
    quantity: number,
    selectedBulkOption = 0,
    tx?: any,
  ) {
    const db = tx ?? this.prisma;
    const where = this.lineWhere(cartId, productVariantId, selectedBulkOption);
    if (quantity <= 0) return db.cartItem.deleteMany({ where });
    return db.cartItem.updateMany({ where, data: { quantity: Number(quantity) } });
  }

  /** Sin `selectedBulkOption` quita la variante en TODAS sus presentaciones. */
  async removeItems(
    cartId: number,
    items: { productVariantId: number; selectedBulkOption?: number }[],
    tx?: any,
  ) {
    const db = tx ?? this.prisma;
    for (const item of items) {
      await db.cartItem.deleteMany({
        where:
          item.selectedBulkOption == null
            ? { cartId, productVariantId: Number(item.productVariantId) }
            : this.lineWhere(cartId, item.productVariantId, item.selectedBulkOption),
      });
    }
  }

  async clear(cartId: number, tx?: any) {
    return (tx ?? this.prisma).cartItem.deleteMany({ where: { cartId } });
  }

  /**
   * Borra carritos vacíos de cualquier dueño tras `emptyDays`, y carritos de
   * invitado con productos tras `guestDays`. Los carritos registrados con
   * productos se conservan.
   */
  async deleteStaleCarts({ guestDays, emptyDays }: { guestDays: number; emptyDays: number }) {
    const now = Date.now();
    const guestCutoff = new Date(now - guestDays * 86_400_000);
    const emptyCutoff = new Date(now - emptyDays * 86_400_000);
    return this.withTransaction(async (tx: any) => {
      const staleGuests = await tx.cart.findMany({
        where: {
          userSuperTokensId: null,
          updatedAt: { lt: guestCutoff },
        },
        select: { id: true },
        take: 5000,
      });
      const staleEmpty = await tx.cart.findMany({
        where: { updatedAt: { lt: emptyCutoff }, items: { none: {} } },
        select: { id: true },
        take: 5000,
      });

      const guestIds = staleGuests.map((cart: { id: number }) => cart.id);
      const emptyIds = staleEmpty.map((cart: { id: number }) => cart.id);
      if (guestIds.length) {
        await tx.cartItem.deleteMany({ where: { cartId: { in: guestIds } } });
      }

      const deletedGuests = guestIds.length
        ? await tx.cart.deleteMany({ where: { id: { in: guestIds }, userSuperTokensId: null } })
        : { count: 0 };
      const deletedEmpty = emptyIds.length
        ? await tx.cart.deleteMany({
            where: { id: { in: emptyIds }, updatedAt: { lt: emptyCutoff }, items: { none: {} } },
          })
        : { count: 0 };
      return deletedGuests.count + deletedEmpty.count;
    });
  }

  async touch(cartId: number, tx?: any) {
    return (tx ?? this.prisma).cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
    });
  }

  /** packagingOptions de varias variantes, para resolver la presentación por defecto. */
  /** Ids (de los pedidos) que se pueden vender en la web: variante y producto activos y "Disponible en la web". */
  async webSellableIds(variantIds: number[], tx?: any): Promise<Set<number>> {
    const rows = await (tx ?? this.prisma).productVariant.findMany({
      where: { id: { in: [...new Set(variantIds.map(Number))] }, ...webVariantWhere },
      select: { id: true },
    });
    return new Set(rows.map((r: any) => r.id));
  }

  async packagingOf(variantIds: number[], tx?: any): Promise<Map<number, number[]>> {
    const rows = await (tx ?? this.prisma).productVariant.findMany({
      where: { id: { in: [...new Set(variantIds.map(Number))] } },
      select: { id: true, packagingOptions: true },
    });
    return new Map(rows.map((r: any) => [r.id, r.packagingOptions ?? []]));
  }

  async mergeSessionCartToUserCart(sessionId: string, userSuperTokensId: string, tx?: any) {
    try {
      await (tx ?? this.prisma)
        .$executeRaw`SELECT public.merge_session_cart_to_user_cart(${sessionId}::VARCHAR, ${userSuperTokensId}::VARCHAR)`;
    } catch (error) {
      throw new StoreProcedureError("merge_session_cart_to_user_cart", error);
    }
  }
}
