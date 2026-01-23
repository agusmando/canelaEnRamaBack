export class CreateOrderItemDto {
  orderId: number;
  productVariantId: number;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  status: string;
  awaitingStockAt?: Date;
  constructor(
    orderId: number,
    productVariantId: number,
    productNameSnapshot: string,
    variantNameSnapshot: string,
    unitPriceSnapshot: number,
    quantity: number,
    status: string,
    awaitingStockAt?: Date
  ) {
    this.orderId = orderId;
    this.productVariantId = productVariantId;
    this.productNameSnapshot = productNameSnapshot;
    this.variantNameSnapshot = variantNameSnapshot;
    this.unitPriceSnapshot = unitPriceSnapshot;
    this.quantity = quantity;
    this.status = status;
    this.awaitingStockAt = awaitingStockAt;
  }
}
