import { OrderDto } from "../order/order.dto.ts";
import { ProductVariantDto } from "../product-variant/product-variant.dto.ts";

export class OrderItemDto {
  id: number;
  orderId: number;
  productVariantId: number;
  productVariant?: ProductVariantDto;
  order?: OrderDto;

  productNameSnapshot: string;
  variantNameSnapshot: string;
  unitPriceSnapshot: number;
  discountAppliedSnapshot: number;
  offerTypeSnapshot: string;
  quantity: number;

  status: string;
  awaitingStockAt?: Date;
  selectedBulkOption?: number;

  constructor(
    id: number,
    orderId: number,
    productVariantId: number,
    productNameSnapshot: string,
    variantNameSnapshot: string,
    unitPriceSnapshot: number,
    quantity: number,
    status: string,
    discountAppliedSnapshot: number,
    offerTypeSnapshot: string,
    productVariant?: ProductVariantDto,
    order?: OrderDto,
    awaitingStockAt?: Date,
    selectedBulkOption?: number
  ) {
    this.id = id;
    this.orderId = orderId;
    this.productVariantId = productVariantId;
    this.productNameSnapshot = productNameSnapshot;
    this.variantNameSnapshot = variantNameSnapshot;
    this.unitPriceSnapshot = unitPriceSnapshot;
    this.quantity = quantity;
    this.productVariant = productVariant;
    this.order = order;
    this.status = status;
    this.discountAppliedSnapshot = discountAppliedSnapshot;
    this.offerTypeSnapshot = offerTypeSnapshot;
    this.awaitingStockAt = awaitingStockAt;
    this.selectedBulkOption = selectedBulkOption;
  }
}
