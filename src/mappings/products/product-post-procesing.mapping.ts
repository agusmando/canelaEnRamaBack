import { ProductDto } from "../../dto/products/product.dto.js";
import { productVariantPostProcessingMapping } from "../product-variants/product-variant-post-procesing.mapping.js";

export const productPostProcessingMapping = (product: ProductDto) => {
  if (!product?.variants?.length) return product;
  return {
    ...product,
    variants: product.variants.map((v) =>
      productVariantPostProcessingMapping(v, (product as any).offers),
    ),
  };
};
