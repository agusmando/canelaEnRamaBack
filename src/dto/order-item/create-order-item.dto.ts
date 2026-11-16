export class CreateOrderItemDto {
  productVariantId: number;
  productNameSnapshot: string;
  variantNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  status: string;
  discountAppliedSnapshot?: number;
  offerTypeSnapshot?: string;
  selectedBulkOption?: number;
  awaitingStockAt?: Date;
  constructor(
    productVariantId: number,
    productNameSnapshot: string,
    variantNameSnapshot: string,
    unitPriceSnapshot: number,
    quantity: number,
    status: string,
    discountAppliedSnapshot?: number,
    offerTypeSnapshot?: string,
    selectedBulkOption?: number,
    awaitingStockAt?: Date
  ) {
    this.productVariantId = productVariantId;
    this.productNameSnapshot = productNameSnapshot;
    this.variantNameSnapshot = variantNameSnapshot;
    this.unitPriceSnapshot = unitPriceSnapshot;
    this.quantity = quantity;
    this.status = status;
    this.discountAppliedSnapshot = discountAppliedSnapshot;
    this.offerTypeSnapshot = offerTypeSnapshot;
    this.selectedBulkOption = selectedBulkOption;
    this.awaitingStockAt = awaitingStockAt;
  }
}
