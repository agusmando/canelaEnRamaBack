import { ProductDto } from "../products/product.dto.ts";
import { ProductVariantDto } from "../product-variant/product-variant.dto.ts";

export class OfferDto {
  id: number;
  productId?: number;
  Product?: ProductDto;
  productVariantId?: number;
  ProductVariant?: ProductVariantDto;
  startTime: Date;
  finishTime: Date;
  discountValue?: number;
  discountType: string;
  discountQuantity?: number;
  quantityToGet?: number;
  stockThreshold?: number;
  active: boolean;

  constructor(
    id: number,
    startTime: Date,
    finishTime: Date,
    discountValue: number,
    discountType: string,
    active: boolean,
    productId?: number,
    productVariantId?: number,
    stockThreshold?: number,
    discountQuantity?: number,
    quantityToGet?: number,
    Product?: ProductDto,
    ProductVariant?: ProductVariantDto,
  ) {
    this.id = id;
    this.productId = productId;
    this.Product = Product;
    this.productVariantId = productVariantId;
    this.ProductVariant = ProductVariant;
    this.startTime = startTime;
    this.finishTime = finishTime;
    this.discountValue = discountValue;
    this.discountType = discountType;
    this.discountQuantity = discountQuantity;
    this.quantityToGet = quantityToGet;
    this.stockThreshold = stockThreshold;
    this.active = active;
  }
}
