import { CartDto } from "../../dto/cart/cart.dto.js";
import { CreateCartDto } from "../../dto/cart/create-cart.dto.js";
import { UpdateCartDto } from "../../dto/cart/update-cart.dto.js";
import { CartItemDto } from "../../dto/cart-item/cart-item.dto.js";
import { ProductVariantMapper } from "../product-variants/product-variant.mapper.js";

export class CartMapper {
  static toDto(dbCart: any): CartDto {
    if (!dbCart) return dbCart;

    const items = dbCart.items
      ? dbCart.items.map((item: any) => {
          return new CartItemDto(
            item.id || 0, // id is virtual/composite key @@id([cartId, productVariantId]) but DTO has it
            item.quantity,
            item.productVariantId,
            item.cartId,
            item.createdAt,
            item.productVariant ? ProductVariantMapper.toDto(item.productVariant) : undefined,
            undefined // Avoid circular references
          );
        })
      : [];

    return new CartDto(
      dbCart.id,
      items,
      dbCart.createdAt,
      dbCart.updatedAt,
      dbCart.sessionId ?? undefined,
      dbCart.userSuperTokensId ?? undefined,
      dbCart.user ? dbCart.user : undefined
    );
  }

  static toPrismaCreate(dto: CreateCartDto): any {
    const data: any = {};
    if (dto.sessionId) data.sessionId = dto.sessionId;
    if (dto.userSuperTokensId) {
      data.user = { connect: { supertokensId: dto.userSuperTokensId } };
    }

    if (dto.items && dto.items.length > 0) {
      data.items = {
        create: dto.items.map((item) => ({
          productVariantId: Number(item.productVariantId),
          quantity: Number(item.quantity),
        })),
      };
    }

    return data;
  }
}
