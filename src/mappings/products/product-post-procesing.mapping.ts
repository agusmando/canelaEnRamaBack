import { ProductDto } from "../../dto/products/product.dto.js";
import { productVariantPostProcessingMapping } from "../product-variants/product-variant-post-procesing.mapping.js";

/**
 * Variantes con precio de venta y ofertas, y `local` resuelto: la variante es
 * de productor local si lo dice ella o, si no lo define (null), su producto.
 */
export const productPostProcessingMapping = (product: ProductDto) => {
  if (!product?.variants?.length) return product;
  const p: any = product;
  return {
    ...product,
    variants: product.variants.map((v: any) => ({
      ...productVariantPostProcessingMapping(v, p.offers),
      local: v.isLocal ?? !!p.isLocal,
    })),
  };
};
