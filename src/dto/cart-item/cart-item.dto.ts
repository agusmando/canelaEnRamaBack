import { CartDto } from "../cart/cart.dto.ts";
import { ProductVariantDto } from "../product-variant/product-variant.dto.ts";

export class CartItemDto {
  id: number;
  quantity: number;
  productVariant?: ProductVariantDto;
  productVariantId: number;
  createdAt: Date;
  cart?: CartDto;
  cartId: number;

  constructor(
    id: number,
    quantity: number,
    productVariantId: number,
    cartId: number,
    createdAt: Date,
    productVariant?: ProductVariantDto,
    cart?: CartDto,
  ) {
    this.id = id;
    this.quantity = quantity;
    this.productVariant = productVariant;
    this.productVariantId = productVariantId;
    this.cart = cart;
    this.cartId = cartId;
    this.createdAt = createdAt;
  }
}
