export class CreateCartItemDto {
  quantity: number;
  productVariantId: number;
  /** Tamaño de paquete (g/u). 0 o ausente = venta suelta / presentación más chica. */
  selectedBulkOption?: number;
  cartId: number;
  constructor(quantity: number, productVariantId: number, cartId: number) {
    this.quantity = quantity;
    this.productVariantId = productVariantId;
    this.cartId = cartId;
  }
}
