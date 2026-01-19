export class CreateCartItemDto {
  quantity: number;
  productVariantId: number;
  cartId: number;
  constructor(quantity: number, productVariantId: number, cartId: number) {
    this.quantity = quantity;
    this.productVariantId = productVariantId;
    this.cartId = cartId;
  }
}
