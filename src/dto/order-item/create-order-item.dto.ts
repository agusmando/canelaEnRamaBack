export class CreateOrderItemDto {
  orderId: number;
  productVariantId: number;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  constructor(
    orderId: number,
    productVariantId: number,
    productNameSnapshot: string,
    variantNameSnapshot: string,
    unitPriceSnapshot: number,
    quantity: number,
  ) {
    this.orderId = orderId;
    this.productVariantId = productVariantId;
    this.productNameSnapshot = productNameSnapshot;
    this.variantNameSnapshot = variantNameSnapshot;
    this.unitPriceSnapshot = unitPriceSnapshot;
    this.quantity = quantity;
  }
}
