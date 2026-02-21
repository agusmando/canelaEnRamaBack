export class UpdateOrderItemDto {

  id: number;
  productVariantId: number;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  status: string;
  awaitingStockAt?: Date;
  selectedBulkOption?: number;
  constructor(
    id: number,
    productVariantId: number,
    productNameSnapshot: string,
    variantNameSnapshot: string,
    unitPriceSnapshot: number,
    quantity: number,
    status: string,
    awaitingStockAt?: Date,
    selectedBulkOption?: number
  ) {
    this.id = id;
    this.productVariantId = productVariantId;
    this.productNameSnapshot = productNameSnapshot;
    this.variantNameSnapshot = variantNameSnapshot;
    this.unitPriceSnapshot = unitPriceSnapshot;
    this.quantity = quantity;
    this.status = status;
    this.awaitingStockAt = awaitingStockAt;
    this.selectedBulkOption = selectedBulkOption;
  }
}
