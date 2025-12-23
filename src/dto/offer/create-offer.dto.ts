import { CreateProductVariantDto } from "../product-variant/create-product-variant.dto.ts";
export class CreateOfferDto {
  categoryId: number;
  productVariantId: number;
  startTime: Date;
  finishTime: Date;
  discountValue: number;
  discountType: string;
  discountQuantity?: number;
  stockThreshold?: number;

  constructor(
    categoryId: number,
    productVariantId: number,
    startTime: Date,
    finishTime: Date,
    discountValue: number,
    discountType: string,
    discountQuantity?: number,
    stockThreshold?: number
  ) {
    this.categoryId = categoryId;
    this.productVariantId = productVariantId;
    this.startTime = startTime;
    this.finishTime = finishTime;
    this.discountValue = discountValue;
    this.discountType = discountType;
    this.discountQuantity = discountQuantity;
    this.stockThreshold = stockThreshold;
  }
}
