import { CreateProductVariantDto } from "../product-variant/create-product-variant.dto.ts";
import { TagDto } from "../tags/tag.dto.ts";

export class UpdateOfferDto {
  productId?: number;
  productVariantId?: number;
  startTime: Date;
  finishTime: Date;
  discountValue: number;
  discountType: string;
  discountQuantity?: number;
  quantityToGet?: number;
  stockThreshold?: number;

  constructor(
    startTime: Date,
    finishTime: Date,
    discountValue: number,
    discountType: string,
    productId?: number,
    productVariantId?: number,
    discountQuantity?: number,
    quantityToGet?: number,
    stockThreshold?: number
  ) {
    this.productId = productId;
    this.productVariantId = productVariantId;
    this.startTime = startTime;
    this.finishTime = finishTime;
    this.discountValue = discountValue;
    this.discountType = discountType;
    this.discountQuantity = discountQuantity;
    this.quantityToGet = quantityToGet;
    this.stockThreshold = stockThreshold;
  }
}
