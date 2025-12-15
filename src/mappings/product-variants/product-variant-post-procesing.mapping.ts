import { ProductVariantDto } from "../../dto/product-variant/product-variant.dto.ts";

export const productVariantPostProcessingQueryMapping = (
  product: ProductVariantDto
): ProductVariantDto => {
  let finalVariant = { ...product };
  finalVariant.finalPrice =
    Number(finalVariant.price) * Number(finalVariant.profitMargin) +
    Number(finalVariant.price);
  const { profitMargin, price, ...rest } = finalVariant;
  return rest;
};
