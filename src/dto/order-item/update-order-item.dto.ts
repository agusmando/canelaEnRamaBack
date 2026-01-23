export class UpdateOrderItemDto {
  productNameSnapshot: string;
  variantNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  status: string;
  awaitingStockAt?: Date;
  constructor(
    productNameSnapshot: string,
    variantNameSnapshot: string,
    unitPriceSnapshot: number,
    quantity: number,
    status: string,
    awaitingStockAt?: Date
  ) {
    this.productNameSnapshot = productNameSnapshot;
    this.variantNameSnapshot = variantNameSnapshot;
    this.unitPriceSnapshot = unitPriceSnapshot;
    this.quantity = quantity;
    this.status = status;
    this.awaitingStockAt = awaitingStockAt;
  }
}
