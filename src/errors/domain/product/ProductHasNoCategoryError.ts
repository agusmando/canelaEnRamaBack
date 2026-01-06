// errors/domain/product/ProductHasNoVariantsError.ts
export class ProductHasNoCategoryError extends Error {
  constructor() {
    super("Product must have a category");
    this.name = "ProductHasNoCategoryError";
  }
}
