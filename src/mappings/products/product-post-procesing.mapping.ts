import { ProductDto } from "../../dto/products/product.dto.ts";

export const productPostProcessingQueryMapping = (product: ProductDto) => {
  let finalProduct = { ...product };
  finalProduct.finalPrice =
    Number(finalProduct.price) * Number(finalProduct.profitMargin);
  const { profitMargin, price, ...rest } = finalProduct;
  return rest;
};
