import { v4 as uuidv4 } from "uuid";
import { GenericServiceImpl } from "./generic-impl.service.js";
import { CartDto } from "../dto/cart/cart.dto.js";
import { CreateCartDto } from "../dto/cart/create-cart.dto.js";
import { UpdateCartDto } from "../dto/cart/update-cart.dto.js";
import { CartRepository } from "../repository/cart.repository.js";
import { PricingService } from "./pricing.service.js";
import { NotFoundError } from "../errors/application/NotFoundError.js";
import { ValidationError } from "../errors/application/ValidationError.js";
import { UnAuthorizedError } from "../errors/domain/auth/UnauthorizedError.js";
import { effectiveBulkOption } from "../utils/pricing.js";
import type { Actor } from "../middleware/auth.middleware.js";

/**
 * Línea de carrito. `selectedBulkOption` = tamaño del paquete (g/u):
 *   - con presentación: `quantity` = cantidad de paquetes
 *   - sin presentación (variante suelta): `quantity` = gramos (KG) o unidades
 * Si la variante tiene presentaciones y no se indica, se usa la más chica.
 */
export type CartItemInput = {
  productVariantId: number;
  quantity: number;
  selectedBulkOption?: number | null;
};

export type CartUpdateInput = UpdateCartDto & {
  addItem?: CartItemInput[];
  editItem?: CartItemInput[];
  removeItem?: { productVariantId: number; selectedBulkOption?: number }[];
  clear?: boolean;
  mergeGuestCart?: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const validateItems = (items: CartItemInput[] | undefined, allowZero = false) => {
  for (const item of items ?? []) {
    const qty = Number(item?.quantity);
    if (!Number.isInteger(Number(item?.productVariantId))) {
      throw new ValidationError("productVariantId inválido");
    }
    if (!Number.isInteger(qty) || qty < 0 || (!allowZero && qty === 0)) {
      throw new ValidationError("quantity debe ser un entero mayor a 0");
    }
    if (item.selectedBulkOption != null && !(Number(item.selectedBulkOption) >= 0)) {
      throw new ValidationError("selectedBulkOption inválido");
    }
  }
};

export class CartService extends GenericServiceImpl<CartDto, CreateCartDto, UpdateCartDto> {
  constructor(
    private readonly cartRepository = new CartRepository(),
    private readonly pricingService = new PricingService(),
  ) {
    super(cartRepository);
  }

  /** Listado de staff: con `detalle`, cada carrito viene cotizado (ofertas y totales). */
  async getListedElements(
    filters: any,
    paginate = false,
    currentPage = 1,
    amountPerPage = 10,
    detalle = false,
  ) {
    const result = await super.getListedElements(filters, paginate, currentPage, amountPerPage, detalle);
    if (!detalle) return result;
    return { ...result, entityList: result.entityList.map((c: any) => this.withPricing(c)) };
  }

  /**
   * Crea un carrito. Si el usuario logueado ya tiene uno, le suma los ítems y
   * lo devuelve (no falla por la unique constraint).
   */
  async createCart(data: CreateCartDto, userId?: string): Promise<any> {
    const items = (data?.items ?? []) as CartItemInput[];
    validateItems(items);

    return this.cartRepository.withTransaction(async (tx) => {
      let token: string;
      if (userId) {
        const existing = await this.cartRepository.getCart(userId, tx);
        if (!existing) await this.cartRepository.createCart({ userSuperTokensId: userId }, tx);
        token = userId;
      } else {
        token = uuidv4();
        await this.cartRepository.createCart({ sessionId: token }, tx);
      }
      await this.addItems(token, items, tx);
      return this.withPricing(await this.cartRepository.getCart(token, tx));
    });
  }

  async getCart(token: string, actor: Actor) {
    const cart = await this.cartRepository.getCart(token);
    this.assertAccess(cart, actor);
    return this.withPricing(cart);
  }

  /**
   * Operaciones sobre el carrito (se aplican todas, en este orden):
   *   mergeGuestCart: true  -> fusiona el carrito de invitado `token` con el del usuario de la sesión
   *   clear: true           -> vacía el carrito
   *   addItem    [{productVariantId, quantity, selectedBulkOption?}] suma cantidades
   *   editItem   [{productVariantId, quantity, selectedBulkOption?}] fija cantidades (0 = quitar)
   *   removeItem [{productVariantId, selectedBulkOption?}] sin presentación quita todas
   */
  async updateCart(token: string, data: CartUpdateInput, actor: Actor) {
    if (!token) throw new ValidationError("Cart token is required");
    validateItems(data?.addItem);
    validateItems(data?.editItem, true);

    return this.cartRepository.withTransaction(async (tx) => {
      // Merge: el destino SIEMPRE es el usuario de la sesión, nunca el del body
      if (data.mergeGuestCart || data.userSuperTokensId) {
        if (!actor.userId) throw new UnAuthorizedError();
        await this.cartRepository.mergeSessionCartToUserCart(token, actor.userId, tx);
        token = actor.userId;
      }

      const cart = await this.cartRepository.getCart(token, tx);
      this.assertAccess(cart, actor);

      if (data.clear) await this.cartRepository.clear(cart.id, tx);
      await this.addItems(token, data.addItem ?? [], tx);

      if (data.editItem?.length) {
        const packaging = await this.cartRepository.packagingOf(
          data.editItem.map((i) => i.productVariantId),
          tx,
        );
        for (const item of data.editItem) {
          const bulk = effectiveBulkOption(packaging.get(Number(item.productVariantId)), item.selectedBulkOption) ?? 0;
          await this.cartRepository.setItemQuantity(cart.id, item.productVariantId, item.quantity, bulk, tx);
        }
      }
      if (data.removeItem?.length) {
        await this.cartRepository.removeItems(cart.id, data.removeItem, tx);
      }
      await this.cartRepository.touch(cart.id, tx);
      return this.withPricing(await this.cartRepository.getCart(token, tx));
    });
  }

  /**
   * Líneas del carrito del usuario listas para crear una orden (presentación
   * resuelta). Usado por el checkout (POST /order con fromCart).
   */
  async itemsForCheckout(userId: string, tx?: any) {
    const cart = await this.cartRepository.getCart(userId, tx);
    if (!cart || !cart.items?.length) {
      throw new ValidationError("El carrito está vacío");
    }
    return {
      cartId: cart.id as number,
      items: cart.items.map((item: any) => ({
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        selectedBulkOption:
          effectiveBulkOption(item.productVariant?.packagingOptions, item.selectedBulkOption) ?? undefined,
      })),
    };
  }

  async clearCart(cartId: number, tx?: any) {
    await this.cartRepository.clear(cartId, tx);
    await this.cartRepository.touch(cartId, tx);
  }

  private async addItems(token: string, items: CartItemInput[], tx: any) {
    if (!items.length) return;
    const packaging = await this.cartRepository.packagingOf(
      items.map((i) => i.productVariantId),
      tx,
    );
    for (const item of items) {
      // Si la variante no existe o la presentación no es válida, el SP responde 409.
      // Sin presentaciones definidas se pasa lo recibido para que el SP lo rechace.
      const bulk =
        effectiveBulkOption(packaging.get(Number(item.productVariantId)), item.selectedBulkOption) ??
        (Number(item.selectedBulkOption) || 0);
      await this.cartRepository.addItem(token, item.productVariantId, item.quantity, bulk, tx);
    }
  }

  /**
   * Un carrito de usuario solo lo ve su dueño (o staff). Un carrito de invitado
   * se accede con su token (uuid no adivinable).
   */
  private assertAccess(cart: any, actor: Actor) {
    if (!cart) throw new NotFoundError("Cart not found");
    if (cart.userSuperTokensId && !actor.isStaff && cart.userSuperTokensId !== actor.userId) {
      throw new NotFoundError("Cart not found");
    }
  }

  /** Agrega precio final, cotización por línea y totales al carrito. */
  private withPricing(cart: any) {
    if (!cart) return cart;
    let subtotal = 0;
    let discount = 0;
    const items = (cart.items ?? []).map((item: any) => {
      const variant = item.productVariant;
      const bulk = effectiveBulkOption(variant?.packagingOptions, item.selectedBulkOption);
      const quote = this.pricingService.quote({
        productVariant: variant,
        quantity: item.quantity,
        selectedBulkOption: bulk,
      });
      subtotal += quote.unitPriceSnapshot * quote.priceUnits;
      discount += quote.discountAppliedSnapshot;
      const stockNeeded = bulk ? item.quantity * bulk : item.quantity;
      // No exponemos costo ni margen al cliente
      const { price, profitMargin, ...publicVariant } = variant ?? {};
      return {
        ...item,
        selectedBulkOption: bulk ?? 0,
        productVariant: { ...publicVariant, finalPrice: quote.unitPriceSnapshot },
        available: !!variant?.active && !!variant?.availableWeb && variant?.currentStock > 0,
        enoughStock: Number(variant?.currentStock ?? 0) >= stockNeeded,
        quote: {
          unitPrice: quote.unitPriceSnapshot,
          total: quote.totalPriceSnapshot,
          discount: quote.discountAppliedSnapshot,
          offerType: quote.offerTypeSnapshot,
        },
      };
    });
    return {
      ...cart,
      items,
      summary: {
        itemsCount: items.length,
        subtotal: round2(subtotal),
        discount: round2(discount),
        total: round2(subtotal - discount),
      },
    };
  }
}
