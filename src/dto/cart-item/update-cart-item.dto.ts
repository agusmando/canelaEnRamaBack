
export class UpdateCartItemDto {
  quantity: number;
  productVariantId: number;
  cartId: number;

  constructor(
    quantity: number,
    productVariantId: number,
    cartId: number,
  ) {
    this.productVariantId = productVariantId;
    this.cartId = cartId;
    this.quantity = quantity;
  }
}