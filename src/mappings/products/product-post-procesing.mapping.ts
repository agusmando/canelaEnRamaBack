import { ProductVariantDto } from "../../dto/product-variant/product-variant.dto.ts";
import { ProductDto } from "../../dto/products/product.dto.ts";

export const productPostProcessingMapping = (product: ProductDto) => {
  let finalProduct = { ...product };
  if (!finalProduct.variants || finalProduct?.variants.length < 1)
    return finalProduct;
  const variants: ProductVariantDto[] = finalProduct?.variants.map(
    (variant) => {
      if (!variant.price || !variant.profitMargin) {
        return variant;
      }
      const rawPrice = variant.price * variant.profitMargin + variant.price;
      const roundingOption = variant.roundingOption;
      variant.finalPrice =
        Math.ceil(rawPrice / roundingOption) * roundingOption;
      const { profitMargin, price, ...rest } = variant;
      return rest;
    },
  );
  // .filter(Boolean);

  finalProduct.variants = variants;
  console.log(finalProduct.variants);
  return finalProduct;
};
