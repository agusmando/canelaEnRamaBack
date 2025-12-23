import { CategoryDto } from "../category/category.dto.ts";
import { ProductVariantDto } from "../product-variant/product-variant.dto.ts";

export class OfferDto {
  id: number;
  categoryId: number;
  Category?: CategoryDto;
  productVariantId: number;
  ProductVariant?: ProductVariantDto;
  startTime: Date;
  finishTime: Date;
  discountValue: number;
  discountType: string;
  discountQuantity?: number;
  stockThreshold?: number;
  active: boolean;

  constructor(
    id: number,
    categoryId: number,
    productVariantId: number,
    startTime: Date,
    finishTime: Date,
    discountValue: number,
    discountType: string,
    active: boolean,
    stockThreshold?: number,
    discountQuantity?: number,
    Category?: CategoryDto,
    ProductVariant?: ProductVariantDto,
  ) {
    this.id = id;
    this.categoryId = categoryId;
    this.Category = Category;
    this.productVariantId = productVariantId;
    this.ProductVariant = ProductVariant;
    this.startTime = startTime;
    this.finishTime = finishTime;
    this.discountValue = discountValue;
    this.discountType = discountType;
    this.discountQuantity = discountQuantity;
    this.stockThreshold = stockThreshold;
    this.active = active;
  }
}
