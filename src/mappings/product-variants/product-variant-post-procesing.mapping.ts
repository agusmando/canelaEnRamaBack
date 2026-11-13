import { ProductVariantDto } from "../../dto/product-variant/product-variant.dto.js";
import { computeFinalPrice } from "../../utils/pricing.js";

export const productVariantPostProcessingMapping = (
  variant: ProductVariantDto,
): ProductVariantDto => {
  if (!variant) return variant;
  return { ...variant, finalPrice: computeFinalPrice(variant) };
};
